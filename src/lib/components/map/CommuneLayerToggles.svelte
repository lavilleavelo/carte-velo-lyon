<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Toggle {
		id: string;
		label: string;
		disableWhenYearFiltered?: boolean;
	}

	interface ToggleGroup {
		label: string;
		toggles: Toggle[];
	}

	let {
		layers = $bindable(),
		filterByYear = $bindable(),
		groups,
		yearFilterSlot,
	}: {
		layers: string[];
		filterByYear: boolean;
		groups: ToggleGroup[];
		yearFilterSlot?: Snippet;
	} = $props();

	function toggle(id: string, on: boolean) {
		const set = new Set(layers);
		if (on) set.add(id);
		else set.delete(id);
		layers = [...set];
	}
</script>

<div class="rounded-lg bg-white p-4 shadow">
	<h2 class="mb-3 text-sm font-semibold text-brand-navy uppercase">Calques</h2>

	<label
		class="mb-3 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700"
	>
		<input
			type="checkbox"
			class="h-4 w-4 accent-brand-navy"
			checked={filterByYear}
			onchange={(e) => (filterByYear = (e.target as HTMLInputElement).checked)}
		/>
		Filtrer par date de réalisation
	</label>

	{#if filterByYear && yearFilterSlot}
		<div class="mb-4">
			{@render yearFilterSlot()}
		</div>
	{/if}

	<div class="flex flex-col gap-4">
		{#each groups as group (group.label)}
			<div>
				<h3 class="mb-2 text-xs font-medium text-gray-500 uppercase">{group.label}</h3>
				<ul class="flex flex-wrap gap-x-5 gap-y-2">
					{#each group.toggles as t (t.id)}
						{@const disabled = filterByYear && (t.disableWhenYearFiltered ?? false)}
						<li>
							<label
								class="inline-flex items-center gap-2 text-sm"
								class:cursor-pointer={!disabled}
								class:cursor-not-allowed={disabled}
								class:text-gray-400={disabled}
								class:text-gray-700={!disabled}
							>
								<input
									type="checkbox"
									class="h-4 w-4 accent-brand-navy"
									checked={layers.includes(t.id)}
									{disabled}
									onchange={(e) => toggle(t.id, (e.target as HTMLInputElement).checked)}
								/>
								{t.label}
							</label>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</div>
