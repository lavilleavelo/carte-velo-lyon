<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { GRAVITIES, type Breakdown } from './types';

	let {
		entries,
		selected,
		gravitySet,
		search = $bindable(''),
		onToggle,
		onSolo,
		onClear,
		limit = 20,
	}: {
		entries: { canonical: string; key: string; breakdown: Breakdown; total: number }[];
		selected: Set<string>; // canonical street names
		gravitySet: Set<string>;
		search?: string;
		onToggle: (canonical: string) => void;
		onSolo: (canonical: string) => void;
		onClear: () => void;
		limit?: number;
	} = $props();

	const numFmt = new Intl.NumberFormat('fr-FR');

	const visibleEntries = $derived(() => {
		const q = search.toLowerCase().trim();
		const filtered = q
			? entries.filter((e) => e.key.includes(q) || e.canonical.toLowerCase().includes(q))
			: entries;
		return filtered.slice(0, limit);
	});
</script>

<input
	type="text"
	bind:value={search}
	placeholder="Rechercher une rue…"
	class="mb-2 w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs placeholder-gray-400 focus:border-brand-navy focus:ring-1 focus:ring-brand-navy focus:outline-none"
/>
<div class="flex flex-col" style="max-height: 240px; overflow-y: auto;">
	{#if visibleEntries().length === 0}
		<p class="px-2 py-3 text-xs text-gray-400">Aucune rue trouvée.</p>
	{:else}
		{#each visibleEntries() as e (e.canonical)}
			{@const checked = selected.has(e.canonical)}
			<label
				class="group relative flex cursor-pointer items-center gap-2 rounded-md p-1 hover:bg-gray-50"
			>
				<Checkbox {checked} onCheckedChange={() => onToggle(e.canonical)} class="border-gray-300" />
				<span class="flex-1 truncate text-xs text-gray-700" title={e.canonical}>
					{e.canonical}
				</span>
				<button
					type="button"
					onclick={(ev) => {
						ev.preventDefault();
						ev.stopPropagation();
						onSolo(e.canonical);
					}}
					title="Sélectionner uniquement {e.canonical}"
					class="hidden text-[10px] font-semibold text-brand-navy group-hover:inline hover:underline"
				>
					seul
				</button>
				{#if gravitySet.size > 1}
					<span class="flex shrink-0 items-center gap-1.5 group-hover:hidden">
						{#each GRAVITIES as g (g.id)}
							{#if gravitySet.has(g.id)}
								<span class="flex items-center gap-0.5 text-[10px] tabular-nums" title={g.label}>
									<span
										class="inline-block h-1.5 w-1.5 rounded-full"
										style="background-color: {g.color}"
									></span>
									<span class="text-gray-500">{numFmt.format(e.breakdown[g.id])}</span>
								</span>
							{/if}
						{/each}
					</span>
				{:else}
					<span class="shrink-0 text-[10px] text-gray-400 tabular-nums group-hover:hidden">
						{numFmt.format(e.total)}
					</span>
				{/if}
			</label>
		{/each}
		{#if entries.length > limit && !search}
			<p class="mt-1 px-1 text-[10px] text-gray-400">
				…et {entries.length - limit} autres. Utiliser la recherche.
			</p>
		{/if}
	{/if}
</div>
