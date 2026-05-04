<script lang="ts">
	import { GeoJSONSource, LineLayer, SymbolLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import { processBusData, loadTransportShieldIcons } from '$lib/utils/mapUtils';
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
		enabled: isLayerVisible('bus-other') || isLayerVisible('bus-main') || isLayerVisible('bus-tb'),
		meta: { loadingLabel: 'Bus' },
	}));

	$effect(() => {
		if (map && busQuery.data) {
			const mainFeatures = busQuery.data.features.filter((f) => f.properties.type === 'bus-main');
			loadTransportShieldIcons(map, mainFeatures, 'bus-main');

			const tbFeatures = busQuery.data.features.filter((f) => f.properties.type === 'bus-tb');
			loadTransportShieldIcons(map, tbFeatures, 'bus-tb');
		}
	});

	const visibleData = $derived.by<FeatureCollection>(() => {
		const raw = busQuery.data;
		if (!raw) return { type: 'FeatureCollection', features: [] };
		return boundary ? filterFeaturesInsideBoundary(raw, boundary) : raw;
	});
</script>

<GeoJSONSource maxzoom={12} tolerance={1.2} buffer={64} id="bus-data" data={visibleData}>
	<!-- Other bus lines (Bottom) -->
	<LineLayer
		id="bus-layer-other-contour"
		minzoom={11}
		filter={['==', ['get', 'type'], 'bus-other']}
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('bus-other') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': '#FFFFFF',
			'line-width': 4.5,
			'line-opacity': 1,
		}}
	/>
	<LineLayer
		id="bus-layer-other"
		minzoom={11}
		filter={['==', ['get', 'type'], 'bus-other']}
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('bus-other') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': ['get', 'color'],
			'line-width': 2.5,
			'line-opacity': 0.8,
		}}
	/>

	<LineLayer
		id="bus-layer-other-hitarea"
		minzoom={12}
		filter={['==', ['get', 'type'], 'bus-other']}
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('bus-other') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': 'transparent',
			'line-width': 16,
			'line-opacity': 0,
		}}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	/>

	<!-- Main lines (Lignes C — Top) -->
	<LineLayer
		id="bus-layer-main-contour"
		filter={['==', ['get', 'type'], 'bus-main']}
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('bus-main') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': '#FFFFFF',
			'line-width': 5,
			'line-opacity': 1,
		}}
	/>
	<LineLayer
		id="bus-layer-main"
		filter={['==', ['get', 'type'], 'bus-main']}
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('bus-main') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': ['get', 'color'],
			'line-width': 3,
			'line-opacity': 0.9,
		}}
	/>

	<LineLayer
		id="bus-layer-main-hitarea"
		minzoom={11}
		filter={['==', ['get', 'type'], 'bus-main']}
		layout={{
			'line-join': 'round',
			'line-cap': 'round',
			visibility: isLayerVisible('bus-main') ? 'visible' : 'none',
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
		id="bus-main-labels"
		minzoom={11}
		filter={['==', ['get', 'type'], 'bus-main']}
		layout={{
			'icon-image': ['concat', 'bus-main-shield-', ['get', 'ligne']],
			'icon-size': 0.35,
			'symbol-spacing': 350,
			'symbol-placement': 'line-center',
			'icon-rotation-alignment': 'viewport',
			'icon-pitch-alignment': 'viewport',
			'icon-allow-overlap': false,
			visibility: isLayerVisible('bus-main') ? 'visible' : 'none',
		}}
		paint={{
			'icon-opacity': 1,
		}}
	/>

	<!-- Tram-Bus / BHNS (TB lines — Top, grouped with Métro/Tram) -->
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
		minzoom={11}
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
		minzoom={11}
		filter={['==', ['get', 'type'], 'bus-tb']}
		layout={{
			'icon-image': ['concat', 'bus-tb-shield-', ['get', 'ligne']],
			'icon-size': 0.35,
			'symbol-spacing': 350,
			'symbol-placement': 'line-center',
			'icon-rotation-alignment': 'viewport',
			'icon-pitch-alignment': 'viewport',
			'icon-allow-overlap': false,
			visibility: isLayerVisible('bus-tb') ? 'visible' : 'none',
		}}
		paint={{
			'icon-opacity': 1,
		}}
	/>
</GeoJSONSource>
