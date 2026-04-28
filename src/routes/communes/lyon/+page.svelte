<script lang="ts">
	import CommuneMap from '$lib/components/map/CommuneMap.svelte';
	import InfrastructureEvolutionChart from '$lib/components/charts/InfrastructureEvolutionChart.svelte';
	import Ville30Indicator from '$lib/components/Ville30Indicator.svelte';
	import CommuneStatsIndicators from '$lib/components/CommuneStatsIndicators.svelte';
	import LavilleaveloCta from '$lib/components/LavilleaveloCta.svelte';
	import { LYON_INSEE } from '$lib/config/lyon';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const bounds = $derived<[[number, number], [number, number]]>([
		[data.bbox[0], data.bbox[1]],
		[data.bbox[2], data.bbox[3]],
	]);
</script>

<div class="space-y-6 pb-4">
	<div class="mx-[calc(50%-50vw)]">
		<CommuneMap boundary={data.boundary} {bounds} communeName="Lyon" />
	</div>

	<div class="space-y-2">
		<header class="flex flex-wrap items-center gap-x-3 gap-y-2">
			<h1 class="text-2xl font-bold text-brand-navy md:text-3xl">Lyon</h1>
		</header>

		<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
			<span>
				<span class="uppercase">INSEE</span>
				<span class="font-semibold text-gray-700">{LYON_INSEE}</span>
			</span>
			<span class="text-gray-300">·</span>
			<span>
				<span class="uppercase">Codes postaux</span>
				<span class="font-semibold text-gray-700">69001–69009</span>
			</span>
			<span class="text-gray-300">·</span>
			<span>
				<span class="uppercase">Arrondissements</span>
				<span class="font-semibold text-gray-700">{data.arrondissementCount}</span>
			</span>
		</div>
	</div>

	<Ville30Indicator
		communeName="Lyon"
		ville30={data.ville30}
		stats={data.ville30Stats}
	/>

	<CommuneStatsIndicators communeName="Lyon" stats={data.communeStats} />

	{#if data.communeStats}
		<InfrastructureEvolutionChart
			communeName="Lyon"
			chart={data.communeStats.chart}
			totalBikeLanesKm={data.communeStats.totalBikeLanesKm}
			totalParkingPlaces={data.communeStats.parkingPlaces}
		/>
	{/if}

	<LavilleaveloCta />
</div>
