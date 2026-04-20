<script lang="ts">
	import {
		MapLibre,
		AttributionControl,
		NavigationControl,
		FullScreenControl,
		GeoJSONSource,
		LineLayer,
		FillLayer,
	} from 'svelte-maplibre-gl';
	import { untrack } from 'svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { useSearchParams } from 'runed/kit';
	import { type } from 'arktype';
	import { createMapStyleState, MAP_STYLE_IDS } from '$lib/utils/mapStyleToggle.svelte';
	import MapStyleToggle from '$lib/components/map/MapStyleToggle.svelte';
	import CyclewayLayer from '$lib/components/map/layers/CyclewayLayer.svelte';
	import CyclewayLegend from '$lib/components/map/CyclewayLegend.svelte';
	import CommuneMapLayers from '$lib/components/map/CommuneMapLayers.svelte';
	import CommuneLayerToggles from '$lib/components/map/CommuneLayerToggles.svelte';
	import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
	import type { FeatureCollection } from 'geojson';
	import type maplibregl from 'maplibre-gl';

	let {
		boundary,
		bounds,
	}: {
		boundary: FeatureCollection;
		bounds: [[number, number], [number, number]];
	} = $props();

	let map: maplibregl.Map | undefined = $state();

	const paramsSchema = type({
		layers: type('string[]').default(() => ['cycleways']),
		mapStyle: type.enumerated(...MAP_STYLE_IDS).default(() => 'neutrino'),
	});

	const params = useSearchParams(paramsSchema, { pushHistory: false });

	const layerToggles = [
		{ id: 'cycleways', label: 'Aménagements cyclables' },
		{ id: 'vl', label: 'Voies Lyonnaises' },
		{ id: 'velov', label: 'Vélo’v' },
		{ id: 'parking', label: 'Stationnement' },
		{ id: 'pumps', label: 'Pompes' },
		{ id: 'fountains', label: 'Fontaines' },
	];

	const mapStyleState = createMapStyleState(params.mapStyle, (style) => {
		params.mapStyle = style;
	});

	$effect(() => {
		const pMapStyle = params.mapStyle;
		untrack(() => {
			if (pMapStyle !== mapStyleState.mapStyle) {
				mapStyleState.mapStyle = pMapStyle;
			}
		});
	});

	const voirieQuery = createQuery(() => ({
		queryKey: ['voirie-data'],
		queryFn: async () => {
			const response = await fetch('/api/grandlyon/voirie');
			if (!response.ok) throw new Error('Failed to fetch voirie data');
			return response.json();
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
	}));

	const voirieInside = $derived.by(() => {
		if (!voirieQuery.data) return undefined;
		return filterFeaturesInsideBoundary(voirieQuery.data, boundary);
	});
</script>

<div class="h-[60vh] min-h-80 overflow-hidden rounded-lg shadow">
	<MapLibre
		bind:map
		class="h-full w-full"
		style={mapStyleState.getMapStyleUrl()}
		{bounds}
		fitBoundsOptions={{ padding: 24 }}
		attributionControl={false}
		maxZoom={18}
	>
		<AttributionControl compact={true} position="bottom-left" />
		<NavigationControl position="top-right" showCompass={false} />
		<FullScreenControl position="top-right" />
		<MapStyleToggle
			currentStyle={mapStyleState.mapStyle}
			onSelect={mapStyleState.setMapStyle}
			position="top-right"
		/>

		<GeoJSONSource id="commune-boundary" data={boundary}>
			<FillLayer id="commune-fill" paint={{ 'fill-color': '#1e3a5f', 'fill-opacity': 0.08 }} />
			<LineLayer
				id="commune-outline"
				paint={{ 'line-color': '#1e3a5f', 'line-width': 3, 'line-opacity': 0.9 }}
			/>
		</GeoJSONSource>

		<CyclewayLayer
			isLayerVisible={(id) => id === 'cycleways' && params.layers.includes('cycleways')}
			voirieData={voirieInside}
		/>

		<CommuneMapLayers layers={params.layers} {boundary} {map} />
	</MapLibre>
</div>

<CommuneLayerToggles bind:layers={params.layers} toggles={layerToggles} />

<CyclewayLegend />
