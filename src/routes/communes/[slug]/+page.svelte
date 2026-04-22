<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CommuneMap from '$lib/components/map/CommuneMap.svelte';
	import InfrastructureEvolutionChart from '$lib/components/charts/InfrastructureEvolutionChart.svelte';
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

	<CommuneMap boundary={data.boundary} {bounds} />

	<InfrastructureEvolutionChart communeName={commune.name} boundary={data.boundary} />
</div>
