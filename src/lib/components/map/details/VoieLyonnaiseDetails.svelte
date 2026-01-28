<script lang="ts">
	import MapPin from '@lucide/svelte/icons/map-pin';
	import voiesLyonnaisesLogo from '$lib/assets/icons/voies-lyonnaises.svg?url';
	import { vlColors } from '$lib/utils/mapUtils';

	let { properties } = $props();

	const lineNumber = $derived(properties.line);
	const color = $derived(lineNumber ? vlColors[lineNumber - 1] : '#000');
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center gap-2 text-brand-navy">
		<div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600">
			<img src={voiesLyonnaisesLogo} class="h-6 w-6" alt="Logo des voies lyonnaises" />
		</div>
		<h3 class="text-sm font-bold tracking-wide uppercase">Voie Lyonnaise</h3>
	</div>

	<div class="flex items-center gap-3">
		{#if lineNumber}
			<div
				class="flex h-12 w-12 items-center justify-center rounded-full border-4 border-white text-xl font-bold text-white shadow-md"
				style="background-color: {color};"
			>
				{lineNumber}
			</div>
		{/if}
		<div class="flex flex-col">
			<h4 class="text-lg font-bold text-gray-900">VL {lineNumber}</h4>
		</div>
	</div>

	{#if properties.name}
		<div class="flex flex-col rounded-lg p-1">
			<span class="text-[10px] font-bold text-gray-400 uppercase">Tronçon</span>
			<a
				href={'https://cyclopolis.fr' + properties.link}
				target="_blank"
				rel="noopener"
				class="font-semibold text-gray-900 hover:underline"
			>
				{properties.name}
			</a>
		</div>
	{/if}

	{#if properties.type}
		<div class="flex flex-col rounded-lg p-1">
			<span class="text-[10px] font-bold text-gray-400 uppercase">Type</span>
			<span class="font-semibold text-gray-900">{properties.type}</span>
		</div>
	{/if}

	{#if properties.distance}
		<div class="flex flex-col rounded-lg p-1">
			<span class="text-[10px] font-bold text-gray-400 uppercase">Longueur du tronçon</span>
			<span class="font-semibold text-gray-900">{(properties.distance / 1000).toFixed(2)} km</span>
		</div>
	{/if}
	{#if properties.doneAt}
		<div class="flex flex-col rounded-lg p-1">
			<span class="text-[10px] font-bold text-gray-400 uppercase">Réalisé</span>
			<span class="font-semibold text-gray-900">{properties.doneAt}</span>
		</div>
	{/if}
</div>
