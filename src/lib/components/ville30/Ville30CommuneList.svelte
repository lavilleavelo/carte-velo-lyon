<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Ville30SpeedBar from '$lib/components/ville30/Ville30SpeedBar.svelte';
	import { matchesAllTokens, tokenize } from '$lib/utils/textSearch';
	import type { Ville30CommuneRow, Ville30SearchParams } from '$lib/utils/ville30';

	let {
		communes,
		params,
		hoveredSlug = $bindable(null),
		onSelect,
	}: {
		communes: Ville30CommuneRow[];
		params: Ville30SearchParams;
		hoveredSlug?: string | null;
		onSelect: (slug: string) => void;
	} = $props();

	const FILTERS = [
		{ id: 'all', label: 'Toutes' },
		{ id: 'ville30', label: 'Ville 30' },
		{ id: 'other', label: 'Non Ville 30' },
	] as const;

	const SORTS = [
		{ id: 'pct', label: 'Part à 30 km/h' },
		{ id: 'name', label: 'Nom' },
		{ id: 'date', label: "Date d'adoption" },
	] as const;

	const collator = new Intl.Collator('fr', { sensitivity: 'base' });
	const pctFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
	const dateFormatter = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'short' });

	function formatDate(date: string | null): string | null {
		if (!date) return null;
		const d = new Date(date);
		return Number.isNaN(d.getTime()) ? null : dateFormatter.format(d);
	}

	const counts = $derived({
		all: communes.length,
		ville30: communes.filter((c) => c.status !== 'none').length,
		other: communes.filter((c) => c.status === 'none').length,
	});

	function compare(a: Ville30CommuneRow, b: Ville30CommuneRow): number {
		if (params.sort === 'pct') {
			const diff = (b.pct ?? -1) - (a.pct ?? -1);
			if (diff !== 0) return diff;
		} else if (params.sort === 'date') {
			const rank = (c: Ville30CommuneRow) => (c.status === 'none' ? 2 : c.adoptedAt ? 0 : 1);
			const diff = rank(a) - rank(b);
			if (diff !== 0) return diff;
			if (a.adoptedAt && b.adoptedAt && a.adoptedAt !== b.adoptedAt) {
				return a.adoptedAt.localeCompare(b.adoptedAt);
			}
		}
		return collator.compare(a.name, b.name);
	}

	const visible = $derived.by(() => {
		const tokens = tokenize(params.q);
		return communes
			.filter((c) => {
				if (params.filter === 'ville30' && c.status === 'none') return false;
				if (params.filter === 'other' && c.status !== 'none') return false;
				return matchesAllTokens(c.name, tokens);
			})
			.sort(compare);
	});

	let listEl: HTMLUListElement | undefined = $state();

	// Keep the selected commune visible when it is picked from the map. Only scroll the
	// list itself (desktop sidebar), never the page.
	// runed hands back a new params snapshot on every URL update: only react to actual
	// selection changes.
	let scrolledToSlug: string | undefined;
	$effect(() => {
		const slug = params.commune;
		if (slug === scrolledToSlug) return;
		scrolledToSlug = slug;
		if (!slug || !listEl || listEl.scrollHeight <= listEl.clientHeight) return;
		const row = listEl.querySelector<HTMLElement>(`[data-slug="${CSS.escape(slug)}"]`);
		if (!row) return;
		const r = row.getBoundingClientRect();
		const l = listEl.getBoundingClientRect();
		if (r.top < l.top) listEl.scrollTop += r.top - l.top - 8;
		else if (r.bottom > l.bottom) listEl.scrollTop += r.bottom - l.bottom + 8;
	});
</script>

<div class="flex min-h-0 flex-col">
	<div class="space-y-2 border-b border-gray-200 bg-white pb-3">
		<label class="relative block">
			<span class="sr-only">Rechercher une commune</span>
			<Search
				class="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400"
				aria-hidden="true"
			/>
			<input
				type="search"
				placeholder="Rechercher une commune"
				bind:value={params.q}
				class="w-full rounded-md border border-gray-300 py-2 pr-8 pl-8 text-base focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/30 focus:outline-none sm:text-sm"
			/>
			{#if params.q}
				<button
					type="button"
					class="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700"
					aria-label="Effacer la recherche"
					onclick={() => (params.q = '')}
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		</label>

		<div class="flex flex-wrap items-center justify-between gap-2">
			<div class="flex gap-1" role="group" aria-label="Filtrer les communes">
				{#each FILTERS as f (f.id)}
					{@const active = params.filter === f.id}
					<button
						type="button"
						aria-pressed={active}
						onclick={() => (params.filter = f.id)}
						class="rounded-full border px-2.5 py-1 text-xs font-medium transition-colors {active
							? 'border-brand-navy bg-brand-navy text-white'
							: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
					>
						{f.label}
						<span class={active ? 'text-white/70' : 'text-gray-400'}>{counts[f.id]}</span>
					</button>
				{/each}
			</div>
			<label class="flex items-center gap-1.5 text-xs text-gray-600">
				Trier par
				<span class="relative">
					<select
						bind:value={params.sort}
						class="appearance-none rounded-md border border-gray-300 bg-white py-1 pr-7 pl-2 text-xs text-gray-800 focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/30 focus:outline-none"
					>
						{#each SORTS as s (s.id)}
							<option value={s.id}>{s.label}</option>
						{/each}
					</select>
					<ChevronDown
						class="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500"
						aria-hidden="true"
					/>
				</span>
			</label>
		</div>
	</div>

	<ul bind:this={listEl} class="min-h-0 flex-1 space-y-1.5 overflow-y-auto pt-3 lg:pr-1">
		{#each visible as c (c.slug)}
			{@const selected = params.commune === c.slug}
			{@const date = formatDate(c.adoptedAt)}
			<li data-slug={c.slug}>
				<button
					type="button"
					aria-pressed={selected}
					onclick={() => onSelect(c.slug)}
					onmouseenter={() => (hoveredSlug = c.slug)}
					onmouseleave={() => (hoveredSlug = null)}
					onfocus={() => (hoveredSlug = c.slug)}
					onblur={() => (hoveredSlug = null)}
					class="w-full rounded-md border px-3 py-2 text-left transition-colors {selected
						? 'border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy'
						: hoveredSlug === c.slug
							? 'border-brand-navy/40 bg-gray-50'
							: 'border-gray-200 bg-white hover:border-brand-navy/40 hover:bg-gray-50'}"
				>
					<span class="flex items-baseline justify-between gap-2">
						<span class="truncate text-sm font-semibold text-brand-navy">{c.name}</span>
						<span class="shrink-0 text-sm font-bold text-brand-navy tabular-nums">
							{c.pct === null ? '–' : `${pctFormatter.format(c.pct)} %`}
						</span>
					</span>
					<Ville30SpeedBar pct={c.pct} class="mt-1.5" />
					<span class="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500">
						{#if c.status === 'full'}
							<span
								class="rounded-full bg-brand-teal/25 px-1.5 py-px font-semibold text-brand-navy"
							>
								Ville 30
							</span>
						{:else if c.status === 'partial'}
							<span class="rounded-full bg-amber-100 px-1.5 py-px font-semibold text-amber-800">
								Ville 30 partielle
							</span>
						{:else}
							<span class="rounded-full bg-gray-100 px-1.5 py-px font-medium text-gray-600">
								Non adoptée
							</span>
						{/if}
						{#if date}
							<span>depuis {date}</span>
						{/if}
					</span>
				</button>
			</li>
		{:else}
			<li class="py-6 text-center text-sm text-gray-500">Aucune commune ne correspond.</li>
		{/each}
	</ul>
</div>
