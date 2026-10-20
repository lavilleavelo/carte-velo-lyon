<script lang="ts">
	import Ship from '@lucide/svelte/icons/ship';
	import Bike from '@lucide/svelte/icons/bike';
	import MapPin from '@lucide/svelte/icons/map-pin';

	let { properties } = $props();

	const isStop = $derived(!!properties?.nom);
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-2 text-brand-navy">
		<div class="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-700">
			<Ship size={18} />
		</div>
		<h3 class="text-sm font-bold tracking-wide uppercase">
			{isStop ? 'Arrêt Navigône' : 'Navigône'}
		</h3>
	</div>

	<div class="space-y-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
		{#if isStop}
			<h4 class="text-lg font-bold text-gray-900">{properties.nom}</h4>
			{#if properties.adresse || properties.commune}
				<div class="flex items-start gap-2 text-gray-600">
					<MapPin size={16} class="mt-0.5 shrink-0" />
					<span class="text-sm">
						{[properties.adresse, properties.commune].filter(Boolean).join(', ')}
					</span>
				</div>
			{/if}
		{:else}
			<h4 class="text-lg font-bold text-gray-900">Navette fluviale sur la Saône</h4>
		{/if}
		<p class="text-sm text-gray-600">Ligne TCL entre Vaise et Confluence.</p>
	</div>

	<div
		class="flex items-start gap-2 rounded-md border border-teal-100 bg-teal-50 px-2 py-1.5 text-teal-900"
	>
		<Bike size={16} class="mt-0.5 shrink-0" />
		<span class="text-xs">Vélos admis à bord.</span>
	</div>
</div>
