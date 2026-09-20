<script lang="ts">
	import { GeoJSONSource, LineLayer, SymbolLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import type { FeatureCollection } from 'geojson';
	import type * as maplibregl from 'maplibre-gl';
	import { EMPTY_FEATURE_COLLECTION, filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
	import { osmFeatureToLegendId } from '$lib/utils/cyclewayLegend';
	import { PAVED_SURFACES } from '$lib/utils/osmCycleway';
	import { osmCyclewaysQueryOptions } from '$lib/queries/cyclewayQueries';
	import {
		createDscArrowIconById,
		DSC_ARROW_BIKE_COLORS,
		dscArrowIconId,
		type DscArrowVariant,
	} from '$lib/utils/mapUtils';
	import {
		BANDE_DASHARRAY,
		BUS_VELO_DASHARRAY,
		BUS_VELO_LINE_CAP,
		CYCLEWAY_DETAIL_ZOOM,
		DSC_ARROW_SYMBOL_SPACING,
		DSC_ARROW_TEXT_SIZE,
		PISTE_BIDIR_LINE_WIDTH,
		PISTE_UNIDIR_LINE_WIDTH,
		TROTTOIR_DASHARRAY,
		TROTTOIR_LINE_CAP,
		VELORUE_DASHARRAY,
		VELORUE_LINE_CAP,
		VOIE_VERTE_DASHARRAY,
		VOIE_VERTE_LINE_CAP,
		VOIE_VERTE_LINE_WIDTH,
	} from './cyclewayStyles';

	let {
		isLayerVisible,
		boundary,
		activeLegendIds,
		hoveredLegendId,
		map,
		opacityScale = 1,
		safetyMode = false,
		safetyFilter = [],
		hoveredSafety = null,
		hoveredFeatureId = null,
		selectedFeatureIds = [],
		declutterOverview = false,
	}: {
		isLayerVisible: (id: string) => boolean;
		boundary?: FeatureCollection;
		activeLegendIds?: string[];
		hoveredLegendId?: string | null;
		map?: maplibregl.Map;
		opacityScale?: number;
		safetyMode?: boolean;
		safetyFilter?: ('safe' | 'unsafe' | 'pedestrian')[];
		hoveredSafety?: 'safe' | 'unsafe' | 'pedestrian' | null;
		hoveredFeatureId?: string | number | null;
		selectedFeatureIds?: readonly (string | number)[];
		declutterOverview?: boolean;
	} = $props();

	const DIMMED_OPACITY = 0.2;
	const NORMAL_OPACITY = 0.9;

	function opacityFor(...legendIds: string[]): number {
		const base = !hoveredLegendId
			? NORMAL_OPACITY
			: legendIds.includes(hoveredLegendId)
				? NORMAL_OPACITY
				: DIMMED_OPACITY;
		return base * opacityScale;
	}

	const isPedestrianSharedExpr: any = [
		'any',
		['==', ['get', 'typeamenagement'], 'Voie verte'],
		['==', ['get', 'typeamenagement'], 'Voie piétonne (vélos autorisés)'],
	];

	const safetyOpacityExpr: any = $derived.by(() => {
		if (!hoveredSafety) return 1;
		const dim = DIMMED_OPACITY / NORMAL_OPACITY;
		if (hoveredSafety === 'pedestrian') {
			return ['case', isPedestrianSharedExpr, 1, dim];
		}
		const wantSafe = hoveredSafety === 'safe';
		return ['case', isPedestrianSharedExpr, dim, ['==', ['get', 'isSafe'], wantSafe], 1, dim];
	});

	const opacityPisteBidir = $derived(opacityFor('piste-bidir'));
	const opacityPisteUnidir = $derived(opacityFor('piste-unidir'));
	const opacityVoieVerte = $derived(opacityFor('voie-verte'));
	const opacityBande = $derived(opacityFor('bande'));
	const opacityBusVelo = $derived(opacityFor('bus-velo'));
	const opacityVelorue = $derived(opacityFor('velorue'));
	const opacityDsc = $derived(opacityFor('dsc'));
	const opacityTrottoir = $derived(opacityFor('trottoir'));

	const COLOR = '#0369a1';
	const COLOR_NON_PAVED = '#03527d';
	const SAFETY_COLOR_SAFE = '#2563eb';
	const SAFETY_COLOR_UNSAFE = '#dc2626';
	const SAFETY_COLOR_PEDESTRIAN = '#ea580c';

	const safetyLineColorExpr: any = [
		'case',
		isPedestrianSharedExpr,
		SAFETY_COLOR_PEDESTRIAN,
		['==', ['get', 'isSafe'], true],
		SAFETY_COLOR_SAFE,
		SAFETY_COLOR_UNSAFE,
	];

	const lineColor: any = $derived(safetyMode ? safetyLineColorExpr : COLOR);

	const lineColorNonPaved: any = $derived(safetyMode ? safetyLineColorExpr : COLOR_NON_PAVED);

	function ensureDscIcons(m: maplibregl.Map) {
		for (const variant of Object.keys(DSC_ARROW_BIKE_COLORS) as DscArrowVariant[]) {
			for (const reverse of [false, true]) {
				const name = dscArrowIconId(variant, reverse);
				const canvas = m.hasImage(name) ? null : createDscArrowIconById(name);
				const imageData = canvas?.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
				if (imageData) {
					m.addImage(name, imageData, { pixelRatio: window.devicePixelRatio || 1 });
				}
			}
		}
	}

	const dscIconImage: any = $derived.by(() => {
		const isReverse = ['==', ['get', 'oneway'], '-1'];
		const pick = (variant: DscArrowVariant) => [
			'case',
			isReverse,
			dscArrowIconId(variant, true),
			dscArrowIconId(variant, false),
		];
		return safetyMode
			? ['case', ['==', ['get', 'isSafe'], true], pick('safe'), pick('unsafe')]
			: pick('default');
	});

	$effect(() => {
		if (map) {
			ensureDscIcons(map);
		}
	});

	const enabled = $derived(isLayerVisible('osm-cycleways'));

	const query = createQuery(() => osmCyclewaysQueryOptions(enabled));

	const visibility = $derived(enabled ? 'visible' : 'none');

	const displayData = $derived.by(() => {
		const data = query.data;
		if (!data) return undefined;
		let result: FeatureCollection = boundary ? filterFeaturesInsideBoundary(data, boundary) : data;
		const active = activeLegendIds ?? [];
		if (active.length > 0) {
			const allowed = new Set(active);
			result = {
				...result,
				features: result.features.filter((f) => {
					const id = osmFeatureToLegendId(f.properties);
					return id ? allowed.has(id) : false;
				}),
			};
		}

		if (safetyFilter.length > 0) {
			const allowed = new Set(safetyFilter);
			result = {
				...result,
				features: result.features.filter((f) => {
					const props = f.properties as any;
					const isPedestrian =
						props?.typeamenagement === 'Voie verte' ||
						props?.typeamenagement === 'Voie piétonne (vélos autorisés)';
					const key = isPedestrian ? 'pedestrian' : props?.isSafe ? 'safe' : 'unsafe';
					return allowed.has(key);
				}),
			};
		}
		return result;
	});

	const isBidir: any = ['==', ['get', 'bidirectional'], true];
	const filterPisteBidir: any = [
		'all',
		['==', ['get', 'typeamenagement'], 'Piste Cyclable'],
		isBidir,
	];
	const filterPisteUnidir: any = [
		'all',
		['==', ['get', 'typeamenagement'], 'Piste Cyclable'],
		['!', isBidir],
	];
	const pavedSurfacesLiteral: any = ['literal', Array.from(PAVED_SURFACES)];
	const isPavedSurface: any = [
		'any',
		['!', ['has', 'surface']],
		['in', ['get', 'surface'], pavedSurfacesLiteral],
	];
	const filterVoieVertePaved: any = [
		'all',
		['==', ['get', 'typeamenagement'], 'Voie verte'],
		isPavedSurface,
	];
	const filterVoieVerteStabilise: any = [
		'all',
		['==', ['get', 'typeamenagement'], 'Voie verte'],
		['!', isPavedSurface],
	];
	const filterBande: any = ['==', ['get', 'typeamenagement'], 'Bande Cyclable'];
	const filterBusVelo: any = ['==', ['get', 'typeamenagement'], 'Couloir bus vélo'];
	const filterDsc: any = ['==', ['get', 'typeamenagement'], 'Double sens cyclable'];
	const filterVelorue: any = ['==', ['get', 'typeamenagement'], 'Vélorue'];
	const filterTrottoir: any = ['==', ['get', 'typeamenagement'], 'Voie piétonne (vélos autorisés)'];

	const lineOffset: any = ['get', 'offset'];
	// One line per street below CYCLEWAY_DETAIL_ZOOM, then the sides spread apart (0.6 is where the
	// former 12 -> 15 ramp stood at that zoom, so the detail view is unchanged).
	const zoomedOffset: any = [
		'interpolate',
		['linear'],
		['zoom'],
		CYCLEWAY_DETAIL_ZOOM - 0.01,
		0,
		CYCLEWAY_DETAIL_ZOOM,
		['*', ['get', 'offset'], 0.6],
		15,
		['get', 'offset'],
		18,
		['*', ['get', 'offset'], 1.8],
	];

	// Below CYCLEWAY_DETAIL_ZOOM, bandes, double-sens and trottoirs stay on the map but thinner and
	// lighter so the structuring network leads. They keep full strength when the user is looking
	// for them: safety mode (fading bandes would flatter the network), legend hover, or a legend
	// selection without any structuring type.
	const MINOR_LEGEND_IDS = ['bande', 'dsc', 'trottoir'];
	const OVERVIEW_DIM = 0.55;
	const dimMinorAtOverview = $derived.by(() => {
		if (!declutterOverview || safetyMode) {
			return false;
		}
		if (hoveredLegendId && MINOR_LEGEND_IDS.includes(hoveredLegendId)) {
			return false;
		}
		const active = activeLegendIds ?? [];
		return active.length === 0 || active.some((id) => !MINOR_LEGEND_IDS.includes(id));
	});
	function minorOpacity(base: number): any {
		const full = ['*', base, safetyOpacityExpr];
		if (!dimMinorAtOverview) {
			return full;
		}
		return [
			'interpolate',
			['linear'],
			['zoom'],
			CYCLEWAY_DETAIL_ZOOM - 0.01,
			['*', base * OVERVIEW_DIM, safetyOpacityExpr],
			CYCLEWAY_DETAIL_ZOOM,
			full,
		];
	}
	// 1.94 is where the regular bande ramp stands at CYCLEWAY_DETAIL_ZOOM.
	const bandeWidth: any = $derived(
		dimMinorAtOverview
			? [
					'interpolate',
					['linear'],
					['zoom'],
					8,
					0.4,
					11,
					0.8,
					CYCLEWAY_DETAIL_ZOOM - 0.01,
					1.2,
					CYCLEWAY_DETAIL_ZOOM,
					1.94,
					14,
					2,
					17,
					2.8,
				]
			: ['interpolate', ['linear'], ['zoom'], 8, 0.5, 11, 1.1, 14, 2, 17, 2.8],
	);

	const HOVER_COLOR = '#facc15';
	const SELECTED_COLOR = '#f97316';
	const hoverFilter: any = $derived(
		hoveredFeatureId == null ? ['==', ['id'], -1] : ['==', ['id'], hoveredFeatureId],
	);
	const selectedFilter: any = $derived(
		selectedFeatureIds.length === 0
			? ['==', ['id'], -1]
			: ['in', ['id'], ['literal', [...selectedFeatureIds]]],
	);
</script>

<GeoJSONSource
	maxzoom={13}
	data={displayData ?? EMPTY_FEATURE_COLLECTION}
	id="osm-cycleways-source"
	generateId
>
	<LineLayer
		id="osm-cw-selected"
		filter={selectedFilter}
		minzoom={14}
		paint={{
			'line-color': SELECTED_COLOR,
			'line-width': ['interpolate', ['linear'], ['zoom'], 14, 6, 17, 11],
			'line-opacity': 0.5,
			'line-offset': zoomedOffset,
		}}
		layout={{ 'line-cap': 'round', 'line-join': 'round', visibility }}
	/>

	<LineLayer
		id="osm-cw-hover"
		filter={hoverFilter}
		minzoom={14}
		paint={{
			'line-color': HOVER_COLOR,
			'line-width': ['interpolate', ['linear'], ['zoom'], 14, 5, 17, 9],
			'line-opacity': 0.85,
			'line-offset': zoomedOffset,
		}}
		layout={{ 'line-cap': 'round', 'line-join': 'round', visibility }}
	/>

	<LineLayer
		id="osm-cw-piste-bidir"
		filter={filterPisteBidir}
		paint={{
			'line-color': lineColor,
			'line-width': PISTE_BIDIR_LINE_WIDTH,
			'line-opacity': ['*', opacityPisteBidir, safetyOpacityExpr],
			'line-offset': lineOffset,
		}}
		layout={{ 'line-cap': 'round', 'line-join': 'round', visibility }}
	/>

	<LineLayer
		id="osm-cw-piste-unidir"
		filter={filterPisteUnidir}
		paint={{
			'line-color': lineColor,
			'line-width': PISTE_UNIDIR_LINE_WIDTH,
			'line-opacity': ['*', opacityPisteUnidir, safetyOpacityExpr],
			'line-offset': zoomedOffset,
		}}
		layout={{ 'line-cap': 'round', 'line-join': 'round', visibility }}
	/>

	<LineLayer
		id="osm-cw-voie-verte"
		filter={filterVoieVertePaved}
		paint={{
			'line-color': lineColor,
			'line-width': VOIE_VERTE_LINE_WIDTH,
			'line-opacity': ['*', opacityVoieVerte, safetyOpacityExpr],
			'line-dasharray': VOIE_VERTE_DASHARRAY,
			'line-offset': lineOffset,
		}}
		layout={{ 'line-cap': VOIE_VERTE_LINE_CAP, visibility }}
	/>

	<LineLayer
		id="osm-cw-voie-verte-stabilise-base"
		filter={filterVoieVerteStabilise}
		paint={{
			'line-color': lineColorNonPaved,
			'line-width': VOIE_VERTE_LINE_WIDTH,
			'line-opacity': ['*', opacityVoieVerte, safetyOpacityExpr],
			'line-dasharray': VOIE_VERTE_DASHARRAY,
			'line-offset': lineOffset,
		}}
		layout={{ 'line-cap': VOIE_VERTE_LINE_CAP, visibility }}
	/>

	<LineLayer
		id="osm-cw-bande"
		filter={filterBande}
		paint={{
			'line-color': lineColor,
			'line-width': bandeWidth,
			'line-opacity': minorOpacity(opacityBande),
			'line-dasharray': BANDE_DASHARRAY,
			'line-offset': zoomedOffset,
		}}
		layout={{ visibility }}
	/>

	<LineLayer
		id="osm-cw-bus-velo"
		filter={filterBusVelo}
		paint={{
			'line-color': lineColor,
			'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 11, 1.6, 14, 2.4, 17, 3.5],
			'line-opacity': ['*', opacityBusVelo, safetyOpacityExpr],
			'line-dasharray': BUS_VELO_DASHARRAY,
			'line-offset': zoomedOffset,
		}}
		layout={{ 'line-cap': BUS_VELO_LINE_CAP, visibility }}
	/>

	<LineLayer
		id="osm-cw-velorue"
		filter={filterVelorue}
		minzoom={12.5}
		paint={{
			'line-color': lineColor,
			'line-width': 4,
			'line-opacity': ['*', opacityVelorue, safetyOpacityExpr],
			'line-dasharray': VELORUE_DASHARRAY,
			'line-offset': lineOffset,
		}}
		layout={{ 'line-cap': VELORUE_LINE_CAP, visibility }}
	/>

	<LineLayer
		id="osm-cw-trottoir"
		filter={filterTrottoir}
		minzoom={13}
		paint={{
			'line-color': lineColor,
			'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1, 14, 1.6, 17, 2.4],
			'line-opacity': minorOpacity(opacityTrottoir),
			'line-dasharray': TROTTOIR_DASHARRAY,
			'line-offset': lineOffset,
		}}
		layout={{ 'line-cap': TROTTOIR_LINE_CAP, visibility }}
	/>

	<LineLayer
		id="osm-cw-dsc-overview"
		filter={filterDsc}
		minzoom={12}
		maxzoom={CYCLEWAY_DETAIL_ZOOM}
		paint={{
			'line-color': lineColor,
			'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.6, CYCLEWAY_DETAIL_ZOOM, 1],
			'line-opacity': opacityDsc * OVERVIEW_DIM,
			'line-dasharray': [1, 2],
		}}
		layout={{ visibility: dimMinorAtOverview ? visibility : 'none' }}
	/>

	<SymbolLayer
		id="osm-cw-dsc-arrows"
		filter={filterDsc}
		minzoom={dimMinorAtOverview ? CYCLEWAY_DETAIL_ZOOM : 13}
		layout={{
			'symbol-placement': 'line',
			'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 11, 80, 14, 50, 17, 35],
			'icon-size': ['interpolate', ['exponential', 1.4], ['zoom'], 11, 0.4, 14, 0.8, 17, 1.2],
			'icon-image': dscIconImage,
			'icon-rotation-alignment': 'map',
			'icon-pitch-alignment': 'map',
			'icon-keep-upright': true,
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			visibility,
		}}
		paint={{
			'icon-opacity': ['*', opacityDsc, safetyOpacityExpr],
		}}
	/>

	<LineLayer
		id="osm-cycleways-layer-hitarea"
		paint={{
			'line-color': 'transparent',
			'line-width': 20,
			'line-opacity': 0,
			'line-offset': zoomedOffset,
		}}
		layout={{ visibility }}
	/>
</GeoJSONSource>
