<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import CommuneMap from '$lib/components/map/CommuneMap.svelte';
	import InfrastructureEvolutionChart from '$lib/components/charts/InfrastructureEvolutionChart.svelte';
	import Ville30Indicator from '$lib/components/Ville30Indicator.svelte';
	import CommuneStatsIndicators from '$lib/components/CommuneStatsIndicators.svelte';
	import CommuneSafetyStats from '$lib/components/CommuneSafetyStats.svelte';
	import CommuneSummary from '$lib/components/CommuneSummary.svelte';
	import LavilleaveloCta from '$lib/components/LavilleaveloCta.svelte';
	import { getVeloscoreUrl } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const commune = $derived(data.commune);
	const metadata = $derived(data.metadata);
	const bounds = $derived<[[number, number], [number, number]]>([
		[commune.bbox[0], commune.bbox[1]],
		[commune.bbox[2], commune.bbox[3]],
	]);
	const veloscoreUrl = $derived(getVeloscoreUrl(commune.name));

	const populationFormatter = new Intl.NumberFormat('fr-FR');
	const population = $derived(metadata?.population ?? null);
	const populationYear = $derived(metadata?.populationYear ?? null);
	const density = $derived.by(() => {
		if (!population || !commune.surfaceKm2) return null;
		return Math.round(population / commune.surfaceKm2);
	});

	const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
	function formatArticleDate(date: string): string {
		const parsed = new Date(date);
		if (Number.isNaN(parsed.getTime())) return date;
		return dateFormatter.format(parsed);
	}
</script>

<div class="space-y-6 pb-4">
	<div class="mx-[calc(50%-50vw)]">
		<CommuneMap boundary={data.boundary} {bounds} communeName={commune.name} />
	</div>

	<div class="space-y-2">
		<header class="flex flex-wrap items-center gap-x-3 gap-y-2">
			<h1 class="text-2xl font-bold text-brand-navy md:text-3xl">{commune.name}</h1>
		</header>

		<dl class="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
			{#if commune.surfaceKm2 !== null}
				<div>
					<dt class="text-[10px] font-medium tracking-wider text-gray-400 uppercase">Surface</dt>
					<dd class="text-sm font-semibold text-gray-700">{commune.surfaceKm2}&nbsp;km²</dd>
				</div>
			{/if}
			{#if population !== null}
				<div>
					<dt class="text-[10px] font-medium tracking-wider text-gray-400 uppercase">
						Population{#if populationYear}
							<span class="text-gray-300">&nbsp;{populationYear}</span>
						{/if}
					</dt>
					<dd class="text-sm font-semibold text-gray-700">
						{populationFormatter.format(population)}
					</dd>
				</div>
			{/if}
			{#if density !== null}
				<div>
					<dt class="text-[10px] font-medium tracking-wider text-gray-400 uppercase">Densité</dt>
					<dd class="text-sm font-semibold text-gray-700">
						{populationFormatter.format(density)}&nbsp;<span class="font-normal text-gray-500"
							>hab/km²</span
						>
					</dd>
				</div>
			{/if}
			<div>
				<dt class="text-[10px] font-medium tracking-wider text-gray-400 uppercase">INSEE</dt>
				<dd class="text-sm font-semibold text-gray-700">
					{commune.insee}{#if commune.codePostal}
						<span class="font-normal text-gray-400">&nbsp;·&nbsp;{commune.codePostal}</span>
					{/if}
				</dd>
			</div>
			<div>
				<dt class="text-[10px] font-medium tracking-wider text-gray-400 uppercase">Liens</dt>
				<dd class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
					<a
						href={veloscoreUrl}
						target="_blank"
						rel="noopener"
						class="inline-flex items-center gap-1 font-semibold text-brand-navy hover:underline"
					>
						Vélo-score 2026
						<ExternalLink class="h-3 w-3" />
					</a>
					{#if metadata?.wikipediaUrl}
						<a
							href={metadata.wikipediaUrl}
							target="_blank"
							rel="noopener"
							class="inline-flex items-center gap-1 font-semibold text-brand-navy hover:underline"
						>
							Wikipédia
							<ExternalLink class="h-3 w-3" />
						</a>
					{/if}
				</dd>
			</div>
		</dl>
	</div>

	<CommuneSummary
		communeName={commune.name}
		stats={data.communeStats}
		ville30Stats={data.ville30Stats}
		osmSafetyStats={data.osmSafetyStats}
	/>

	{#if metadata?.articles && metadata.articles.length > 0}
		<section>
			<h2 class="mb-2 text-xs font-bold tracking-wider text-brand-navy uppercase">Articles liés</h2>
			<ul class="space-y-2">
				{#each metadata.articles as article (article.url)}
					<li>
						<a
							href={article.url}
							target="_blank"
							rel="noopener"
							class="group flex flex-col gap-0.5 rounded-md border border-gray-100 bg-white p-3 shadow-sm transition-colors hover:border-brand-navy/30 hover:bg-brand-navy/5"
						>
							<span class="flex items-start gap-2">
								<span class="text-sm font-semibold text-brand-navy group-hover:underline"
									>{article.title}</span
								>
								<ExternalLink class="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
							</span>
							<span class="text-xs text-gray-500">
								{formatArticleDate(article.date)}
								{#if article.author}
									· {article.author}
								{/if}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<CommuneStatsIndicators
		communeName={commune.name}
		stats={data.communeStats}
		osmSafetyStats={data.osmSafetyStats}
	/>

	<CommuneSafetyStats stats={data.osmSafetyStats} communeName={commune.name} />

	<Ville30Indicator communeName={commune.name} ville30={data.ville30} stats={data.ville30Stats} />

	{#if data.communeStats}
		<InfrastructureEvolutionChart
			communeName={commune.name}
			chart={data.communeStats.chart}
			totalBikeLanesKm={data.communeStats.totalBikeLanesKm}
			totalParkingPlaces={data.communeStats.parkingPlaces}
		/>
	{/if}

	<LavilleaveloCta />
</div>
