<script lang="ts">
	import { onDestroy } from 'svelte';
	import { CustomControl } from 'svelte-maplibre-gl';
	import Map from '@lucide/svelte/icons/map';
	import Layers from '@lucide/svelte/icons/layers';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import * as Dialog from '$lib/components/ui/dialog';
	import MobileDrawer from '$lib/components/MobileDrawer.svelte';
	import MapStylePreview from './MapStylePreview.svelte';
	import type { MapStyle } from '$lib/utils/mapStyleToggle.svelte';

	type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

	interface Props {
		currentStyle: MapStyle;
		onSelect: (style: MapStyle) => void;
		position?: Position;
		buttonClass?: string;
		variant?: 'icon' | 'thumbnail';
		thumbnailPosition?: Position;
	}

	let {
		currentStyle,
		onSelect,
		position = 'top-right',
		buttonClass = 'pl-1!',
		variant = 'icon',
		thumbnailPosition = 'bottom-left',
	}: Props = $props();

	let open = $state(false);
	let innerWidth = $state(0);
	const isDesktop = $derived(innerWidth === 0 || innerWidth >= 1024);
	const showThumbnail = $derived(variant === 'thumbnail' && isDesktop);
	const effectivePosition = $derived(showThumbnail ? thumbnailPosition : position);

	const styles: { id: MapStyle; label: string; shortLabel?: string; description: string }[] = [
		{ id: 'cyclopolis', label: 'Par défaut', description: 'Style clair avec détails' },
		{ id: 'neutrino', label: 'Neutre', description: 'Fond clair et minimaliste' },
		{ id: 'positron', label: 'Monochrome', description: 'Fond clair monochrome' },
		{
			id: 'osm-bright',
			label: 'OSM Bright',
			description: 'Style coloré avec bâtiments 3D',
		},
		{ id: 'osm-eu', label: 'OSM-eu', description: 'Fond neutre OSM Europe' },
		{
			id: 'hybrid',
			label: 'Satellite hybride',
			shortLabel: 'Hybride',
			description: 'Photos aériennes IGN + rues',
		},
		{ id: 'satellite', label: 'Satellite', description: 'Photos aériennes IGN seules' },
		{ id: 'cyclosm', label: 'CyclOSM', description: 'Style OpenStreetMap alternatif vélo' },
	];

	function select(style: MapStyle) {
		onSelect(style);
		open = false;
	}

	// Thumbnail variant: the tile previews the style a click switches to (aerial <-> last plan).
	const AERIAL_STYLES: MapStyle[] = ['hybrid', 'satellite'];
	const isAerial = $derived(AERIAL_STYLES.includes(currentStyle));
	let lastPlanStyle = $state<MapStyle>('cyclopolis');
	$effect(() => {
		if (!isAerial) {
			lastPlanStyle = currentStyle;
		}
	});
	const altStyle = $derived<MapStyle>(isAerial ? lastPlanStyle : 'hybrid');
	const altLabel = $derived(styles.find((s) => s.id === altStyle)?.label ?? altStyle);

	let expanded = $state(false);
	let closeTimer: ReturnType<typeof setTimeout> | undefined;
	const canHover =
		typeof window === 'undefined' ||
		!window.matchMedia ||
		window.matchMedia('(hover: hover)').matches;

	function expand() {
		clearTimeout(closeTimer);
		expanded = true;
	}

	function collapseSoon() {
		clearTimeout(closeTimer);
		closeTimer = setTimeout(() => (expanded = false), 200);
	}

	function handleTileClick() {
		// Without hover (touch screens), the tile opens the flyout instead of toggling.
		if (!canHover) {
			expanded = !expanded;
			return;
		}
		onSelect(altStyle);
	}

	function handleFocusOut(e: FocusEvent) {
		const next = e.relatedTarget as Node | null;
		if (!next || !(e.currentTarget as HTMLElement).contains(next)) {
			collapseSoon();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && expanded) {
			e.stopPropagation();
			clearTimeout(closeTimer);
			expanded = false;
		}
	}

	onDestroy(() => clearTimeout(closeTimer));

	const flyoutSide = $derived(
		thumbnailPosition.endsWith('left') ? 'left-full pl-2' : 'right-full pr-2',
	);
	const flyoutAlign = $derived(thumbnailPosition.startsWith('bottom') ? 'bottom-0' : 'top-0');
</script>

<svelte:window bind:innerWidth />

<CustomControl
	position={effectivePosition}
	group={!showThumbnail}
	class={showThumbnail ? `relative ${expanded ? 'z-50' : ''}` : ''}
