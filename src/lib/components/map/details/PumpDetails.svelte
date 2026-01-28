<script lang="ts">
	import Wrench from '@lucide/svelte/icons/wrench';
	import MapPin from '@lucide/svelte/icons/map-pin';

	let { properties } = $props();
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-2 text-brand-navy">
		<div
			class="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600"
		>
			<Wrench size={18} />
		</div>
		<h3 class="text-sm font-bold tracking-wide uppercase">Pompe à vélo</h3>
	</div>

	<div class="space-y-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
		<h4 class="text-lg font-bold text-gray-900">{properties.nom}</h4>
		
		{#if properties.adresse}
			<div class="flex items-start gap-2 text-gray-600">
				<MapPin size={16} class="mt-0.5" />
				<span class="text-sm">{properties.adresse}</span>
			</div>
		{/if}
        
        {#if properties.commune}
             <div class="text-xs text-gray-500 pl-6">
                {properties.commune}
            </div>
        {/if}
	</div>
</div>
