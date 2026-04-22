<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
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

<div class="space-y-6 py-6">
	<header class="flex flex-col gap-3">
		<a
			href="/communes"
			class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-navy"
		>
			<ArrowLeft class="h-4 w-4" />
			Retour aux communes
		</a>
		<div class="flex flex-wrap items-baseline justify-between gap-3">
			<h1 class="text-3xl font-bold text-brand-navy md:text-4xl">{commune.name}</h1>
			<a
				href={veloscoreUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center gap-1.5 rounded-full border border-brand-navy/20 bg-white px-3 py-1.5 text-sm font-medium text-brand-navy shadow-sm transition-colors hover:border-brand-navy hover:bg-brand-navy hover:text-white"
			>
				Voir le vélo-score
				<ExternalLink class="h-4 w-4" />
			</a>
		</div>
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

	<CommuneMap boundary={data.boundary} {bounds} />

	<InfrastructureEvolutionChart communeName={commune.name} boundary={data.boundary} />
</div>
