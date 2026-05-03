<script lang="ts">
	import { goto } from '$app/navigation';
	import SearchIcon from '@lucide/svelte/icons/search';
	import Building2 from '@lucide/svelte/icons/building-2';
	import { buildCommuneHref } from '$lib/utils/communeNavigation';
	import { matchesAllTokens, tokenize } from '$lib/utils/textSearch';
	import communesIndex from '$lib/data/communes/_index.json';

	type Commune = { slug: string; name: string; insee: string };
	const communes = communesIndex as Commune[];

	let { class: className = '' }: { class?: string } = $props();

	let query = $state('');
	let isOpen = $state(false);
	let highlightedIndex = $state(0);
	let inputEl: HTMLInputElement | undefined = $state();
	let containerEl: HTMLDivElement | undefined = $state();

	const results = $derived.by<Commune[]>(() => {
		const tokens = tokenize(query);
		if (tokens.length === 0) {
			return [];
		}

		const out: Commune[] = [];
		for (const c of communes) {
			const hay = `${c.name} ${c.insee}`;
			if (matchesAllTokens(hay, tokens)) {
				out.push(c);
				if (out.length >= 8) {
					break;
				}
			}
		}

		return out;
	});

	$effect(() => {
		if (results.length === 0) {
			highlightedIndex = 0;
		} else if (highlightedIndex >= results.length) {
			highlightedIndex = results.length - 1;
		}
	});

	function selectCommune(c: Commune) {
		query = '';
		isOpen = false;
		inputEl?.blur();
		goto(buildCommuneHref(c.slug));
	}

	function gotoAllCommunes() {
		query = '';
		isOpen = false;
		inputEl?.blur();
		goto('/communes');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!isOpen) {
			return;
		}

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlightedIndex = Math.min(highlightedIndex + 1, Math.max(0, results.length - 1));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightedIndex = Math.max(highlightedIndex - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (results.length > 0) {
				selectCommune(results[highlightedIndex] ?? results[0]);
			}
		} else if (e.key === 'Escape') {
			isOpen = false;
			inputEl?.blur();
		}
	}

	function handleFocus() {
		isOpen = true;
	}

	function handleBlur(e: FocusEvent) {
		const next = e.relatedTarget as Node | null;
		if (next && containerEl?.contains(next)) {
			return;
		}

		setTimeout(() => {
			isOpen = false;
		}, 120);
	}
</script>

<div bind:this={containerEl} class="relative {className}" role="search">
	<SearchIcon
		class="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400"
	/>
	<input
		bind:this={inputEl}
		bind:value={query}
		onfocus={handleFocus}
		onblur={handleBlur}
		onkeydown={handleKeydown}
		type="search"
		placeholder="Rechercher une commune"
		aria-label="Rechercher une commune"
		aria-controls="commune-search-results"
		class="w-full rounded-md border border-gray-200 bg-white py-1.5 pr-3 pl-8 text-sm text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-brand-navy focus:ring-1 focus:ring-brand-navy focus:outline-none"
	/>

	{#if isOpen && (results.length > 0 || query.trim().length > 0)}
		<div
			id="commune-search-results"
			role="listbox"
			class="absolute top-full right-0 left-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"
		>
			{#if results.length === 0}
				<p class="px-3 py-2.5 text-sm text-gray-500">
					Aucune commune ne correspond à « {query.trim()} ».
				</p>
			{:else}
				<ul class="py-1">
					{#each results as c, i (c.slug)}
						<li>
							<button
								type="button"
								role="option"
								aria-selected={i === highlightedIndex}
								onmousedown={(e) => {
									e.preventDefault();
									selectCommune(c);
								}}
								onmouseenter={() => (highlightedIndex = i)}
								class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm {i ===
								highlightedIndex
									? 'bg-gray-100 text-brand-navy'
									: 'text-gray-700'} hover:bg-gray-50"
							>
								<Building2 class="h-3.5 w-3.5 shrink-0 text-gray-400" />
								<span class="truncate">{c.name}</span>
								<span class="ml-auto text-xs text-gray-400 tabular-nums">{c.insee}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			<div class="border-t border-gray-100">
				<button
					type="button"
					onmousedown={(e) => {
						e.preventDefault();
						gotoAllCommunes();
					}}
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-brand-navy transition-colors hover:bg-gray-50"
				>
					<Building2 class="h-3.5 w-3.5" />
					Voir toutes les communes
				</button>
			</div>
		</div>
	{/if}
</div>
