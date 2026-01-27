<script lang="ts">
	import Bike from '@lucide/svelte/icons/bike';

	let { properties } = $props();
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-2 text-brand-navy">
		<div class="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600">
			<Bike size={18} />
		</div>
		<h3 class="text-sm font-bold tracking-wide uppercase">Station Vélo'v</h3>
	</div>

	<div class="flex flex-col gap-1">
		<h4 class="text-lg font-bold text-gray-900">{properties.name || properties.NOM}</h4>
		<p class="text-sm text-gray-500">
			{[
				properties.address || properties.ADRESSE1,
				properties.ADRESSE2,
				properties.commune || properties.COMMUNE,
			]
				.filter(Boolean)
				.join(', ')}
		</p>
	</div>

	{#if properties.commune || properties.COMMUNE}
		<div class="mt-2 flex items-center gap-2">
			<span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
				{properties.commune || properties.COMMUNE}
			</span>
			{#if properties.gid || properties.IDSTATION}
				<span class="text-xs text-gray-400">#{properties.gid || properties.IDSTATION}</span>
			{/if}
		</div>
	{/if}
</div>
