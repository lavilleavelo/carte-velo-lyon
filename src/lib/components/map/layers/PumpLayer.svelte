<script lang="ts">
	import { GeoJSONSource, CircleLayer, SymbolLayer, ImageLoader } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import PumpIcon from '$lib/assets/icons/pump.png?url';
	import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
	import type { FeatureCollection } from 'geojson';

	let {
		isLayerVisible,
		handleMouseEnter,
		handleMouseLeave,
		boundary,
	}: {
		isLayerVisible: (id: string) => boolean;
		handleMouseEnter: () => void;
		handleMouseLeave: () => void;
		boundary?: FeatureCollection;
	} = $props();

	const pumpsQuery = createQuery(() => ({
		queryKey: ['pumps'],
		queryFn: async () => {
			const response = await fetch('/api/grandlyon/pumps');
			if (!response.ok) {
				throw new Error('Failed to fetch pump data');
			}
			return await response.json();
		},
		staleTime: Infinity,
		enabled: isLayerVisible('pumps'),
		meta: { loadingLabel: 'Pompes' },
	}));

	const pumpsData = $derived.by(() => {
		const base = pumpsQuery.data ?? { type: 'FeatureCollection' as const, features: [] };
		if (!boundary) {
			return base;
		}

		return filterFeaturesInsideBoundary(base, boundary);
	});
	const features = $derived(pumpsData.features || []);
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
		/>

		<CircleLayer
			id="pumps-layer-hitarea"
			layout={{
				visibility: isLayerVisible('pumps') ? 'visible' : 'none',
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
