<script lang="ts">
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import { COMMUNE_PINNED, type PinnedItem } from '$lib/config/mapLayerCatalog';

	let {
		visibleOptional,
		filterByYear,
		isFineActive,
		isCategoryActive,
		toggleLayer,
		toggleCategory,
		onOpenSidebar,
	}: {
		visibleOptional: Set<string>;
		filterByYear: boolean;
		isFineActive: (id: string) => boolean;
		isCategoryActive: (category: string) => boolean;
		toggleLayer: (id: string) => void;
		toggleCategory: (category: string) => void;
		onOpenSidebar?: () => void;
	} = $props();

	const YEAR_MODE_KEYS = new Set(['pin-cycleways', 'pin-parking', 'pin-vl']);

	const pinned = $derived(
		filterByYear
			? COMMUNE_PINNED.filter((p) => YEAR_MODE_KEYS.has(p.key))
			: COMMUNE_PINNED.filter((p) => !p.gateCategory || visibleOptional.has(p.gateCategory)),
	);

	function isPinnedActive(item: PinnedItem): boolean {
		return item.kind === 'fine' ? isFineActive(item.target) : isCategoryActive(item.target);
	}

	function togglePinned(item: PinnedItem) {
		if (item.kind === 'fine') toggleLayer(item.target);
		else toggleCategory(item.target);
	}
</script>

<div
	class="pointer-events-none absolute top-3 left-1/2 z-10 flex w-full max-w-3xl -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 px-4"
>
	{#each pinned as item (item.key)}
		{@const active = isPinnedActive(item)}
		{@const disabled = filterByYear && (item.yearIncompatible ?? false)}
		<button
			type="button"
			onclick={() => togglePinned(item)}
			{disabled}
			aria-pressed={active}
			class="pointer-events-auto rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-sm transition-all active:scale-95 {disabled
				? 'cursor-not-allowed opacity-50'
				: 'cursor-pointer'}"
			style="
				background-color: {active ? item.color : 'white'};
				color: {active ? 'white' : item.color};
				border: 1.5px solid {item.color};
			"
		>
			{item.label}
		</button>
	{/each}
	{#if onOpenSidebar}
		<button
			type="button"
			onclick={onOpenSidebar}
			title="Plus de filtres"
			aria-label="Plus de filtres"
			class="pointer-events-auto rounded-full bg-white p-1.5 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
			style="border: 1.5px solid #9ca3af;"
		>
			<Ellipsis size={14} class="text-gray-500" />
		</button>
	{/if}
</div>
