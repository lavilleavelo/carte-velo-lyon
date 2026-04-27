<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { buildCommuneHref } from '$lib/utils/communeNavigation';
	import SearchIcon from '@lucide/svelte/icons/search';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import MapIcon from '@lucide/svelte/icons/map';
	import Building2 from '@lucide/svelte/icons/building-2';
	import Info from '@lucide/svelte/icons/info';
	import * as Command from '$lib/components/ui/command/index.js';
	import { onMount } from 'svelte';
	import { computeCommandScore } from 'bits-ui';
	import communesIndex from '$lib/data/communes/_index.json';

	type Commune = { slug: string; name: string; insee: string };
	const communes = communesIndex as Commune[];

	let open = $state(false);
	let searchValue = $state('');
	let isTouchDevice = $state(false);

	function handleOpenWithTouch(e: MouseEvent | PointerEvent) {
		isTouchDevice = e instanceof PointerEvent && e.pointerType === 'touch';
		e.stopPropagation();
		open = true;
	}

	function go(path: string) {
		open = false;
		searchValue = '';
		goto(path);
	}

	onMount(() => {
		if (!browser) return;
		function handleKeydown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				open = !open;
			}
		}
		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	});

	function normalize(s: string): string {
		return s
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
	}

	function customFilter(value: string, search: string, keywords?: string[]): number {
		const ns = normalize(search);
		const nv = normalize(value);
		if (nv.includes(ns)) return 1;
		return computeCommandScore(value, search, keywords);
	}
</script>

<Command.Dialog
	bind:open
	bind:value={searchValue}
	filter={customFilter}
	title="Rechercher"
	description="Accédez à une page ou une commune"
	{isTouchDevice}
>
	<Command.Input placeholder="Rechercher par nom, code INSEE, page..." />
	<Command.List>
		<Command.Empty>Aucun résultat.</Command.Empty>
		<Command.Group heading="Navigation">
			<Command.Item value="Carte|Accueil|/" onSelect={() => go('/')}>
				<MapIcon class="mr-2 h-4 w-4" />
				<span>Carte</span>
			</Command.Item>
			<Command.Item value="Communes|/communes" onSelect={() => go('/communes')}>
				<Building2 class="mr-2 h-4 w-4" />
				<span>Communes</span>
			</Command.Item>
			<Command.Item value="À propos|/a-propos" onSelect={() => go('/a-propos')}>
				<Info class="mr-2 h-4 w-4" />
				<span>À propos</span>
			</Command.Item>
		</Command.Group>
		<Command.Separator />
		<Command.Group heading="Communes">
			{#each communes as commune (commune.insee)}
				<Command.Item
					value={`${commune.name}|${commune.slug}|${commune.insee}`}
					onSelect={() => go(buildCommuneHref(commune.slug))}
				>
					<MapPinIcon class="mr-2 h-4 w-4" />
					<span>{commune.name}</span>
					<span class="ml-auto text-xs text-muted-foreground">INSEE {commune.insee}</span>
				</Command.Item>
			{/each}
		</Command.Group>
	</Command.List>
</Command.Dialog>

<button
	type="button"
	onpointerdown={handleOpenWithTouch}
	class="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-brand-teal"
	aria-label="Rechercher (Cmd+K)"
>
	<SearchIcon class="h-4 w-4" />
	<span class="hidden sm:inline">Rechercher</span>
	<kbd
		class="pointer-events-none ml-2 hidden h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 select-none sm:flex"
	>
		<span class="text-xs">⌘</span>K
	</kbd>
</button>
