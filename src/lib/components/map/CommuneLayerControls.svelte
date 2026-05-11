<script lang="ts">
	import Settings from '@lucide/svelte/icons/settings';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import FilterPanel from '$lib/components/map/FilterPanel.svelte';
	import CyclewayFilters from '$lib/components/map/filters/CyclewayFilters.svelte';
	import { cyclewayFilterOptions } from '$lib/config/cyclewayFilterOptions';
	import {
		availableLayers,
		groupLayersByCategory,
		optionalCategories,
		type LayerCatalogEntry,
	} from '$lib/config/mapLayerCatalog';

	let {
		visibleOptional,
		toggleOptionalCategory,
		isFineActive,
		isCategoryActive,
		toggleLayer,
		toggleCategory,
		toggleCyclewayReseau,
		toggleCyclewayType,
		toggleCyclewayLocalisation,
		isCyclewayReseauSelected,
		isCyclewayTypeSelected,
		isCyclewayLocalisationSelected,
		isLayerAllowed,
		reactivityKey,
	}: {
		visibleOptional: Set<string>;
		toggleOptionalCategory: (category: string) => void;
		isFineActive: (id: string) => boolean;
		isCategoryActive: (category: string) => boolean;
		toggleLayer: (id: string) => void;
		toggleCategory: (category: string) => void;
		toggleCyclewayReseau?: (value: string) => void;
		toggleCyclewayType?: (value: string) => void;
		toggleCyclewayLocalisation?: (value: string) => void;
		isCyclewayReseauSelected?: (value: string) => boolean;
		isCyclewayTypeSelected?: (value: string) => boolean;
		isCyclewayLocalisationSelected?: (value: string) => boolean;
		isLayerAllowed?: (id: string) => boolean;
		reactivityKey?: unknown;
	} = $props();

	const HIDDEN_CATEGORIES = new Set(['Communes']);
	const optionalCategoriesSet = new Set<string>(optionalCategories);

	let configOpen = $state(false);

	function isCategoryAllowed(category: string): boolean {
		if (HIDDEN_CATEGORIES.has(category)) return false;
		return !(optionalCategoriesSet.has(category) && !visibleOptional.has(category));
	}

	const filteredCatalog = $derived.by(() => {
		void reactivityKey;
		return availableLayers
			.filter((l) => isCategoryAllowed(l.category))
			.filter((l) => (isLayerAllowed ? isLayerAllowed(l.id) : true));
	});
	const layersByCategory = $derived<Map<string, LayerCatalogEntry[]>>(
		groupLayersByCategory(filteredCatalog),
	);

	let expandedCategories = $state<Set<string>>(new Set());
	function isCategoryCollapsed(category: string): boolean {
		return !expandedCategories.has(category);
	}

	function toggleCategoryCollapse(category: string) {
		const next = new Set(expandedCategories);
		if (next.has(category)) next.delete(category);
		else next.add(category);
		expandedCategories = next;
	}

	function isCategoryVisible(category: string): boolean {
		return isCategoryActive(category);
	}
</script>

<div class="rounded-lg bg-white p-4 shadow">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class="text-sm font-semibold text-brand-navy uppercase">Calques</h2>
		<button
			type="button"
			onclick={() => (configOpen = true)}
			title="Configurer les couches"
			aria-label="Configurer les couches"
			class="flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
		>
			<Settings size={14} />
		</button>
	</div>

	<FilterPanel
		{layersByCategory}
		{isCategoryVisible}
		{isCategoryCollapsed}
		{toggleCategory}
		{toggleCategoryCollapse}
		{toggleLayer}
		isLayerVisible={isFineActive}
		compact
	>
		{#snippet layerSubFilters(layerId: string)}
			{#if layerId === 'cycleways' && toggleCyclewayReseau && toggleCyclewayType && toggleCyclewayLocalisation && isCyclewayReseauSelected && isCyclewayTypeSelected && isCyclewayLocalisationSelected}
				<CyclewayFilters
					filterOptions={cyclewayFilterOptions}
					toggleReseau={toggleCyclewayReseau}
					toggleType={toggleCyclewayType}
					toggleLocalisation={toggleCyclewayLocalisation}
					isReseauSelected={isCyclewayReseauSelected}
					isTypeSelected={isCyclewayTypeSelected}
					isLocalisationSelected={isCyclewayLocalisationSelected}
				/>
			{/if}
		{/snippet}
	</FilterPanel>
</div>

<Dialog.Root bind:open={configOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Couches supplémentaires</Dialog.Title>
			<Dialog.Description>
				Activez les catégories à afficher sur le panneau et la barre rapide.
			</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-1 py-2">
			{#each optionalCategories as category (category)}
				<div class="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50">
					<Checkbox
						id={`commune-config-${category}`}
						checked={visibleOptional.has(category)}
						onCheckedChange={() => toggleOptionalCategory(category)}
						class="border-gray-300 data-[state=checked]:border-brand-navy data-[state=checked]:bg-brand-navy"
					/>
					<Label
						for={`commune-config-${category}`}
						class="cursor-pointer text-sm font-medium text-gray-700"
					>
						{category}
					</Label>
				</div>
			{/each}
		</div>
	</Dialog.Content>
</Dialog.Root>
