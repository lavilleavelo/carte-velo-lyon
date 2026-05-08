<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { buildCommuneHref } from '$lib/utils/communeNavigation';
	import SearchIcon from '@lucide/svelte/icons/search';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import MapIcon from '@lucide/svelte/icons/map';
	import Building2 from '@lucide/svelte/icons/building-2';
	import Info from '@lucide/svelte/icons/info';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Gauge from '@lucide/svelte/icons/gauge';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Bike from '@lucide/svelte/icons/bike';
	import FileText from '@lucide/svelte/icons/file-text';
	import * as Command from '$lib/components/ui/command/index.js';
	import { onMount } from 'svelte';
	import { computeCommandScore } from 'bits-ui';
	import communesIndex from '$lib/data/communes/_index.json';
	import { getAllFiches } from '$lib/content/fiches';
	import { isMacPlatform } from '$lib/utils/platform';
	import { normalizeForSearch as normalize } from '$lib/utils/textSearch';

	type Commune = { slug: string; name: string; insee: string };
	const communes = communesIndex as Commune[];
	const fiches = getAllFiches();

	let { open = $bindable(false), showTrigger = true }: { open?: boolean; showTrigger?: boolean } =
		$props();
	let searchValue = $state('');
	let inputValue = $state('');
	let isTouchDevice = $state(false);
	let isMac = $state(false);

	const hasSearch = $derived(inputValue.trim().length > 0);

	function handleOpenWithTouch(e: MouseEvent | PointerEvent) {
		isTouchDevice = e instanceof PointerEvent && e.pointerType === 'touch';
		e.stopPropagation();
		open = true;
	}

	function handleOpenAutoFocus(e: Event) {
		if (isTouchDevice) e.preventDefault();
	}

	function go(path: string) {
		open = false;
		searchValue = '';
		inputValue = '';
		goto(path);
	}

	onMount(() => {
		if (!browser) {
			return;
		}

		isMac = isMacPlatform();

		function handleKeydown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				open = !open;
			}
		}
		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	});

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
	onOpenAutoFocus={handleOpenAutoFocus}
	contentClass="top-[15%] translate-y-0"
>
	<Command.Input bind:value={inputValue} placeholder="Rechercher par nom, code INSEE, page..." />
	<Command.List class="max-h-[60vh]">
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
			<Command.Item
				value="Ville 30|Ville30|limitation vitesse 30 km/h|/ville-30"
				onSelect={() => go('/ville-30')}
			>
				<Gauge class="mr-2 h-4 w-4" />
				<span>Ville 30</span>
			</Command.Item>
			<Command.Item
				value="Accidents vélo|accidents|BAAC|/accidents"
				onSelect={() => go('/accidents')}
			>
				<AlertTriangle class="mr-2 h-4 w-4" />
				<span>Accidents vélo</span>
			</Command.Item>
			<Command.Item
				value="Vélo'v|velov|stations|disponibilité|/velov"
				onSelect={() => go('/velov')}
			>
				<Bike class="mr-2 h-4 w-4" />
				<span>Vélo’v</span>
			</Command.Item>
			<Command.Item value="À propos|/a-propos" onSelect={() => go('/a-propos')}>
				<Info class="mr-2 h-4 w-4" />
				<span>À propos</span>
			</Command.Item>
			<Command.Item
				value="Légende|conditions OSM|OpenStreetMap|documentation|/legende"
				onSelect={() => go('/legende')}
			>
				<BookOpen class="mr-2 h-4 w-4" />
				<span>Légende</span>
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
		{#if hasSearch && fiches.length > 0}
			<Command.Separator />
			<Command.Group heading="Fiches">
				{#each fiches as fiche (fiche.slug)}
					<Command.Item
						value={`${fiche.title}|${fiche.subtitle ?? ''}|${fiche.address ?? ''}|${fiche.slug}`}
						onSelect={() => go(`/fiches/${fiche.slug}`)}
					>
						<FileText class="mr-2 h-4 w-4" />
						<span>{fiche.title}</span>
						{#if fiche.subtitle}
							<span class="ml-auto text-xs text-muted-foreground">{fiche.subtitle}</span>
						{/if}
					</Command.Item>
				{/each}
			</Command.Group>
		{/if}
	</Command.List>
</Command.Dialog>

{#if showTrigger}
	<button
		type="button"
		onpointerdown={handleOpenWithTouch}
		class="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-brand-teal"
		aria-label={isMac ? 'Rechercher (Cmd+K)' : 'Rechercher (Ctrl+K)'}
	>
		<SearchIcon class="h-4 w-4" />
		<span class="hidden sm:inline">Rechercher</span>
		<kbd
			class="pointer-events-none ml-2 hidden h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 select-none sm:flex"
		>
			{#if isMac}
				<span class="text-xs">⌘</span>K
			{:else}
				<span>Ctrl</span>+<span>K</span>
			{/if}
		</kbd>
	</button>
{/if}
