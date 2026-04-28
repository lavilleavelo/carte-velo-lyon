<script lang="ts">
	import type { MapStyle } from '$lib/utils/mapStyleToggle.svelte';

	let {
		styleId,
		alt = '',
	}: {
		styleId: MapStyle;
		alt?: string;
	} = $props();

	let failed = $state(false);
</script>

{#if failed}
	<div
		class="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300 text-[10px] text-gray-500 uppercase tracking-wide"
	>
		{styleId}
	</div>
{:else}
	<img
		src="/map-style-previews/{styleId}.webp"
		{alt}
		loading="lazy"
		decoding="async"
		class="h-full w-full object-cover"
		onerror={() => (failed = true)}
	/>
{/if}
