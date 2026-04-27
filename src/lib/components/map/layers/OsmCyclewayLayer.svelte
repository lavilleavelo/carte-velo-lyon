<script lang="ts">
	import { GeoJSONSource, LineLayer, SymbolLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import type { FeatureCollection } from 'geojson';
	import { EMPTY_FEATURE_COLLECTION, filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
	import { osmFeatureToLegendId } from '$lib/utils/cyclewayLegend';
	import { PAVED_SURFACES } from '$lib/utils/osmCycleway';
	import { osmCyclewaysQueryOptions } from '$lib/queries/cyclewayQueries';
	import {
		BANDE_DASHARRAY,
		BUS_VELO_DASHARRAY,
		BUS_VELO_LINE_CAP,
		DSC_ARROW_SYMBOL_SPACING,
		DSC_ARROW_TEXT_SIZE,
		PISTE_BIDIR_LINE_WIDTH,
		PISTE_UNIDIR_LINE_WIDTH,
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
	}: {
		isLayerVisible: (id: string) => boolean;
		boundary?: FeatureCollection;
		activeLegendIds?: string[];
		hoveredLegendId?: string | null;
	} = $props();

	const DIMMED_OPACITY = 0.2;
	const NORMAL_OPACITY = 0.9;

	function opacityFor(...legendIds: string[]): number {
		if (!hoveredLegendId) return NORMAL_OPACITY;
		return legendIds.includes(hoveredLegendId) ? NORMAL_OPACITY : DIMMED_OPACITY;
	}

	const opacityPisteBidir = $derived(opacityFor('piste-bidir'));
	const opacityPisteUnidir = $derived(opacityFor('piste-unidir'));
	const opacityVoieVerte = $derived(opacityFor('voie-verte'));
	const opacityBande = $derived(opacityFor('bande'));
	const opacityBusVelo = $derived(opacityFor('bus-velo'));
	const opacityVelorue = $derived(opacityFor('velorue'));
	const opacityDsc = $derived(opacityFor('dsc'));
	const opacityDscBase = $derived(
		hoveredLegendId ? (hoveredLegendId === 'dsc' ? 0.5 : DIMMED_OPACITY) : 0.5,
	);

	const COLOR = '#0369a1';
	const COLOR_NON_PAVED = '#03527d';

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

	const lineOffset: any = ['get', 'offset'];
	const zoomedOffset: any = ['interpolate', ['linear'], ['zoom'], 12, 0, 15, ['get', 'offset']];
</script>

<GeoJSONSource
	maxzoom={13}
	data={displayData ?? EMPTY_FEATURE_COLLECTION}
	id="osm-cycleways-source"
>
	<LineLayer
		id="osm-cw-piste-bidir"
		filter={filterPisteBidir}
		paint={{
			'line-color': COLOR,
			'line-width': PISTE_BIDIR_LINE_WIDTH,
			'line-opacity': opacityPisteBidir,
			'line-offset': lineOffset,
		}}
		layout={{ 'line-cap': 'round', 'line-join': 'round', visibility }}
	/>

	<LineLayer
		id="osm-cw-piste-unidir"
		filter={filterPisteUnidir}
		paint={{
			'line-color': COLOR,
			'line-width': PISTE_UNIDIR_LINE_WIDTH,
			'line-opacity': opacityPisteUnidir,
			'line-offset': zoomedOffset,
		}}
		layout={{ 'line-cap': 'round', 'line-join': 'round', visibility }}
	/>

	<LineLayer
		id="osm-cw-voie-verte"
		filter={filterVoieVertePaved}
		paint={{
			'line-color': COLOR,
			'line-width': VOIE_VERTE_LINE_WIDTH,
			'line-opacity': opacityVoieVerte,
			'line-dasharray': VOIE_VERTE_DASHARRAY,
			'line-offset': lineOffset,
		}}
		layout={{ 'line-cap': VOIE_VERTE_LINE_CAP, visibility }}
	/>

	<LineLayer
		id="osm-cw-voie-verte-stabilise-base"
		filter={filterVoieVerteStabilise}
		paint={{
			'line-color': COLOR_NON_PAVED,
			'line-width': VOIE_VERTE_LINE_WIDTH,
			'line-opacity': opacityVoieVerte,
			'line-dasharray': VOIE_VERTE_DASHARRAY,
			'line-offset': lineOffset,
		}}
		layout={{ 'line-cap': VOIE_VERTE_LINE_CAP, visibility }}
	/>

	<LineLayer
		id="osm-cw-bande"
		filter={filterBande}
		paint={{
			'line-color': COLOR,
			'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 14, 1.6, 17, 3],
			'line-opacity': opacityBande,
			'line-dasharray': BANDE_DASHARRAY,
			'line-offset': zoomedOffset,
		}}
		layout={{ visibility }}
	/>

	<LineLayer
		id="osm-cw-bus-velo"
		filter={filterBusVelo}
		paint={{
			'line-color': COLOR,
			'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 14, 1.6, 17, 2.5],
			'line-opacity': opacityBusVelo,
			'line-dasharray': BUS_VELO_DASHARRAY,
			'line-offset': zoomedOffset,
		}}
		layout={{ 'line-cap': BUS_VELO_LINE_CAP, visibility }}
	/>

	<LineLayer
		id="osm-cw-velorue"
		filter={filterVelorue}
		paint={{
			'line-color': COLOR,
			'line-width': 4,
			'line-opacity': opacityVelorue,
			'line-dasharray': VELORUE_DASHARRAY,
			'line-offset': lineOffset,
		}}
		layout={{ 'line-cap': VELORUE_LINE_CAP, visibility }}
	/>

	<LineLayer
		id="osm-cw-dsc-base"
		filter={filterDsc}
		paint={{ 'line-color': COLOR, 'line-width': 1.5, 'line-opacity': opacityDscBase }}
		layout={{ visibility }}
	/>

	<SymbolLayer
		id="osm-cw-dsc-arrows"
		filter={filterDsc}
		layout={{
			'symbol-placement': 'line',
			'symbol-spacing': DSC_ARROW_SYMBOL_SPACING,
			'text-field': '←',
			'text-size': DSC_ARROW_TEXT_SIZE,
			'text-keep-upright': false,
			'text-rotation-alignment': 'map',
			'text-pitch-alignment': 'map',
			'text-allow-overlap': true,
			'text-ignore-placement': true,
			visibility,
		}}
		paint={{
			'text-color': COLOR,
			'text-halo-color': '#ffffff',
			'text-halo-width': 1,
			'text-opacity': opacityDsc,
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
