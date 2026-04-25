<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import CommuneMap from '$lib/components/map/CommuneMap.svelte';
	import InfrastructureEvolutionChart from '$lib/components/charts/InfrastructureEvolutionChart.svelte';
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
	const population = $derived(metadata?.population2022 ?? metadata?.population2021 ?? null);
	const populationYear = $derived(
		metadata?.population2022 ? 2022 : metadata?.population2021 ? 2021 : null,
	);
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
			{#if population !== null}
				<span class="text-gray-300">·</span>
				<span>
					<span class="uppercase">Population</span>
					<span class="font-semibold text-gray-700">{populationFormatter.format(population)}</span>
					{#if populationYear}
						<span class="text-gray-400">({populationYear})</span>
					{/if}
				</span>
			{/if}
			{#if density !== null}
				<span class="text-gray-300">·</span>
				<span>
					<span class="uppercase">Densité</span>
					<span class="font-semibold text-gray-700"
						>{populationFormatter.format(density)}&nbsp;hab/km²</span
					>
				</span>
			{/if}
			{#if metadata?.wikipediaUrl}
				<span class="text-gray-300">·</span>
				<a
					href={metadata.wikipediaUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1 font-semibold text-brand-navy hover:underline"
				>
					Wikipédia
					<ExternalLink class="h-3 w-3" />
				</a>
			{/if}
		</div>
	</header>

	<div class="mx-[calc(50%-50vw)]">
		<CommuneMap boundary={data.boundary} {bounds} />
	</div>

	{#if metadata?.articles && metadata.articles.length > 0}
		<section>
			<h2 class="mb-2 text-xs font-bold tracking-wider text-brand-navy uppercase">Articles liés</h2>
			<ul class="space-y-2">
				{#each metadata.articles as article (article.url)}
					<li>
						<a
							href={article.url}
							target="_blank"
							rel="noopener noreferrer"
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

	<InfrastructureEvolutionChart communeName={commune.name} boundary={data.boundary} />
</div>
