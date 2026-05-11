<script lang="ts">
	import { GeoJSONSource, LineLayer, SymbolLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import type { FeatureCollection } from 'geojson';
	import type maplibregl from 'maplibre-gl';
	import { EMPTY_FEATURE_COLLECTION, filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
	import { osmFeatureToLegendId } from '$lib/utils/cyclewayLegend';
	import { PAVED_SURFACES } from '$lib/utils/osmCycleway';
	import { osmCyclewaysQueryOptions } from '$lib/queries/cyclewayQueries';
	import { createDscArrowIcon } from '$lib/utils/mapUtils';
	import {
		BANDE_DASHARRAY,
		BUS_VELO_DASHARRAY,
		BUS_VELO_LINE_CAP,
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
	} = $props();

	const DSC_CAR_COLOR = '#000000';
	const DSC_ICON_FORWARD = 'dsc-arrow-forward';
	const DSC_ICON_REVERSE = 'dsc-arrow-reverse';

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
		const register = (name: string, leftColor: string, rightColor: string) => {
			if (m.hasImage(name)) {
				return;
			}

			const canvas = createDscArrowIcon(leftColor, rightColor);
			const ctx = canvas.getContext('2d');
			const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
			if (imageData) {
				m.addImage(name, imageData, { pixelRatio: window.devicePixelRatio || 1 });
			}
		};

		// forward (oneway=yes): line direction = car. Left of icon = bike (blue), right = car (black).
		register(DSC_ICON_FORWARD, COLOR, DSC_CAR_COLOR);

		// reverse (oneway=-1): line direction = opposite of car. Left = car (black), right = bike (blue).
		register(DSC_ICON_REVERSE, DSC_CAR_COLOR, COLOR);
	}

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
	const zoomedOffset: any = [
		'interpolate',
		['linear'],
		['zoom'],
		12,
		0,
		15,
		['get', 'offset'],
		18,
		['*', ['get', 'offset'], 1.8],
	];

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
			'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 11, 1.1, 14, 2, 17, 2.8],
			'line-opacity': ['*', opacityBande, safetyOpacityExpr],
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
			'line-opacity': ['*', opacityTrottoir, safetyOpacityExpr],
			'line-dasharray': TROTTOIR_DASHARRAY,
			'line-offset': lineOffset,
		}}
		layout={{ 'line-cap': TROTTOIR_LINE_CAP, visibility }}
	/>

	<SymbolLayer
		id="osm-cw-dsc-arrows"
		filter={filterDsc}
		minzoom={13}
		layout={{
			'symbol-placement': 'line',
			'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 11, 80, 14, 50, 17, 35],
			'icon-size': ['interpolate', ['exponential', 1.4], ['zoom'], 11, 0.4, 14, 0.8, 17, 1.2],
			'icon-image': ['case', ['==', ['get', 'oneway'], '-1'], DSC_ICON_REVERSE, DSC_ICON_FORWARD],
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
