<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import CommuneMap from '$lib/components/map/CommuneMap.svelte';
	import InfrastructureEvolutionChart from '$lib/components/charts/InfrastructureEvolutionChart.svelte';
	import { getVeloscoreUrl } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const commune = $derived(data.commune);
	const bounds = $derived<[[number, number], [number, number]]>([
		[commune.bbox[0], commune.bbox[1]],
		[commune.bbox[2], commune.bbox[3]],
	]);
	const veloscoreUrl = $derived(getVeloscoreUrl(commune.name));
</script>

<svelte:head>
	<title>{commune.name} – Carte des aménagements cyclables</title>
</svelte:head>

<div class="space-y-6 py-4">
	<header class="flex flex-col gap-1">
		<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
			<h1 class="text-2xl font-bold text-brand-navy md:text-3xl">{commune.name}</h1>
			<a
				href={veloscoreUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="ml-auto inline-flex items-center gap-1.5 rounded-full border border-brand-navy/20 bg-white px-3 py-1.5 text-sm font-medium text-brand-navy shadow-sm transition-colors hover:border-brand-navy hover:bg-brand-navy hover:text-white"
			>
				Vélo-score
				<ExternalLink class="h-4 w-4" />
			</a>
		</div>
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
			<span>
				<span class="uppercase">INSEE</span>
				<span class="font-semibold text-gray-700">{commune.insee}</span>
			</span>
			{#if commune.codePostal}
				<span class="text-gray-300">·</span>
				<span>
					<span class="uppercase">Code postal</span>
					<span class="font-semibold text-gray-700">{commune.codePostal}</span>
				</span>
			{/if}
			{#if commune.surfaceKm2 !== null}
				<span class="text-gray-300">·</span>
				<span>
					<span class="uppercase">Surface</span>
					<span class="font-semibold text-gray-700">{commune.surfaceKm2}&nbsp;km²</span>
				</span>
			{/if}
		</div>
	</header>

	<div class="mx-[calc(50%-50vw)]">
		<CommuneMap boundary={data.boundary} {bounds} />
	</div>

	<InfrastructureEvolutionChart communeName={commune.name} boundary={data.boundary} />
</div>