>
	{#if showThumbnail}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="relative"
			onmouseenter={canHover ? expand : undefined}
			onmouseleave={canHover ? collapseSoon : undefined}
			onfocusin={expand}
			onfocusout={handleFocusOut}
			onkeydown={handleKeydown}
		>
			<button
				type="button"
				onclick={handleTileClick}
				class="group relative block h-24 w-24 overflow-hidden rounded-xl border-2 border-white bg-gray-100 shadow-md transition hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
				aria-label={canHover ? `Basculer vers le style ${altLabel}` : 'Changer le style de carte'}
				title={canHover ? `Basculer vers : ${altLabel}` : 'Changer le style de carte'}
				aria-expanded={expanded}
			>
				<span class="block h-full w-full transition-transform duration-200 group-hover:scale-105">
					<MapStylePreview styleId={altStyle} />
				</span>
				<span
					class="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 pt-5 pb-1.5 text-xs font-medium text-white"
				>
					<Layers size={14} />
					Style
				</span>
			</button>

			{#if expanded}
				<div class="absolute {flyoutSide} {flyoutAlign}">
					<div
						role="group"
						aria-label="Style de carte"
						class="grid w-max grid-cols-4 gap-x-2.5 gap-y-3 rounded-xl bg-white p-3 shadow-lg ring-1 ring-black/5"
					>
						{#each styles as style (style.id)}
							{@const selected = currentStyle === style.id}
							<button
								type="button"
								onclick={() => onSelect(style.id)}
								aria-pressed={selected}
								title={style.description}
								class="group/item flex w-[104px] flex-col items-center gap-1.5 rounded-lg focus:outline-none"
							>
								<span
									class="relative block h-[72px] w-[104px] overflow-hidden rounded-lg border-2 bg-gray-100 transition group-focus-visible/item:ring-2 group-focus-visible/item:ring-blue-500 {selected
										? 'border-blue-600'
										: 'border-transparent group-hover/item:border-gray-300'}"
								>
									<MapStylePreview styleId={style.id} />
								</span>
								<span
									class="w-full truncate text-center text-xs leading-tight {selected
										? 'font-semibold text-blue-700'
										: 'text-gray-700'}"
								>
									{style.shortLabel ?? style.label}
								</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<button
			onclick={() => (open = true)}
			class="rounded-lg bg-white text-gray-700 shadow-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none {buttonClass}"
			aria-label="Changer le style de carte"
			title="Changer le style de carte"
		>
			<Map size={20} />
		</button>
	{/if}
</CustomControl>

{#snippet grid()}
	<div class="grid grid-cols-2 gap-3">
		{#each styles as style (style.id)}
			{@const selected = currentStyle === style.id}
			<button
				type="button"
				onclick={() => select(style.id)}
				aria-pressed={selected}
				class="group relative flex flex-col overflow-hidden rounded-lg border bg-white text-left transition hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 {selected
					? 'border-blue-600 ring-2 ring-blue-600'
					: 'border-gray-200 hover:border-blue-400'}"
			>
				<div class="relative h-24 w-full overflow-hidden bg-gray-100">
					<MapStylePreview styleId={style.id} alt={style.label} />
					{#if selected}
						<div
							class="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 shadow"
						>
							<Check size={14} class="text-white" />
						</div>
					{/if}
				</div>
				<div class="px-3 py-2">
					<div class="text-sm font-medium text-gray-900">{style.label}</div>
					<div class="mt-0.5 text-xs text-gray-500">{style.description}</div>
				</div>
			</button>
		{/each}
	</div>
{/snippet}

{#if !isDesktop}
	<MobileDrawer bind:open snapPoints={[0.7, 0.95]} initialSnapPoint={0}>
		<h2 class="px-2 pb-3 text-base font-semibold text-gray-900">Style de carte</h2>
		{@render grid()}
	</MobileDrawer>
{:else if !showThumbnail}
	<Dialog.Root bind:open>
		<Dialog.Content class="max-w-2xl" showCloseButton={false}>
			<div class="flex items-center justify-between">
				<Dialog.Title>Style de carte</Dialog.Title>
				<Dialog.Close
					class="rounded-md p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
					aria-label="Fermer"
				>
					<X size={18} />
				</Dialog.Close>
			</div>
			<Dialog.Description class="sr-only">Choisir un style de carte</Dialog.Description>
			{@render grid()}
		</Dialog.Content>
	</Dialog.Root>
{/if}
