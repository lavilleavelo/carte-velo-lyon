<script lang="ts">
	import { CustomControl } from 'svelte-maplibre-gl';
	import Map from '@lucide/svelte/icons/map';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import * as Dialog from '$lib/components/ui/dialog';
	import MobileDrawer from '$lib/components/MobileDrawer.svelte';
	import MapStylePreview from './MapStylePreview.svelte';
	import type { MapStyle } from '$lib/utils/mapStyleToggle.svelte';

	interface Props {
		currentStyle: MapStyle;
		onSelect: (style: MapStyle) => void;
		position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
		buttonClass?: string;
	}

	let { currentStyle, onSelect, position = 'top-right', buttonClass = 'pl-1!' }: Props = $props();

	let open = $state(false);
	let innerWidth = $state(0);
	const isDesktop = $derived(innerWidth === 0 || innerWidth >= 1024);

	const styles: { id: MapStyle; label: string; description: string }[] = [
		{ id: 'cyclopolis', label: 'Par défaut', description: 'Style clair avec détails' },
		{ id: 'neutrino', label: 'Neutre', description: 'Fond clair et minimaliste' },
		{ id: 'positron', label: 'Monochrome', description: 'Fond clair monochrome' },
		{
			id: 'osm-bright',
			label: 'OSM Bright',
			description: 'Style coloré avec bâtiments 3D',
		},
		{ id: 'osm-eu', label: 'OSM-eu', description: 'Fond neutre OSM Europe' },
		{ id: 'hybrid', label: 'Satellite hybride', description: 'Photos aériennes IGN + rues' },
		{ id: 'satellite', label: 'Satellite', description: 'Photos aériennes IGN seules' },
		{ id: 'cyclosm', label: 'CyclOSM', description: 'Style OpenStreetMap alternatif vélo' },
	];

	function select(style: MapStyle) {
		onSelect(style);
		open = false;
	}
</script>

<svelte:window bind:innerWidth />

<CustomControl {position}>
	<button
		onclick={() => (open = true)}
		class="rounded-lg bg-white text-gray-700 shadow-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none {buttonClass}"
		aria-label="Changer le style de carte"
		title="Changer le style de carte"
	>
		<Map size={20} />
	</button>
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

{#if isDesktop}
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
{:else}
	<MobileDrawer bind:open snapPoints={[0.7, 0.95]} initialSnapPoint={0}>
		<h2 class="px-2 pb-3 text-base font-semibold text-gray-900">Style de carte</h2>
		{@render grid()}
	</MobileDrawer>
{/if}
