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
	import YearRangeFilter from '$lib/components/map/YearRangeFilter.svelte';
	import { filterFeaturesByYear, filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
	import type { FeatureCollection } from 'geojson';
	import type maplibregl from 'maplibre-gl';

	const MIN_YEAR = 2000;
	const MAX_YEAR = new Date().getFullYear();

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
		yearFrom: type('number').default(() => MIN_YEAR),
		yearTo: type('number').default(() => MAX_YEAR),
	});

	const params = useSearchParams(paramsSchema, { pushHistory: false });

	const yearRange = $derived<[number, number]>([params.yearFrom, params.yearTo]);
	const isFullYearRange = $derived(params.yearFrom <= MIN_YEAR && params.yearTo >= MAX_YEAR);

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
		let filtered = filterFeaturesInsideBoundary(voirieQuery.data, boundary);
		if (!isFullYearRange) {
			filtered = filterFeaturesByYear(filtered, 'anneelivraison', yearRange);
		}
		return filtered;
	});
</script>

<div class="relative h-[60vh] min-h-80 overflow-hidden rounded-lg shadow">
	{#if voirieQuery.isPending && params.layers.includes('cycleways')}
		<div
			class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/40 backdrop-blur-[1px]"
			role="status"
			aria-live="polite"
		>
			<div
				class="pointer-events-auto flex items-center gap-3 rounded-full bg-white px-4 py-2 shadow-md"
			>
				<span
					class="block h-4 w-4 animate-spin rounded-full border-2 border-brand-navy border-t-transparent"
					aria-hidden="true"
				></span>
				<span class="text-sm font-medium text-brand-navy">
					Chargement des aménagements cyclables…
				</span>
			</div>
		</div>
	{/if}

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

		<CommuneMapLayers
			layers={params.layers}
			{boundary}
			{map}
			yearRange={isFullYearRange ? undefined : yearRange}
		/>
	</MapLibre>
</div>

<YearRangeFilter
	range={yearRange}
	min={MIN_YEAR}
	max={MAX_YEAR}
	onRangeChange={(next) => {
		params.yearFrom = next[0];
		params.yearTo = next[1];
	}}
/>

<CommuneLayerToggles bind:layers={params.layers} toggles={layerToggles} />

<CyclewayLegend />
