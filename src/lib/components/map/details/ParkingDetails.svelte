<script lang="ts">
	import SquareP from '@lucide/svelte/icons/square-parking';

	let { properties } = $props();
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-2 text-brand-navy">
		<div class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
			<SquareP size={18} />
		</div>
		<h3 class="text-sm font-bold tracking-wide uppercase">Stationnement Vélo</h3>
	</div>

	<div class="flex flex-col gap-1">
		<h4 class="text-lg font-bold text-gray-900">{properties.mobiliervelo || 'Stationnement'}</h4>
		<p class="text-sm text-gray-500">
			{properties.avancement || properties.validite || 'En service'}
		</p>
	</div>

	<div class="mt-1 grid grid-cols-2 gap-2">
		{#if properties.capacite}
			<div class="flex flex-col rounded-lg bg-gray-50 p-2">
				<span class="text-[10px] font-bold text-gray-400 uppercase">Capacité</span>
				<span class="font-semibold text-gray-900">{properties.capacite} places</span>
			</div>
		{/if}
		{#if properties.etat}
			<div class="flex flex-col rounded-lg bg-gray-50 p-2">
				<span class="text-[10px] font-bold text-gray-400 uppercase">État</span>
				<span class="font-semibold text-gray-900">{properties.etat}</span>
			</div>
		{/if}
		{#if properties.gestionnaire}
			<div class="col-span-2 flex flex-col rounded-lg bg-gray-50 p-2">
				<span class="text-[10px] font-bold text-gray-400 uppercase">Gestionnaire</span>
				<span class="font-semibold text-gray-900">{properties.gestionnaire}</span>
			</div>
		{/if}
	</div>
</div>
