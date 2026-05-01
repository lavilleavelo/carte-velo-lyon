<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { Ville30Stats } from '$lib/utils/speedLimits';

	let {
		communeName,
		ville30 = null,
		stats = null,
	}: {
		communeName: string;
		ville30?: { adoptedAt?: string; partial?: boolean; partialNote?: string } | null;
		stats?: Ville30Stats | null;
	} = $props();

	const isPartial = $derived(!!ville30?.partial);

	const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
		year: 'numeric',
		month: 'long',
	});

	const adoptedLabel = $derived.by(() => {
		if (!ville30?.adoptedAt) return null;
		const d = new Date(ville30.adoptedAt);
		if (Number.isNaN(d.getTime())) return null;
		return dateFormatter.format(d);
	});

	const numFormatter = new Intl.NumberFormat('fr-FR', {
		style: 'decimal',
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	});

	const sortedSpeedLimits = $derived.by(() => {
		if (!stats) return [];
		return Object.entries(stats.bySpeedLimit).sort((a, b) => {
			const numA = parseInt(a[0], 10);
			const numB = parseInt(b[0], 10);
			if (isNaN(numA) && isNaN(numB)) return a[0].localeCompare(b[0]);
			if (isNaN(numA)) return 1;
			if (isNaN(numB)) return -1;
			return numA - numB;
		});
	});
</script>

<section class="space-y-3">
	<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
		<h2 class="text-xl font-bold text-brand-navy">Ville 30</h2>
		<a
			class="inline-flex items-center gap-1 text-sm font-semibold text-brand-navy hover:underline"
			href="/ville-30"
		>
			En savoir plus →
		</a>
	</div>
	{#if ville30 && isPartial}
		<div class="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3">
			<CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
			<p class="text-sm text-brand-navy">
				<strong>{communeName} est partiellement une Ville 30.</strong>
				{ville30?.partialNote ??
					`Une partie seulement de la commune est passée à 30 km/h${adoptedLabel ? ` (depuis ${adoptedLabel})` : ''}.`}
			</p>
		</div>
	{:else if ville30}
		<div
			class="flex items-start gap-2.5 rounded-lg border border-brand-teal/40 bg-brand-teal/15 p-3"
		>
			<Check class="mt-0.5 h-4 w-4 shrink-0 text-brand-teal" aria-hidden="true" />
			<p class="text-sm text-brand-navy">
				<strong>
					{communeName} est une
					<a
						href="/ville-30"
						class="link-animated relative inline-block font-bold text-brand-navy after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-brand-navy after:transition-all after:duration-300 hover:after:w-full"
						>Ville 30</a
					>{adoptedLabel ? ` depuis ${adoptedLabel}` : ''}.
				</strong>
				La vitesse y est limitée à <strong>30 km/h par défaut</strong>, sauf indication contraire
				(axes principaux, zones piétonnes, etc.).
			</p>
		</div>
	{:else}
		<div class="flex items-start gap-2.5 rounded-lg border border-gray-200 bg-gray-50 p-3">
			<CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
			<p class="text-sm text-gray-700">
				<strong>
					{communeName} n'a pas adopté le statut
					<a
						href="/ville-30"
						class="link-animated relative inline-block font-bold text-brand-navy after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-brand-navy after:transition-all after:duration-300 hover:after:w-full"
						>Ville 30</a
					>.
				</strong>
				La vitesse par défaut y reste de <strong>50 km/h</strong>, sauf indication contraire.
			</p>
		</div>
	{/if}

	{#if !stats}
		<p class="text-sm text-gray-500 italic">
			Les données de vitesse de voirie ne sont pas disponibles pour {communeName}.
		</p>
	{:else}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
			{#if stats.eligibleKm > 0}
				<div>
					<div class="text-2xl font-bold text-brand-navy">
						{numFormatter.format(stats.eligibleUnder30KmPercentage)}%
					</div>
					<div class="mt-1 text-sm text-gray-700">des rues sont limitées à 30 km/h ou moins</div>
					<div class="mt-0.5 text-xs text-gray-500">
						{numFormatter.format(stats.eligibleUnder30Km)}&nbsp;km sur {numFormatter.format(
							stats.eligibleKm,
						)}&nbsp;km, hors axes rapides (≥ 70 km/h) et zones piétonnes (≤ 5 km/h)
					</div>
				</div>
			{:else}
				<div>
					<div class="text-2xl font-bold text-brand-navy">
						{numFormatter.format(stats.under30KmPercentage)}%
					</div>
					<div class="mt-1 text-sm text-gray-700">de voirie limitée à 30 km/h ou moins</div>
					<div class="mt-0.5 text-xs text-gray-500">
						{numFormatter.format(stats.under30Km)}&nbsp;km sur {numFormatter.format(
							stats.totalKm,
						)}&nbsp;km
					</div>
				</div>
			{/if}

			<details class="mt-4 border-t border-gray-200 pt-3">
				<summary
					class="cursor-pointer text-sm font-semibold text-gray-600 select-none hover:underline"
				>
					Détail par limitation de vitesse
				</summary>

				<div class="mt-3 grid gap-2 border-b border-gray-200 pb-3 sm:grid-cols-2">
					<div>
						<div class="text-sm font-semibold text-brand-navy">
							{numFormatter.format(stats.under30KmPercentage)}% de voirie ≤ 30 km/h
						</div>
						<div class="text-xs text-gray-500">
							{numFormatter.format(stats.under30Km)}&nbsp;km sur {numFormatter.format(
								stats.totalKm,
							)}&nbsp;km (toutes voies confondues)
						</div>
					</div>
				</div>

				<div class="mt-2 space-y-1">
					{#each sortedSpeedLimits as [speed, data]}
						{@const percentage = stats.totalKm > 0 ? (data.km / stats.totalKm) * 100 : 0}
						{@const isUnder30 = !isNaN(parseInt(speed, 10)) && parseInt(speed, 10) <= 30}
						<div class="flex items-center gap-2 text-sm">
							<span
								class="inline-block w-16 font-medium {isUnder30
									? 'text-brand-navy'
									: 'text-brand-pink'}"
							>
								{speed === 'unknown' ? 'Inconnu' : `${speed} km/h`}
							</span>
							<div class="h-2 flex-1 rounded-full bg-gray-200">
								<div
									class="h-2 rounded-full {isUnder30 ? 'bg-brand-navy' : 'bg-brand-pink'}"
									style="width: {Math.min(percentage, 100)}%"
								></div>
							</div>
							<span class="w-20 text-right text-xs text-gray-500">
								{numFormatter.format(data.km)}&nbsp;km
							</span>
							<span class="w-14 text-right text-xs text-gray-500">
								({numFormatter.format(percentage)}%)
							</span>
						</div>
					{/each}
				</div>
				<p class="mt-3 text-xs text-gray-500">
					{stats.totalStreets.toLocaleString('fr-FR')} tronçons de rue analysés
					<span class="text-gray-400">·</span>
					<span class="text-[11px] text-gray-400">source&nbsp;: data.grandlyon.com</span>
				</p>
			</details>
		</div>
	{/if}
</section>
