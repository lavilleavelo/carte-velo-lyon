<script lang="ts">
	import ParkingSquare from '@lucide/svelte/icons/parking-square';
	import Route from '@lucide/svelte/icons/route';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import type { CommuneRanking, CommuneStats, RankingTier } from '$lib/server/communeStats';
	import type { OsmSafetyStats } from '$lib/server/communeOsmStats';

	let {
		communeName,
		stats = null,
		osmSafetyStats = null,
	}: {
		communeName: string;
		stats?: CommuneStats | null;
		osmSafetyStats?: OsmSafetyStats | null;
	} = $props();

	const osmTotalBikeLanesKm = $derived<number | null>(osmSafetyStats?.totalKm ?? null);

	const effectiveTotalBikeLanesKm = $derived<number | null>(
		osmTotalBikeLanesKm ?? stats?.totalBikeLanesKm ?? null,
	);
	const effectiveBikeInfraRatio = $derived.by<number | null>(() => {
		if (osmTotalBikeLanesKm !== null && stats?.eligibleRoadwayKm) {
			return (osmTotalBikeLanesKm / stats.eligibleRoadwayKm) * 100;
		}
		return stats?.bikeInfraPer100kmRoadway ?? null;
	});
	const usingOsmTotal = $derived(osmTotalBikeLanesKm !== null);

	const populationFormatter = new Intl.NumberFormat('fr-FR');
	const decimalFormatter = new Intl.NumberFormat('fr-FR', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
	const wholeFormatter = new Intl.NumberFormat('fr-FR', {
		maximumFractionDigits: 0,
	});

	const anyRanking = $derived(
		stats?.rankings?.bikeInfraPer100kmRoadway ??
			stats?.rankings?.recentBikeLanesPer100kmRoadway ??
			stats?.rankings?.parkingPer1000 ??
			stats?.rankings?.recentParkingPer1000 ??
			null,
	);

	const tierClasses: Record<RankingTier, string> = {
		top: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
		good: 'bg-sky-100 text-sky-700 ring-sky-200',
		mid: 'bg-amber-100 text-amber-700 ring-amber-200',
		low: 'bg-rose-100 text-rose-700 ring-rose-200',
	};
	const tierDots: Record<RankingTier, string> = {
		top: 'bg-emerald-500',
		good: 'bg-sky-500',
		mid: 'bg-amber-500',
		low: 'bg-rose-500',
	};
	const tierLabels: Record<RankingTier, string> = {
		top: 'Top 25%',
		good: 'Au-dessus de la médiane',
		mid: 'Sous la médiane',
		low: 'Bas 25%',
	};
</script>

{#snippet rankBadge(ranking: CommuneRanking | null)}
	{#if ranking}
		<span
			class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset {tierClasses[
				ranking.tier
			]}"
			title={tierLabels[ranking.tier]}
		>
			<span class="size-1.5 rounded-full {tierDots[ranking.tier]}" aria-hidden="true"></span>
			<span>{ranking.rank}<sup>e</sup> sur {ranking.total}</span>
		</span>
	{/if}
{/snippet}

{#if stats}
	<section class="space-y-3">
		<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
			<h2 class="text-xl font-bold text-brand-navy">Indicateurs vélo</h2>
			{#if stats.population && stats.populationYear}
				<span class="text-xs text-gray-500">
					Population&nbsp;: {populationFormatter.format(stats.population)} hab. ({stats.populationYear})
				</span>
			{/if}
		</div>

		<div class="grid gap-3 sm:grid-cols-2">
			<article class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<div class="flex items-start gap-3">
					<span
						class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-navy/10 text-brand-navy"
					>
						<Route class="h-4 w-4" aria-hidden="true" />
					</span>
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-start justify-between gap-2">
							<h3 class="text-sm font-semibold text-gray-700">Densité d'aménagements cyclables</h3>
							{@render rankBadge(stats.rankings?.bikeInfraPer100kmRoadway ?? null)}
						</div>
						{#if effectiveBikeInfraRatio !== null && stats.eligibleRoadwayKm !== null && effectiveTotalBikeLanesKm !== null}
							<div class="mt-1 flex items-baseline gap-1.5">
								<span class="text-3xl font-bold text-brand-navy"
									>{decimalFormatter.format(effectiveBikeInfraRatio)}</span
								>
								<span class="text-sm font-medium text-gray-500">m / 100 m</span>
							</div>
							<p class="mt-1 text-xs text-gray-500">
								{decimalFormatter.format(effectiveTotalBikeLanesKm)}&nbsp;km d'aménagements{#if usingOsmTotal}<sup
										>*</sup
									>{/if} sur {decimalFormatter.format(stats.eligibleRoadwayKm)}&nbsp;km de voirie,
								hors axes rapides (≥ 70 km/h) et zones piétonnes (≤ 5 km/h).
							</p>
						{:else}
							<p class="mt-2 text-sm text-gray-500 italic">
								Données voirie indisponibles pour calculer ce ratio.
							</p>
							<p class="mt-1 text-xs text-gray-500">
								{decimalFormatter.format(
									effectiveTotalBikeLanesKm ?? stats.totalBikeLanesKm,
								)}&nbsp;km d'aménagements{#if usingOsmTotal}<sup>*</sup>{/if} au total
							</p>
						{/if}
					</div>
				</div>
			</article>

			<article class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<div class="flex items-start gap-3">
					<span
						class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-navy/10 text-brand-navy"
					>
						<TrendingUp class="h-4 w-4" aria-hidden="true" />
					</span>
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-start justify-between gap-2">
							<h3 class="text-sm font-semibold text-gray-700">
								Aménagements récents (depuis {stats.recentYearFrom})
							</h3>
							{@render rankBadge(stats.rankings?.recentBikeLanesPer100kmRoadway ?? null)}
						</div>
						{#if stats.recentBikeLanesPer100kmRoadway !== null}
							<div class="mt-1 flex items-baseline gap-1.5">
								<span class="text-3xl font-bold text-brand-navy"
									>{decimalFormatter.format(stats.recentBikeLanesPer100kmRoadway)}</span
								>
								<span class="text-sm font-medium text-gray-500">m / 100 m</span>
							</div>
							<p class="mt-1 text-xs text-gray-500">
								{decimalFormatter.format(stats.recentBikeLanesKm)}&nbsp;km livrés sur les 3
								dernières années
							</p>
						{:else}
							<div class="mt-1 flex items-baseline gap-1.5">
								<span class="text-3xl font-bold text-brand-navy"
									>{decimalFormatter.format(stats.recentBikeLanesKm)}</span
								>
								<span class="text-sm font-medium text-gray-500">km</span>
							</div>
							<p class="mt-1 text-xs text-gray-500">
								Livrés depuis {stats.recentYearFrom} (voirie de référence indisponible).
							</p>
						{/if}
					</div>
				</div>
			</article>

			<article class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<div class="flex items-start gap-3">
					<span
						class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-navy/10 text-brand-navy"
					>
						<ParkingSquare class="h-4 w-4" aria-hidden="true" />
					</span>
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-start justify-between gap-2">
							<h3 class="text-sm font-semibold text-gray-700">
								Stationnements vélo&nbsp;/ 1000 hab.
							</h3>
							{@render rankBadge(stats.rankings?.parkingPer1000 ?? null)}
						</div>
						{#if stats.parkingPer1000 !== null}
							<div class="mt-1 flex items-baseline gap-1.5">
								<span class="text-3xl font-bold text-brand-navy"
									>{wholeFormatter.format(stats.parkingPer1000)}</span
								>
								<span class="text-sm font-medium text-gray-500">places</span>
							</div>
							<p class="mt-1 text-xs text-gray-500">
								{wholeFormatter.format(stats.parkingPlaces)}&nbsp;places réparties sur {wholeFormatter.format(
									stats.parkingFeatures,
								)}&nbsp;équipements
							</p>
						{:else}
							<p class="mt-2 text-sm text-gray-500 italic">
								Population non disponible pour calculer ce ratio.
							</p>
							<p class="mt-1 text-xs text-gray-500">
								{wholeFormatter.format(stats.parkingPlaces)}&nbsp;places sur {wholeFormatter.format(
									stats.parkingFeatures,
								)}&nbsp;équipements
							</p>
						{/if}
					</div>
				</div>
			</article>
			<article class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<div class="flex items-start gap-3">
					<span
						class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-navy/10 text-brand-navy"
					>
						<TrendingUp class="h-4 w-4" aria-hidden="true" />
					</span>
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-start justify-between gap-2">
							<h3 class="text-sm font-semibold text-gray-700">
								Stationnements récents (depuis {stats.recentYearFrom})
							</h3>
							{@render rankBadge(stats.rankings?.recentParkingPer1000 ?? null)}
						</div>
						{#if stats.recentParkingPer1000 !== null}
							<div class="mt-1 flex items-baseline gap-1.5">
								<span class="text-3xl font-bold text-brand-navy"
									>{wholeFormatter.format(stats.recentParkingPer1000)}</span
								>
								<span class="text-sm font-medium text-gray-500">places&nbsp;/ 1000 hab.</span>
							</div>
							<p class="mt-1 text-xs text-gray-500">
								{wholeFormatter.format(stats.recentParkingPlaces)}&nbsp;places ajoutées sur les 3
								dernières années ({wholeFormatter.format(
									stats.recentParkingFeatures,
								)}&nbsp;équipements)
							</p>
						{:else}
							<div class="mt-1 flex items-baseline gap-1.5">
								<span class="text-3xl font-bold text-brand-navy"
									>{wholeFormatter.format(stats.recentParkingPlaces)}</span
								>
								<span class="text-sm font-medium text-gray-500">places</span>
							</div>
							<p class="mt-1 text-xs text-gray-500">
								Ajoutées depuis {stats.recentYearFrom} (population indisponible).
							</p>
						{/if}
					</div>
				</div>
			</article>
		</div>

		<p class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-gray-500">
			{#if anyRanking}
				<span>
					Classement&nbsp;:
					{#if anyRanking.scope === 'arrondissements'}
						rang vs. les {anyRanking.total} arrondissements de Lyon.
					{:else}
						rang vs. les {anyRanking.total} communes de la Métropole.
					{/if}
				</span>
				<span class="text-gray-300">·</span>
			{/if}
			<span>
				Source&nbsp;:&nbsp;<a
					href="https://data.grandlyon.com/portail/fr/jeux-de-donnees/amenagements-cyclables-metropole-lyon/donnees"
					target="_blank"
					rel="noopener"
					class="underline hover:text-brand-navy"
				>
					data.grandlyon.com
				</a>{#if usingOsmTotal}
					&nbsp;/&nbsp;<a
						href="https://www.openstreetmap.org/"
						target="_blank"
						rel="noopener"
						class="underline hover:text-brand-navy"
					>
						OpenStreetMap<sup>*</sup>
					</a>
				{/if}
			</span>
		</p>
	</section>
{/if}
