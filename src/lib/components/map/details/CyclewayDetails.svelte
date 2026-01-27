<script lang="ts">
	import Route from '@lucide/svelte/icons/route';
	import type { CyclableFeature } from '$lib/utils/cyclableUtils.ts';

	let {
		properties,
	}: {
		properties: CyclableFeature['properties'];
	} = $props();
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center gap-2 text-brand-navy">
		<div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600">
			<Route size={18} />
		</div>
		<h3 class="text-sm font-bold tracking-wide uppercase">Aménagement</h3>
	</div>

	<div class="flex flex-col gap-1">
		<h4 class="text-lg font-bold text-gray-900">
			{properties.typeamenagement || 'Piste cyclable'}
		</h4>
		{#if properties.reseau}
			<p class="text-sm text-gray-500">{properties.reseau}</p>
		{/if}
	</div>

	{#if properties.localisation}
		<div class="flex flex-col rounded-lg bg-gray-50 p-2">
			<span class="text-[10px] font-bold text-gray-400 uppercase">Localisation</span>
			<span class="font-semibold text-gray-900">{properties.localisation}</span>
		</div>
	{/if}
</div>
