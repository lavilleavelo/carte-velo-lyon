<script lang="ts">
	import {
		MapLibre,
		AttributionControl,
		NavigationControl,
		GeoJSONSource,
		LineLayer,
		FillLayer,
	} from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { createMapStyleState } from '$lib/utils/mapStyleToggle.svelte';
	import MapStyleToggle from '$lib/components/map/MapStyleToggle.svelte';
	import CyclewayLayer from '$lib/components/map/layers/CyclewayLayer.svelte';
	import CyclewayLegend from '$lib/components/map/CyclewayLegend.svelte';
	import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const bounds = $derived<[[number, number], [number, number]]>([
		[data.bbox[0], data.bbox[1]],
		[data.bbox[2], data.bbox[3]],
	]);

	const mapStyleState = createMapStyleState('neutrino');

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
		return filterFeaturesInsideBoundary(voirieQuery.data, data.boundary);
	});
</script>

<svelte:head>
	<title>Lyon (ville) – Carte des aménagements cyclables</title>
</svelte:head>

<div class="space-y-6 py-6">
	<header class="flex flex-col gap-3">
		<a
			href="/communes"
			class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-navy"
		>
			<ArrowLeft class="h-4 w-4" />
			Retour aux communes
		</a>
		<h1 class="text-3xl font-bold text-brand-navy md:text-4xl">Lyon</h1>
		<p class="text-gray-600">
			Vue d'ensemble des {data.arrondissementCount} arrondissements de la ville de Lyon.
		</p>
	</header>

	<dl class="grid grid-cols-2 gap-4 rounded-lg bg-white p-4 shadow sm:grid-cols-3">
		<div>
			<dt class="text-xs text-gray-500 uppercase">Code INSEE</dt>
			<dd class="text-base font-semibold">69123</dd>
		</div>
		<div>
			<dt class="text-xs text-gray-500 uppercase">Codes postaux</dt>
			<dd class="text-base font-semibold">69001–69009</dd>
		</div>
		<div>
			<dt class="text-xs text-gray-500 uppercase">Arrondissements</dt>
			<dd class="text-base font-semibold">{data.arrondissementCount}</dd>
		</div>
	</dl>

	<div class="h-[60vh] min-h-80 overflow-hidden rounded-lg shadow">
		<MapLibre
			class="h-full w-full"
			style={mapStyleState.getMapStyleUrl()}
			{bounds}
			fitBoundsOptions={{ padding: 24 }}
			attributionControl={false}
			maxZoom={18}
		>
			<AttributionControl compact={true} position="bottom-left" />
			<NavigationControl position="top-right" showCompass={false} />
			<MapStyleToggle
				currentStyle={mapStyleState.mapStyle}
				onSelect={mapStyleState.setMapStyle}
				position="top-right"
			/>

			<GeoJSONSource id="lyon-boundary" data={data.boundary}>
				<FillLayer
					id="lyon-fill"
					paint={{
						'fill-color': '#1e3a5f',
						'fill-opacity': 0.08,
					}}
				/>
				<LineLayer
					id="lyon-outline"
					paint={{
						'line-color': '#1e3a5f',
						'line-width': 3,
						'line-opacity': 0.9,
					}}
				/>
			</GeoJSONSource>

			<CyclewayLayer isLayerVisible={() => true} voirieData={voirieInside} />
		</MapLibre>
	</div>

	<CyclewayLegend />
</div>
