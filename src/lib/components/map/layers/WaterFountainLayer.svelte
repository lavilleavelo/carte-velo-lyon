<script lang="ts">
	import { GeoJSONSource, SymbolLayer, CircleLayer, ImageLoader } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import FountainIcon from '$lib/assets/icons/fontaine.png?url';

	let { isLayerVisible, handleMouseEnter, handleMouseLeave } = $props();

	const fountainsQuery = createQuery(() => ({
		queryKey: ['fountains'],
		queryFn: async () => {
			const response = await fetch('/api/grandlyon/fountains');
			if (!response.ok) {
				throw new Error('Failed to fetch fountain data');
			}
			return await response.json();
		},
		staleTime: Infinity,
	}));

	const features = $derived(fountainsQuery.data?.features || []);
</script>

<ImageLoader images={{ fountain: FountainIcon }}>
	<GeoJSONSource
		id="fountains-source"
		data={{
			type: 'FeatureCollection',
			features: features,
		}}
	>
		<SymbolLayer
			id="fountains-layer"
			layout={{
				visibility: isLayerVisible('water-fountains') ? 'visible' : 'none',
				'icon-image': 'fountain',
				'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.2, 17, 0.5],
				'icon-allow-overlap': true,
			}}
		/>

		<CircleLayer
			id="fountains-layer-hitarea"
			layout={{
				visibility: isLayerVisible('water-fountains') ? 'visible' : 'none',
			}}
			paint={{
				'circle-opacity': 0,
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 12, 15, 18, 18, 24],
				'circle-color': 'transparent',
			}}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
		/>

		<SymbolLayer
			id="fountains-label"
			minzoom={15}
			layout={{
				visibility: isLayerVisible('water-fountains') ? 'visible' : 'none',
				'text-field': 'fontaine',
				'text-font': ['Open Sans Bold'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 15, 12, 18, 14],
				'text-offset': [0, 1.5],
				'text-anchor': 'top',
			}}
			paint={{
				'text-color': '#1d4ed8',
				'text-halo-color': '#ffffff',
				'text-halo-width': 2,
			}}
		/>
	</GeoJSONSource>
</ImageLoader>
