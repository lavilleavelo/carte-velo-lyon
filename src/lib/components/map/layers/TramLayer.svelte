<script lang="ts">
	import { GeoJSONSource, LineLayer, SymbolLayer, CircleLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import { processTransportData, loadTransportShieldIcons } from '$lib/utils/mapUtils';

	let { isLayerVisible, handleMouseEnter, handleMouseLeave, map } = $props();

	const tramQuery = createQuery(() => ({
		queryKey: ['tram'],
		queryFn: async () => {
			const response = await fetch(
				'https://data.grandlyon.com/geoserver/sytral/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=sytral:tcl_sytral.tcllignetram_2_0_0&outputFormat=application/json&SRSNAME=EPSG:4171&sortBy=gid',
			);
			if (!response.ok) {
				throw new Error('Failed to fetch tram data');
			}
			const data = await response.json();
			return processTransportData(data.features);
		},
		staleTime: Infinity,
	}));

	$effect(() => {
		if (map && tramQuery.data) {
			loadTransportShieldIcons(map, tramQuery.data.features, 'tram');
		}
	});
</script>

<GeoJSONSource
	maxzoom={16}
	id="tram-data"
	data={tramQuery.data || { type: 'FeatureCollection', features: [] }}
>
	<LineLayer
		id="tram-layer-contour"
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('tram') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': '#FFFFFF',
			'line-width': 5,
			'line-opacity': 1,
		}}
	/>
	<LineLayer
		id="tram-layer"
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('tram') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': ['get', 'color'],
			'line-width': 3,
			'line-opacity': 0.8,
		}}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	/>

	<SymbolLayer
		id="tram-labels"
		layout={{
			'icon-image': ['concat', 'tram-shield-', ['get', 'ligne']],
			'icon-size': 0.35,
			'symbol-spacing': 250,
			'symbol-placement': 'line-center',
			'icon-rotation-alignment': 'viewport',
			'icon-pitch-alignment': 'viewport',
			visibility: isLayerVisible('tram') ? 'visible' : 'none',
		}}
		paint={{
			'icon-opacity': 1,
		}}
	/>
</GeoJSONSource>

<CircleLayer
	id="tram-stops"
	source="openmaptiles"
	source-layer="poi"
	filter={['all', ['==', 'class', 'railway'], ['==', 'subclass', 'tram_stop']]}
	minzoom={13}
	layout={{
		visibility: isLayerVisible('tram') ? 'visible' : 'none',
	}}
	paint={{
		'circle-color': '#FFFFFF',
		'circle-radius': 4.5,
		'circle-stroke-width': 2,
		'circle-stroke-color': '#933591',
	}}
/>
