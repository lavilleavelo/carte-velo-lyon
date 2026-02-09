<script lang="ts">
	import { GeoJSONSource, LineLayer, SymbolLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import { processBusData, loadTransportShieldIcons } from '$lib/utils/mapUtils';

	let { isLayerVisible, handleMouseEnter, handleMouseLeave, map } = $props();

	const busQuery = createQuery(() => ({
		queryKey: ['bus'],
		queryFn: async () => {
			const response = await fetch('/api/grandlyon/bus');
			if (!response.ok) {
				throw new Error('Failed to fetch bus data');
			}
			const data = await response.json();
			return processBusData(data.features);
		},
		staleTime: Infinity,
		enabled: isLayerVisible('bus-std') || isLayerVisible('bus-tb'),
	}));

	$effect(() => {
		if (map && busQuery.data) {
			const tbFeatures = busQuery.data.features.filter((f) => f.properties.type === 'bus-tb');
			loadTransportShieldIcons(map, tbFeatures, 'bus-tb');
		}
	});
</script>

<GeoJSONSource
	maxzoom={13}
	id="bus-data"
	data={busQuery.data || { type: 'FeatureCollection', features: [] }}
>
	<!-- Standard Bus (Bottom) -->
	<LineLayer
		id="bus-layer-std-contour"
		filter={['==', ['get', 'type'], 'bus-std']}
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('bus-std') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': '#FFFFFF',
			'line-width': 3,
			'line-opacity': 1,
		}}
	/>
	<LineLayer
		id="bus-layer-std"
		filter={['==', ['get', 'type'], 'bus-std']}
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('bus-std') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': ['get', 'color'],
			'line-width': 1.5,
			'line-opacity': 0.6,
		}}
	/>

	<LineLayer
		id="bus-layer-std-hitarea"
		filter={['==', ['get', 'type'], 'bus-std']}
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('bus-std') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': 'transparent',
			'line-width': 16,
			'line-opacity': 0,
		}}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	/>

	<!-- TB / C Lines (Top) -->
	<LineLayer
		id="bus-layer-tb-contour"
		filter={['==', ['get', 'type'], 'bus-tb']}
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('bus-tb') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': '#FFFFFF',
			'line-width': 5,
			'line-opacity': 1,
		}}
	/>
	<LineLayer
		id="bus-layer-tb"
		filter={['==', ['get', 'type'], 'bus-tb']}
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('bus-tb') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': ['get', 'color'],
			'line-width': 3,
			'line-opacity': 0.9,
		}}
	/>

	<LineLayer
		id="bus-layer-tb-hitarea"
		filter={['==', ['get', 'type'], 'bus-tb']}
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('bus-tb') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': 'transparent',
			'line-width': 20,
			'line-opacity': 0,
		}}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	/>

	<SymbolLayer
		id="bus-tb-labels"
		filter={['==', ['get', 'type'], 'bus-tb']}
		layout={{
			'icon-image': ['concat', 'bus-tb-shield-', ['get', 'ligne']],
			'icon-size': 0.35,
			'symbol-spacing': 250,
			'symbol-placement': 'line-center',
			'icon-rotation-alignment': 'viewport',
			'icon-pitch-alignment': 'viewport',
			visibility: isLayerVisible('bus-tb') ? 'visible' : 'none',
		}}
		paint={{
			'icon-opacity': 1,
		}}
	/>
</GeoJSONSource>
