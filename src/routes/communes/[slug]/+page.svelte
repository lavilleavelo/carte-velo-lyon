<script lang="ts">
	import {
		MapLibre,
		AttributionControl,
		NavigationControl,
		GeoJSONSource,
		LineLayer,
		FillLayer,
	} from 'svelte-maplibre-gl';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { MAP_STYLES } from '$lib/utils/mapStyleToggle.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const commune = $derived(data.commune);
	const bounds = $derived<[[number, number], [number, number]]>([
		[commune.bbox[0], commune.bbox[1]],
		[commune.bbox[2], commune.bbox[3]],
	]);
</script>

<svelte:head>
	<title>{commune.name} – Carte des aménagements cyclables</title>
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
		<h1 class="text-3xl font-bold text-brand-navy md:text-4xl">{commune.name}</h1>
	</header>

	<dl class="grid grid-cols-2 gap-4 rounded-lg bg-white p-4 shadow sm:grid-cols-3">
		<div>
			<dt class="text-xs text-gray-500 uppercase">Code INSEE</dt>
			<dd class="text-base font-semibold">{commune.insee}</dd>
		</div>
		{#if commune.surfaceKm2 !== null}
			<div>
				<dt class="text-xs text-gray-500 uppercase">Surface</dt>
				<dd class="text-base font-semibold">{commune.surfaceKm2} km²</dd>
			</div>
		{/if}
	</dl>

	<div class="h-[60vh] min-h-80 overflow-hidden rounded-lg shadow">
		<MapLibre
			class="h-full w-full"
			style={MAP_STYLES.positron}
			{bounds}
			fitBoundsOptions={{ padding: 24 }}
			attributionControl={false}
			maxZoom={18}
		>
			<AttributionControl compact={true} position="bottom-left" />
			<NavigationControl position="top-right" showCompass={false} />

			<GeoJSONSource id="commune-boundary" data={data.boundary}>
				<FillLayer
					id="commune-fill"
					paint={{
						'fill-color': '#1e3a5f',
						'fill-opacity': 0.08,
					}}
				/>
				<LineLayer
					id="commune-outline"
					paint={{
						'line-color': '#1e3a5f',
						'line-width': 3,
						'line-opacity': 0.9,
					}}
				/>
			</GeoJSONSource>
		</MapLibre>
	</div>
</div>
