<script lang="ts">
	import { GeoJSONSource, LineLayer, SymbolLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import { processTransportData, loadTransportShieldIcons } from '$lib/utils/mapUtils';

	let { isLayerVisible, handleMouseEnter, handleMouseLeave, map } = $props();

	const metroQuery = createQuery(() => ({
		queryKey: ['metro'],
		queryFn: async () => {
			const response = await fetch(
				'https://data.grandlyon.com/geoserver/sytral/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=sytral:tcl_sytral.tcllignemf_2_0_0&outputFormat=application/json&SRSNAME=EPSG:4171&sortBy=gid',
			);
			if (!response.ok) {
				throw new Error('Failed to fetch metro data');
			}
			const data = await response.json();
			return processTransportData(data.features);
		},
		staleTime: Infinity,
	}));

	$effect(() => {
		if (map && metroQuery.data) {
			loadTransportShieldIcons(map, metroQuery.data.features, 'metro');
		}
	});
</script>

<GeoJSONSource
	maxzoom={16}
	id="metro-data"
	data={metroQuery.data || { type: 'FeatureCollection', features: [] }}
>
	<LineLayer
		id="metro-layer-contour"
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('metro') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': '#FFFFFF',
			'line-width': 6,
			'line-opacity': 1,
		}}
	/>
	<LineLayer
		id="metro-layer"
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('metro') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': ['get', 'color'],
			'line-width': 4,
			'line-opacity': 0.8,
		}}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	/>

	<SymbolLayer
		id="metro-labels"
		layout={{
			'icon-image': ['concat', 'metro-shield-', ['get', 'ligne']],
			'icon-size': 0.4,
			'symbol-spacing': 200,
			'symbol-placement': 'line-center',
			'icon-rotation-alignment': 'viewport',
			'icon-pitch-alignment': 'viewport',
			visibility: isLayerVisible('metro') ? 'visible' : 'none',
		}}
		paint={{
			'icon-opacity': 1,
		}}
	/>
</GeoJSONSource>
