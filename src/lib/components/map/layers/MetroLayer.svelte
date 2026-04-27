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

	const metroQuery = createQuery(() => ({
		queryKey: ['metro'],
		queryFn: async () => {
			const response = await fetch('/api/grandlyon/metro');
			if (!response.ok) {
				throw new Error('Failed to fetch metro data');
			}
			const data = await response.json();
			return processTransportData(data.features);
		},
		staleTime: Infinity,
		enabled: isLayerVisible('metro'),
		meta: { loadingLabel: 'Métro' },
	}));

	$effect(() => {
		if (map && metroQuery.data) {
			loadTransportShieldIcons(map, metroQuery.data.features, 'metro');
		}
	});

	const visibleData = $derived.by<FeatureCollection>(() => {
		const raw = metroQuery.data;
		if (!raw) return { type: 'FeatureCollection', features: [] };
		return boundary ? filterFeaturesInsideBoundary(raw, boundary) : raw;
	});
</script>

<GeoJSONSource maxzoom={13} id="metro-data" data={visibleData}>
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
	/>

	<LineLayer
		id="metro-layer-hitarea"
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('metro') ? 'visible' : 'none',
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

<CircleLayer
	id="metro-stops"
	source="openmaptiles"
	source-layer="poi"
	filter={['all', ['==', 'class', 'railway'], ['==', 'subclass', 'subway']]}
	minzoom={13}
	layout={{
		visibility: isLayerVisible('metro') ? 'visible' : 'none',
	}}
	paint={{
		'circle-color': '#FFFFFF',
		'circle-radius': 5,
		'circle-stroke-width': 2,
		'circle-stroke-color': '#D53032',
	}}
/>

<SymbolLayer
	id="metro-stop-labels"
	source="openmaptiles"
	source-layer="poi"
	filter={['all', ['==', 'class', 'railway'], ['==', 'subclass', 'subway']]}
	minzoom={14}
	layout={{
		'text-field': ['get', 'name'],
		'text-size': 12,
		'text-offset': [0, 1.5],
		'text-anchor': 'top',
		'text-optional': true,
		'text-allow-overlap': false,
		visibility: isLayerVisible('metro') ? 'visible' : 'none',
	}}
	paint={{
		'text-color': '#333333',
		'text-halo-color': '#FFFFFF',
		'text-halo-width': 1.5,
	}}
/>
