<script lang="ts">
	import Droplet from '@lucide/svelte/icons/droplet';
	import MapPin from '@lucide/svelte/icons/map-pin';

	let { properties } = $props();
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-2 text-brand-navy">
		<div
			class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600"
		>
			<Droplet size={18} />
		</div>
		<h3 class="text-sm font-bold tracking-wide uppercase">Fontaine à eau</h3>
	</div>

	<div class="space-y-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
		<div class="flex items-center gap-2 text-gray-800 font-medium">
            <span>Fontaine publique</span>
        </div>
		
		{#if properties.commune}
			<div class="flex items-start gap-2 text-gray-600">
				<MapPin size={16} class="mt-0.5" />
				<span class="text-sm">{properties.commune}</span>
			</div>
		{/if}
        
        {#if properties.anneepose}
             <div class="text-xs text-gray-500 pl-6">
                Posée en {properties.anneepose}
            </div>
        {/if}
	</div>
</div>
