<script lang="ts">
	import type { Snippet } from 'svelte';
	import Maximize2 from '@lucide/svelte/icons/maximize-2';
	import Minimize2 from '@lucide/svelte/icons/minimize-2';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';

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
		mapExpanded = false,
		onToggleMapExpand,
	}: {
		layers: string[];
		filterByYear: boolean;
		groups: ToggleGroup[];
		yearFilterSlot?: Snippet;
		mapExpanded?: boolean;
		onToggleMapExpand?: () => void;
	} = $props();

	function toggle(id: string, on: boolean) {
		const set = new Set(layers);
		if (on) set.add(id);
		else set.delete(id);
		layers = [...set];
	}
</script>

<div class="rounded-lg bg-white p-4 shadow">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class="text-sm font-semibold text-brand-navy uppercase">Calques</h2>
		{#if onToggleMapExpand}
			<button
				type="button"
				onclick={onToggleMapExpand}
				title={mapExpanded ? 'Réduire la carte' : 'Agrandir la carte'}
				aria-label={mapExpanded ? 'Réduire la carte' : 'Agrandir la carte'}
				class="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
			>
				{#if mapExpanded}
					<Minimize2 size={13} />
					<span>Réduire la carte</span>
				{:else}
					<Maximize2 size={13} />
					<span>Agrandir la carte</span>
				{/if}
			</button>
		{/if}
	</div>

	<div class="mb-3 flex items-center gap-2">
		<Checkbox
			id="filter-by-year"
			checked={filterByYear}
			onCheckedChange={(v) => (filterByYear = v === true)}
		/>
		<Label for="filter-by-year" class="cursor-pointer text-sm font-medium text-gray-700">
			Filtrer par date de réalisation
		</Label>
	</div>

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
						{@const toggleId = `layer-toggle-${t.id}`}
						<li class="flex items-center gap-2">
							<Checkbox
								id={toggleId}
								checked={layers.includes(t.id)}
								{disabled}
								onCheckedChange={(v) => toggle(t.id, v === true)}
							/>
							<Label
								for={toggleId}
								class="text-sm {disabled
									? 'cursor-not-allowed text-gray-400'
									: 'cursor-pointer text-gray-700'}"
							>
								{t.label}
							</Label>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</div>
