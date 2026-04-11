<script lang="ts">
	import { CustomControl } from 'svelte-maplibre-gl';
	import Map from '@lucide/svelte/icons/map';
	import type { MapStyle } from '$lib/utils/mapStyleToggle.svelte';

	interface Props {
		currentStyle: MapStyle;
		onSelect: (style: MapStyle) => void;
		position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
	}

	let { currentStyle, onSelect, position = 'top-right' }: Props = $props();

	let open = $state(false);
	let buttonEl: HTMLButtonElement | undefined = $state();
	let menuStyle = $state('');

	const styles: { id: MapStyle; label: string; description: string }[] = [
		{ id: 'cyclopolis', label: 'Par défaut', description: 'Style par défaut' },
		{ id: 'positron', label: 'Positron', description: 'Fond clair et minimaliste' },
		{
			id: 'osm-bright',
			label: 'OSM Bright',
			description: 'Style coloré alternatif avec bâtiments 3D',
		},
		{ id: 'hybrid', label: 'Satellite hybride', description: 'Photos aériennes IGN + rues' },
		{ id: 'satellite', label: 'Satellite', description: 'Photos aériennes IGN seules' },
		{ id: 'cyclosm', label: 'CyclOSM', description: 'Style OpenStreetMap alternatif vélo' },
	];

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		if (!open && buttonEl) {
			const rect = buttonEl.getBoundingClientRect();
			const spaceBelow = window.innerHeight - rect.bottom;
			const menuHeight = styles.length * 52 + 12;

			if (position.startsWith('bottom') || spaceBelow < menuHeight) {
				menuStyle = `bottom: ${window.innerHeight - rect.top + 4}px; right: ${window.innerWidth - rect.right}px;`;
			} else {
				menuStyle = `top: ${rect.bottom + 4}px; right: ${window.innerWidth - rect.right}px;`;
			}
		}
		open = !open;
	}

	function select(style: MapStyle) {
		onSelect(style);
		open = false;
	}
</script>

<svelte:window
	onclick={() => {
		if (open) open = false;
	}}
/>

<CustomControl {position}>
	<button
		bind:this={buttonEl}
		onclick={toggle}
		class="bg-whitetext-gray-700 rounded-lg pl-1! shadow-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		aria-label="Changer le style de carte"
		title="Changer le style de carte"
	>
		<Map size={20} />
	</button>
</CustomControl>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		onclick={(e) => e.stopPropagation()}
		class="fixed z-50 min-w-56 rounded-lg bg-white p-1 shadow-lg ring-1 ring-black/5"
		style={menuStyle}
	>
		{#each styles as style}
			<button
				onclick={() => select(style.id)}
				class="flex w-full items-center justify-between gap-3 rounded-md px-3 py-1.5 text-left text-sm transition-colors"
				class:bg-gray-100={currentStyle === style.id}
				class:hover:bg-gray-50={currentStyle !== style.id}
			>
				<span class="flex flex-col">
					<span class="text-gray-800" class:font-semibold={currentStyle === style.id}>
						{style.label}
					</span>
					<span class="text-xs text-gray-500">{style.description}</span>
				</span>
				{#if currentStyle === style.id}
					<svg class="h-4 w-4 shrink-0 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
							clip-rule="evenodd"
						/>
					</svg>
				{/if}
			</button>
		{/each}
	</div>
{/if}
