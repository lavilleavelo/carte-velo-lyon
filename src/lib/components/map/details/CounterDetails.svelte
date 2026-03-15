<script lang="ts">
	import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
	import ExternalLink from '@lucide/svelte/icons/external-link';

	let { properties } = $props();

	interface CountEntry {
		month: string;
		count: number;
	}

	const counts: CountEntry[] = $derived.by(() => {
		try {
			const parsed =
				typeof properties.counts === 'string' ? JSON.parse(properties.counts) : properties.counts;
			return (parsed || []) as CountEntry[];
		} catch {
			return [];
		}
	});

	const chartData = $derived(counts.slice(-24));

	const maxCount = $derived(chartData.length > 0 ? Math.max(...chartData.map((c) => c.count)) : 0);

	const lastCount = $derived(
		properties.lastCount != null ? Number(properties.lastCount).toLocaleString('fr-FR') : '?',
	);

	const lastMonth = $derived(
		properties.lastMonth
			? new Date(properties.lastMonth).toLocaleDateString('fr-FR', {
					month: 'long',
					year: 'numeric',
				})
			: '',
	);

	const isVelo = $derived(properties.counterType === 'velo');

	const yoyComparison = $derived.by(() => {
		if (!properties.lastMonth || counts.length < 13) return null;

		const lastDate = new Date(properties.lastMonth);
		const lastMonthKey = properties.lastMonth;
		const sameMonthLastYear = `${lastDate.getFullYear() - 1}-${String(lastDate.getMonth() + 1).padStart(2, '0')}-01`;

		const current = counts.find((c) => c.month === lastMonthKey);
		const previous = counts.find((c) => c.month === sameMonthLastYear);

		if (!current || !previous || previous.count === 0) return null;

		const change = ((current.count - previous.count) / previous.count) * 100;
		return {
			change: Math.round(change),
			previousCount: previous.count,
			previousMonth: new Date(sameMonthLastYear).toLocaleDateString('fr-FR', {
				month: 'long',
				year: 'numeric',
			}),
		};
	});

	let hoveredIndex = $state<number | null>(null);

	function formatMonth(month: string): string {
		const d = new Date(month);
		return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
	}

	function formatCount(count: number): string {
		if (count >= 1000) return `${Math.round(count / 1000)}k`;
		return String(count);
	}

	// Show labels every ~6 bars
	const labelInterval = $derived(Math.max(1, Math.floor(chartData.length / 4)));
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-2 text-brand-navy">
		<div
			class="flex h-8 w-8 items-center justify-center rounded-full"
			class:bg-blue-100={isVelo}
			class:text-blue-700={isVelo}
			class:bg-red-100={!isVelo}
			class:text-red-700={!isVelo}
		>
			<BarChart3 size={18} />
		</div>
		<h3 class="text-sm font-bold tracking-wide uppercase">
			Compteur {isVelo ? 'vélo' : 'voiture'}
		</h3>
	</div>

	<div class="space-y-2 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
		<h4 class="text-lg font-bold text-gray-900">{properties.name}</h4>

		{#if properties.description}
			<p class="text-sm text-gray-600">{properties.description}</p>
		{/if}

		{#if properties.arrondissement}
			<p class="text-xs text-gray-500">{properties.arrondissement}</p>
		{/if}
	</div>

	<div class="grid grid-cols-2 gap-2">
		<div class="flex flex-col rounded-lg border border-gray-100 bg-gray-50/50 p-2.5">
			<span class="text-[10px] font-bold tracking-wide text-gray-400 uppercase">Dernier mois</span>
			<span class="text-lg font-bold text-gray-900">{lastCount}</span>
			{#if lastMonth}
				<span class="text-[10px] text-gray-500">{lastMonth}</span>
			{/if}
		</div>
		<div class="flex flex-col rounded-lg border border-gray-100 bg-gray-50/50 p-2.5">
			<span class="text-[10px] font-bold tracking-wide text-gray-400 uppercase"
				>vs. année préc.</span
			>
			{#if yoyComparison}
				<span
					class="text-lg font-bold"
					class:text-green-600={yoyComparison.change > 0}
					class:text-red-600={yoyComparison.change < 0}
					class:text-gray-600={yoyComparison.change === 0}
				>
					{yoyComparison.change > 0 ? '+' : ''}{yoyComparison.change}%
				</span>
				<span class="text-[10px] text-gray-500">vs. {yoyComparison.previousMonth}</span>
			{:else}
				<span class="text-sm text-gray-400">N/A</span>
				<span class="text-[10px] text-gray-500">pas de données</span>
			{/if}
		</div>
	</div>

	{#if chartData.length > 1}
		<div class="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
			<div class="mb-1 flex items-center justify-between">
				<h5 class="text-[10px] font-bold tracking-wide text-gray-400 uppercase">
					Évolution (24 derniers mois)
				</h5>
				{#if hoveredIndex != null}
					<span class="text-[10px] font-semibold text-gray-700">
						{formatMonth(chartData[hoveredIndex].month)} : {chartData[
							hoveredIndex
						].count.toLocaleString('fr-FR')}
					</span>
				{/if}
			</div>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="flex items-end gap-[2px]"
				style="height: 80px;"
				onmouseleave={() => (hoveredIndex = null)}
			>
				{#each chartData as entry, i}
					{@const height = maxCount > 0 ? (entry.count / maxCount) * 100 : 0}
					{@const isLast = i === chartData.length - 1}
					{@const isHovered = hoveredIndex === i}
					<div
						class="relative flex-1 rounded-t-sm transition-colors"
						class:bg-blue-300={isVelo && !isLast && !isHovered}
						class:bg-blue-600={isVelo && (isLast || isHovered)}
						class:bg-red-300={!isVelo && !isLast && !isHovered}
						class:bg-red-600={!isVelo && (isLast || isHovered)}
						style="height: {height}%;"
						onmouseenter={() => (hoveredIndex = i)}
						role="img"
						aria-label="{formatMonth(entry.month)}: {entry.count.toLocaleString('fr-FR')}"
					></div>
				{/each}
			</div>
			<div class="mt-1 flex justify-between text-[9px] leading-tight text-gray-400">
				{#each chartData as entry, i}
					{#if i % labelInterval === 0 || i === chartData.length - 1}
						<span class="text-center whitespace-nowrap">{formatMonth(entry.month)}</span>
					{/if}
				{/each}
			</div>
		</div>
	{/if}

	{#if properties.cyclopolisUrl}
		<a
			href={properties.cyclopolisUrl}
			target="_blank"
			rel="noopener noreferrer"
			class="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
		>
			<ExternalLink size={14} />
			Voir sur Cyclopolis
		</a>
	{/if}
</div>
