<script lang="ts">
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import X from '@lucide/svelte/icons/x';
	import { COMMUNE_PINNED, availableLayers, type PinnedItem } from '$lib/config/mapLayerCatalog';

	let {
		visibleOptional,
		filterByYear,
		isFineActive,
		isCategoryActive,
		toggleLayer,
		toggleCategory,
		deactivateCategory,
		onOpenSidebar,
	}: {
		visibleOptional: Set<string>;
		filterByYear: boolean;
		isFineActive: (id: string) => boolean;
		isCategoryActive: (category: string) => boolean;
		toggleLayer: (id: string) => void;
		toggleCategory: (category: string) => void;
		deactivateCategory: (category: string) => void;
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

	const PINNED_COVERED_CATEGORIES = new Set<string>(
		COMMUNE_PINNED.flatMap((p) => {
			if (p.kind === 'category') {
				return [p.target];
			}

			const layer = availableLayers.find((l) => l.id === p.target);
			return layer ? [layer.category] : [];
		}),
	);

	const MAX_INLINE_EXTRAS = 3;

	type ExtraCategory = { category: string; color: string; count: number };

	const extraActive = $derived.by<ExtraCategory[]>(() => {
		const seen = new Map<string, ExtraCategory>();

		for (const layer of availableLayers) {
			if (PINNED_COVERED_CATEGORIES.has(layer.category)) continue;
			if (!isFineActive(layer.id)) continue;
			const existing = seen.get(layer.category);
			if (existing) existing.count += 1;
			else seen.set(layer.category, { category: layer.category, color: layer.color, count: 1 });
		}

		return [...seen.values()];
	});

	const inlineExtras = $derived(extraActive.slice(0, MAX_INLINE_EXTRAS));
	const overflowCount = $derived(Math.max(0, extraActive.length - MAX_INLINE_EXTRAS));
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
	{#each inlineExtras as extra (extra.category)}
		<button
			type="button"
			onclick={() => deactivateCategory(extra.category)}
			title="Désactiver « {extra.category} »"
			aria-label="Désactiver {extra.category}"
			class="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-medium whitespace-nowrap shadow-sm transition-all hover:bg-gray-50 active:scale-95"
			style="border: 1.5px solid {extra.color}; color: {extra.color};"
		>
			<span>{extra.category}{extra.count > 1 ? ` (${extra.count})` : ''}</span>
			<X size={12} aria-hidden="true" />
		</button>
	{/each}

	{#if overflowCount > 0 && onOpenSidebar}
		<button
			type="button"
			onclick={onOpenSidebar}
			title="{overflowCount} autre{overflowCount > 1 ? 's' : ''} calque{overflowCount > 1
				? 's'
				: ''} actif{overflowCount > 1 ? 's' : ''}"
			aria-label="{overflowCount} autres calques actifs, ouvrir les filtres"
			class="pointer-events-auto rounded-full bg-gray-700 px-2 py-1 text-xs font-semibold whitespace-nowrap text-white shadow-sm transition-all hover:bg-gray-800 active:scale-95"
		>
			+{overflowCount}
		</button>
	{/if}

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
