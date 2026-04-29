<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox';
	import {
		GRAVITIES,
		shortCommuneLabel,
		totalForBreakdown,
		type Breakdown,
	} from './types';

	type CommuneEntry = { slug: string; name: string; insee: string };

	let {
		arrondissements,
		other,
		communeSet,
		communesAll,
		communesNone,
		communeBreakdown,
		gravitySet,
		search = $bindable(''),
		onToggle,
		onSolo,
		onSelectAll,
		onClear,
	}: {
		arrondissements: CommuneEntry[];
		other: CommuneEntry[];
		communeSet: Set<string>;
		communesAll: boolean;
		communesNone: boolean;
		communeBreakdown: Map<string, Breakdown>;
		gravitySet: Set<string>;
		search?: string;
		onToggle: (name: string) => void;
		onSolo: (name: string) => void;
		onSelectAll: () => void;
		onClear: () => void;
	} = $props();

	const numFmt = new Intl.NumberFormat('fr-FR');

	function sortByCasualtiesDesc(communes: CommuneEntry[]): CommuneEntry[] {
		return [...communes].sort((a, b) => {
			const ta = totalForBreakdown(communeBreakdown.get(a.name), gravitySet);
			const tb = totalForBreakdown(communeBreakdown.get(b.name), gravitySet);
			if (tb !== ta) return tb - ta;
			return a.name.localeCompare(b.name, 'fr');
		});
	}

	const visibleArrondissements = $derived(
		sortByCasualtiesDesc(
			arrondissements.filter((c) =>
				!search ? true : c.name.toLowerCase().includes(search.toLowerCase()),
			),
		),
	);
	const visibleOther = $derived(
		sortByCasualtiesDesc(
			other.filter((c) =>
				!search ? true : c.name.toLowerCase().includes(search.toLowerCase()),
			),
		),
	);
</script>

{#snippet row(c: CommuneEntry)}
	{@const breakdown = communeBreakdown.get(c.name)}
	{@const total = totalForBreakdown(breakdown, gravitySet)}
	{@const checked = communesAll ? true : communesNone ? false : communeSet.has(c.name)}
	<label
		class="group relative flex cursor-pointer items-center gap-2 rounded-md p-1 hover:bg-gray-50"
	>
		<Checkbox
			{checked}
			onCheckedChange={() => onToggle(c.name)}
			class="border-gray-300"
		/>
		<span class="flex-1 text-xs text-gray-700">{shortCommuneLabel(c.name)}</span>
		<button
			type="button"
			onclick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				onSolo(c.name);
			}}
			title="Sélectionner uniquement {shortCommuneLabel(c.name)}"
			class="hidden text-[10px] font-semibold text-brand-navy hover:underline group-hover:inline"
		>
			seul
		</button>
		{#if gravitySet.size > 1 && breakdown}
			<span class="flex items-center gap-1.5 group-hover:hidden">
				{#each GRAVITIES as g (g.id)}
					{#if gravitySet.has(g.id)}
						<span
							class="flex items-center gap-0.5 text-[10px] tabular-nums"
							title={g.label}
						>
							<span
								class="inline-block h-1.5 w-1.5 rounded-full"
								style="background-color: {g.color}"
							></span>
							<span class="text-gray-500">{numFmt.format(breakdown[g.id])}</span>
						</span>
					{/if}
				{/each}
			</span>
		{:else}
			<span class="text-[10px] tabular-nums text-gray-400 group-hover:hidden"
				>{numFmt.format(total)}</span
			>
		{/if}
	</label>
{/snippet}

<input
	type="text"
	bind:value={search}
	placeholder="Rechercher une commune…"
	class="mb-2 w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs placeholder-gray-400 focus:border-brand-navy focus:ring-1 focus:ring-brand-navy focus:outline-none"
/>
<div class="flex flex-col" style="max-height: 200px; overflow-y: auto;">
	{#if visibleArrondissements.length > 0}
		<p class="mt-1 mb-0.5 px-1.5 text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
			Arrondissements de Lyon
		</p>
		{#each visibleArrondissements as c (c.slug)}
			{@render row(c)}
		{/each}
	{/if}
	{#if visibleOther.length > 0}
		<p class="mt-2 mb-0.5 px-1.5 text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
			Communes
		</p>
		{#each visibleOther as c (c.slug)}
			{@render row(c)}
		{/each}
	{/if}
	{#if visibleArrondissements.length === 0 && visibleOther.length === 0}
		<p class="px-2 py-3 text-xs text-gray-400">Aucune commune trouvée.</p>
	{/if}
</div>
