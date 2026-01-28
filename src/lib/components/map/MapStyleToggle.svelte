<script lang="ts">
	import { CustomControl } from 'svelte-maplibre-gl';
	import Map from '@lucide/svelte/icons/map';

	interface Props {
		onToggle: () => void;
		position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
	}

	let { onToggle, position = 'top-right' }: Props = $props();
</script>

<CustomControl {position}>
	<button
		onclick={onToggle}
		class="rounded-lg bg-white pl-2 text-gray-700 shadow-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		aria-label="Changer le style de carte"
		title="Changer le style de carte"
	>
		<Map size={24} class="pl-1" />
	</button>
</CustomControl>
