<script lang="ts">
	import { GeoJSONSource, LineLayer, SymbolLayer, CircleLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import { processTransportData, loadTransportShieldIcons } from '$lib/utils/mapUtils';
	import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
	import type { FeatureCollection } from 'geojson';

	let {
		isLayerVisible,
		handleMouseEnter,
		handleMouseLeave,
		map,
		boundary,
	}: {
		isLayerVisible: (id: string) => boolean;
		handleMouseEnter?: () => void;
		handleMouseLeave?: () => void;
		map?: import('maplibre-gl').Map;
		boundary?: FeatureCollection;
	} = $props();

	const tramQuery = createQuery(() => ({
		queryKey: ['tram'],
		queryFn: async () => {
			const response = await fetch('/api/grandlyon/tram');
			if (!response.ok) {
				throw new Error('Failed to fetch tram data');
			}
			const data = await response.json();
			return processTransportData(data.features);
		},
		staleTime: Infinity,
		enabled: isLayerVisible('tram'),
		meta: { loadingLabel: 'Tramway' },
	}));

	$effect(() => {
		if (map && tramQuery.data) {
			loadTransportShieldIcons(map, tramQuery.data.features, 'tram');
		}
	});

	const visibleData = $derived.by<FeatureCollection>(() => {
		const raw = tramQuery.data;
		if (!raw) return { type: 'FeatureCollection', features: [] };
		return boundary ? filterFeaturesInsideBoundary(raw, boundary) : raw;
	});
</script>

<GeoJSONSource maxzoom={13} id="tram-data" data={visibleData}>
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
	/>

	<LineLayer
		id="tram-layer-hitarea"
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('tram') ? 'visible' : 'none',
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
	source="osm-vector"
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
