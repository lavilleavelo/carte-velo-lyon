<script lang="ts">
	import { GeoJSONSource, LineLayer, SymbolLayer } from 'svelte-maplibre-gl';
	import type { FeatureCollection } from 'geojson';
	import targetNetworkData from '$lib/data/r_seau_cible_m_tropole_lyon_2040.json';

	let { isLayerVisible, targetNetworkHorizons } = $props();

	const data = {
		...targetNetworkData,
		features: (targetNetworkData as FeatureCollection).features.map((f) => {
			let horizon = 'unknown';
			if (f.properties?.description?.includes('Horizon 2030')) horizon = '2030';
			else if (f.properties?.description?.includes('Horizon 2035')) horizon = '2035';
			else if (f.properties?.description?.includes('Horizon 2040')) horizon = '2040';

			const name = f.properties?.name || '';
			const displayName = horizon !== 'unknown' ? `${name} - ${horizon}` : name;

			return {
				...f,
				properties: {
					...f.properties,
					horizon,
					displayName,
				},
			};
		}),
	} as FeatureCollection;
</script>

<GeoJSONSource {data} id="target-network-source">
	<LineLayer
		id="target-network-casing"
		paint={{
			'line-color': '#ffffff',
			'line-width': 4,
			'line-opacity': 0.8,
		}}
		layout={{
			visibility: isLayerVisible('target-network') ? 'visible' : 'none',
			'line-join': 'round',
			'line-cap': 'round',
		}}
		filter={['in', ['get', 'horizon'], ['literal', targetNetworkHorizons]]}
	/>

	<LineLayer
		id="target-network-layer"
		paint={{
			'line-color': [
				'match',
				['get', 'horizon'],
				'2030',
				'#db2777',
				'2035',
				'#9333ea',
				'2040',
				'#2563eb',
				'#a855f7',
			],
			'line-width': 3,
			'line-opacity': 0.9,
			'line-dasharray': [
				'match',
				['get', 'horizon'],
				'2030',
				['literal', [3, 1]],
				'2035',
				['literal', [2, 2]],
				'2040',
				['literal', [0.1, 2]], // Dotted
				['literal', [2, 2]], // fallback
			],
		}}
		layout={{
			visibility: isLayerVisible('target-network') ? 'visible' : 'none',
			'line-join': 'round',
			'line-cap': 'round',
		}}
		filter={['in', ['get', 'horizon'], ['literal', targetNetworkHorizons]]}
	/>

	<SymbolLayer
		id="target-network-labels"
		layout={{
			'text-field': ['get', 'displayName'],
			'symbol-placement': 'line',
			'symbol-spacing': 250,
			'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
			'text-size': 13,
			'text-offset': [0, 0],
			'text-anchor': 'center',
			'text-max-angle': 30,
			'text-keep-upright': true,
			visibility: isLayerVisible('target-network') ? 'visible' : 'none',
		}}
		paint={{
			'text-color': [
				'match',
				['get', 'horizon'],
				'2030',
				'#db2777',
				'2035',
				'#9333ea',
				'2040',
				'#2563eb',
				'#a855f7',
			],
			'text-halo-color': '#ffffff',
			'text-halo-width': 2,
		}}
		filter={['in', ['get', 'horizon'], ['literal', targetNetworkHorizons]]}
	/>

	<LineLayer
		id="target-network-hitarea"
		paint={{
			'line-color': 'transparent',
			'line-width': 20,
			'line-opacity': 0,
		}}
		layout={{
			visibility: isLayerVisible('target-network') ? 'visible' : 'none',
			'line-join': 'round',
			'line-cap': 'round',
		}}
		filter={['in', ['get', 'horizon'], ['literal', targetNetworkHorizons]]}
		onmouseenter={() => {}}
		onmouseleave={() => {}}
	/>
</GeoJSONSource>
