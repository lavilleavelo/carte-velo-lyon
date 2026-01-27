<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';

	let {
		layersByCategory,
		isCategoryVisible,
		isCategoryCollapsed,
		toggleCategory,
		toggleCategoryCollapse,
		toggleLayer,
		isLayerVisible,
	} = $props();
</script>

<div class="flex flex-col gap-6">
	{#each [...layersByCategory.entries()] as [category, layers]}
		<div
			class="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3 transition-all hover:bg-gray-50"
		>
			<div class="flex items-center justify-between">
				<button
					onclick={() => toggleCategoryCollapse(category)}
					class="group flex items-center gap-2 text-xs font-bold tracking-wide text-gray-500 uppercase transition-colors hover:text-brand-navy"
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
					class="rounded-full px-2 py-1 text-[10px] font-medium transition-colors hover:bg-gray-200"
					class:text-brand-navy={isCategoryVisible(category)}
					class:text-gray-400={!isCategoryVisible(category)}
					title={isCategoryVisible(category)
						? 'Désactiver toutes les couches'
						: 'Activer toutes les couches'}
				>
					{isCategoryVisible(category) ? 'Masquer tout' : 'Afficher tout'}
				</button>
			</div>

			{#if !isCategoryCollapsed(category)}
				<div class="pl-1 transition-all duration-300">
					{#if category === 'Voies Lyonnaises'}
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
										<span
											class="inline-block h-3 w-3 rounded-full shadow-sm ring-2 ring-white"
											style="background-color: {layer.color}"
										></span>
										{layer.label}
									</Label>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/each}
</div>
