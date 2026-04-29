<script lang="ts">
	import { GRAVITIES, type Breakdown } from './types';

	type Bucket = {
		key: string;
		breakdown: Breakdown;
		total: number;
		min: number;
		max: number;
	};

	let {
		buckets,
		unknown,
		max,
		gravitySet,
	}: {
		buckets: Bucket[];
		unknown: number;
		max: number;
		gravitySet: Set<string>;
	} = $props();

	let hovered = $state<string | null>(null);
	const numFmt = new Intl.NumberFormat('fr-FR');
	const HEIGHT = 56;
</script>

<div class="mt-3 border-t border-gray-100 pt-3">
	<div class="mb-1 flex items-baseline justify-between gap-2">
		<span class="text-xs font-medium text-gray-600 uppercase">Âge des victimes</span>
		{#if hovered !== null}
			{@const hv = buckets.find((b) => b.key === hovered)}
			<span class="text-[10px] font-semibold tabular-nums text-gray-700"
				>{hovered} ans : {numFmt.format(hv?.total ?? 0)}</span
			>
		{:else if unknown > 0}
			<span class="text-[10px] tabular-nums text-gray-400"
				>{numFmt.format(unknown)} sans âge</span
			>
		{/if}
	</div>
	<div
		class="flex items-end gap-0.5"
		style="height: {HEIGHT}px;"
		role="img"
		aria-label="Histogramme des âges des victimes"
		onmouseleave={() => (hovered = null)}
	>
		{#each buckets as b (b.key)}
			<div
				class="group relative flex h-full flex-1 flex-col-reverse rounded-t-sm"
				style="min-width: 0;"
				title={`${b.key} ans : ${numFmt.format(b.total)} victime${b.total > 1 ? 's' : ''}`}
				onmouseenter={() => (hovered = b.key)}
			>
				{#each GRAVITIES as g (g.id)}
					{@const c = gravitySet.has(g.id) ? b.breakdown[g.id] : 0}
					{@const segH = (c / max) * HEIGHT}
					{#if c > 0}
						<div style="background-color: {g.color}; height: {segH}px; width: 100%;"></div>
					{/if}
				{/each}
				{#if b.total === 0}
					<div style="height: 1px; width: 100%; background: #e5e7eb;"></div>
				{/if}
			</div>
		{/each}
	</div>
	<div class="mt-1 flex justify-between text-[10px] text-gray-400">
		{#each buckets as b (b.key)}
			<span class="text-center" style="flex: 1;">{b.key}</span>
		{/each}
	</div>
</div>
