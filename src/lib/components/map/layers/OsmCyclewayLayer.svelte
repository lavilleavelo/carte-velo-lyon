<script lang="ts">
	import { GeoJSONSource, LineLayer, SymbolLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import type { FeatureCollection } from 'geojson';
	import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
	import { osmFeatureToLegendId } from '$lib/utils/cyclewayLegend';
	import { osmCyclewaysQueryOptions } from '$lib/queries/cyclewayQueries';

	let {
		isLayerVisible,
		boundary,
		activeLegendIds,
	}: {
		isLayerVisible: (id: string) => boolean;
		boundary?: FeatureCollection;
		activeLegendIds?: string[];
	} = $props();

	const COLOR = '#0369a1';
	const COLOR_NON_PAVED = '#03527d';

	const PAVED_SURFACES = new Set([
		'asphalt',
		'paved',
		'concrete',
		'concrete:plates',
		'paving_stones',
		'sett',
		'cobblestone',
		'unhewn_cobblestone',
		'metal',
	]);

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
	data={displayData ?? { type: 'FeatureCollection', features: [] }}
	id="osm-cycleways-source"
>
	<LineLayer
		id="osm-cw-piste-bidir"
		filter={filterPisteBidir}
		paint={{
			'line-color': COLOR,
			'line-width': 4,
			'line-opacity': 0.9,
			'line-offset': lineOffset,
		}}
		layout={{ 'line-cap': 'round', 'line-join': 'round', visibility }}
	/>

	<LineLayer
		id="osm-cw-piste-unidir"
		filter={filterPisteUnidir}
		paint={{
			'line-color': COLOR,
			'line-width': 2,
			'line-opacity': 0.9,
			'line-offset': zoomedOffset,
		}}
		layout={{ 'line-cap': 'round', 'line-join': 'round', visibility }}
	/>

	<LineLayer
		id="osm-cw-voie-verte"
		filter={filterVoieVertePaved}
		paint={{
			'line-color': COLOR,
			'line-width': 4,
			'line-opacity': 0.9,
			'line-dasharray': [0.3, 1.6],
			'line-offset': lineOffset,
		}}
		layout={{ 'line-cap': 'round', visibility }}
	/>

	<LineLayer
		id="osm-cw-voie-verte-stabilise-base"
		filter={filterVoieVerteStabilise}
		paint={{
			'line-color': COLOR_NON_PAVED,
			'line-width': 4,
			'line-opacity': 0.9,
			'line-dasharray': [0.3, 1.6],
			'line-offset': lineOffset,
		}}
		layout={{ 'line-cap': 'round', visibility }}
	/>
	/>

	<LineLayer
		id="osm-cw-bande"
		filter={filterBande}
		paint={{
			'line-color': COLOR,
			'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 14, 1.6, 17, 3],
			'line-opacity': 0.9,
			'line-dasharray': [1.5, 1],
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
			'line-opacity': 0.9,
			'line-dasharray': [2, 2.5],
			'line-offset': zoomedOffset,
		}}
		layout={{ 'line-cap': 'butt', visibility }}
	/>

	<LineLayer
		id="osm-cw-velorue"
		filter={filterVelorue}
		paint={{
			'line-color': COLOR,
			'line-width': 4,
			'line-opacity': 0.9,
			'line-dasharray': [2.5, 1.2],
			'line-offset': lineOffset,
		}}
		layout={{ 'line-cap': 'butt', visibility }}
	/>

	<LineLayer
		id="osm-cw-dsc-base"
		filter={filterDsc}
		paint={{ 'line-color': COLOR, 'line-width': 1.5, 'line-opacity': 0.5 }}
		layout={{ visibility }}
	/>

	<SymbolLayer
		id="osm-cw-dsc-arrows"
		filter={filterDsc}
		layout={{
			'symbol-placement': 'line',
			'symbol-spacing': 40,
			'text-field': '←',
			'text-size': 16,
			'text-keep-upright': false,
			'text-rotation-alignment': 'map',
			'text-pitch-alignment': 'map',
			'text-allow-overlap': true,
			'text-ignore-placement': true,
			visibility,
		}}
		paint={{ 'text-color': COLOR, 'text-halo-color': '#ffffff', 'text-halo-width': 1 }}
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
