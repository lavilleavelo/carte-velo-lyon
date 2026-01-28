<script lang="ts">
	import { GeoJSONSource, CircleLayer, SymbolLayer, ImageLoader } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import PumpIcon from '$lib/assets/icons/pump.png?url';

	let { isLayerVisible, handleMouseEnter, handleMouseLeave } = $props();

	const pumpsQuery = createQuery(() => ({
		queryKey: ['pumps'],
		queryFn: async () => {
			const response = await fetch(
				'https://data.grandlyon.com/geoserver/metropole-de-lyon/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=metropole-de-lyon:pvo_patrimoine_voirie.pvostationvelovpompe&outputFormat=application/json&SRSNAME=EPSG:4171&sortBy=gid',
			);
			if (!response.ok) {
				throw new Error('Failed to fetch pump data');
			}
			return await response.json();
		},
		staleTime: Infinity,
	}));

	const features = $derived(pumpsQuery.data?.features || []);
</script>

<ImageLoader images={{ pump: PumpIcon }}>
	<GeoJSONSource
		id="pumps-source"
		data={{
			type: 'FeatureCollection',
			features: features,
		}}
	>
		<SymbolLayer
			id="pumps-layer"
			layout={{
				visibility: isLayerVisible('pumps') ? 'visible' : 'none',
				'icon-image': 'pump',
				'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.3, 17, 0.7],
				'icon-allow-overlap': true,
			}}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
		/>

		<SymbolLayer
			id="pumps-label"
			minzoom={15}
			layout={{
				visibility: isLayerVisible('pumps') ? 'visible' : 'none',
				'text-field': 'Pompe',
				'text-font': ['Open Sans Bold'],
				'text-size': 12,
				'text-offset': [0, 1.5],
				'text-anchor': 'top',
			}}
			paint={{
				'text-color': '#be123c',
				'text-halo-color': '#ffffff',
				'text-halo-width': 2,
			}}
		/>
	</GeoJSONSource>
</ImageLoader>
