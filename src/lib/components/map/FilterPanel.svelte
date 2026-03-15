<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import type { Snippet } from 'svelte';

	let {
		layersByCategory,
		isCategoryVisible,
		isCategoryCollapsed,
		toggleCategory,
		toggleCategoryCollapse,
		toggleLayer,
		isLayerVisible,
		layerSubFilters,
		compact = false,
	}: {
		layersByCategory: Map<string, any[]>;
		isCategoryVisible: (category: string) => boolean;
		isCategoryCollapsed: (category: string) => boolean;
		toggleCategory: (category: string) => void;
		toggleCategoryCollapse: (category: string) => void;
		toggleLayer: (layerId: string) => void;
		isLayerVisible: (layerId: string) => boolean;
		layerSubFilters?: Snippet<[string]>;
		compact?: boolean;
	} = $props();
</script>

<div class="flex flex-col" class:gap-4={compact} class:gap-6={!compact}>
	{#each [...layersByCategory.entries()] as [category, layers]}
		{@const allVisible = layers.every((l) => isLayerVisible(l.id))}
		<div
			class="flex flex-col rounded-xl border border-gray-100 bg-gray-50/50 transition-all hover:bg-gray-50"
			class:gap-2={compact}
			class:gap-3={!compact}
			class:px-2={compact}
			class:py-2={compact}
			class:p-3={!compact}
		>
			<div class="flex items-center justify-between">
				<button
					onclick={() => toggleCategoryCollapse(category)}
					class="group flex items-center gap-2 text-[10px] font-bold tracking-wide whitespace-nowrap text-gray-500 uppercase transition-colors hover:text-brand-navy"
				>
					<div class="rounded-full bg-gray-200 p-1 transition-colors group-hover:bg-gray-300">
						<svg
							class="h-3 w-3 transition-transform duration-200"
							class:rotate-180={!isCategoryCollapsed(category)}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</div>
					<span>{category}</span>
				</button>
				<button
					onclick={() => toggleCategory(category)}
					class="rounded-full p-1.5 transition-colors hover:bg-gray-200"
					class:text-brand-navy={allVisible}
					class:text-gray-400={!allVisible}
					title={allVisible ? 'Masquer tout' : 'Afficher tout'}
				>
					{#if allVisible}
						<Eye size={16} />
					{:else}
						<EyeOff size={16} />
					{/if}
				</button>
			</div>

			{#if !isCategoryCollapsed(category)}
				<div class="pl-1 transition-all duration-300">
					{#if category === 'Voies Lyonnaises' || category === 'Voies Lyonnaises (OSM)'}
						<div class="grid grid-cols-4 gap-2 sm:grid-cols-4">
							{#each layers as layer}
								<div class="flex items-center justify-center">
									<label
										for={layer.id}
										class="relative flex h-8 w-10 cursor-pointer items-center justify-center rounded-md border text-sm font-bold shadow-sm transition-all select-none hover:scale-105 active:scale-95"
										style="
											background-color: {isLayerVisible(layer.id) ? layer.color : 'white'};
											color: {isLayerVisible(layer.id) ? 'white' : layer.color};
											border-color: {layer.color};
										"
									>
										<input
											type="checkbox"
											id={layer.id}
											class="sr-only"
											checked={isLayerVisible(layer.id)}
											onchange={() => toggleLayer(layer.id)}
										/>
										{layer.label}
									</label>
								</div>
							{/each}
						</div>
					{:else}
						<div class="flex flex-col gap-2.5">
							{#each layers as layer}
								<div
									class="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-white/60"
								>
									<Checkbox
										id={layer.id}
										checked={isLayerVisible(layer.id)}
										onCheckedChange={() => toggleLayer(layer.id)}
										class="border-gray-300 data-[state=checked]:border-brand-navy data-[state=checked]:bg-brand-navy"
									/>
									<Label
										for={layer.id}
										class="flex cursor-pointer items-center gap-3 text-sm font-medium text-gray-700"
									>
										{#if layer.icon}
											<img src={layer.icon} alt="" class="h-6 w-6 object-contain" />
										{:else}
											<span
												class="inline-block h-3 w-3 rounded-full shadow-sm ring-2 ring-white"
												style="background-color: {layer.color}"
											></span>
										{/if}
										{layer.label}
									</Label>
								</div>

								{#if layerSubFilters && isLayerVisible(layer.id)}
									{@render layerSubFilters(layer.id)}
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/each}
</div>
