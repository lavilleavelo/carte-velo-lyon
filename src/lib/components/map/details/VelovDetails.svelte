<script lang="ts">
	import Bike from '@lucide/svelte/icons/bike';
	import CircleParking from '@lucide/svelte/icons/circle-parking';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Zap from '@lucide/svelte/icons/zap';

	let { properties } = $props();

	const isClosed = $derived(properties.status === 'CLOSED');
	const capacity = $derived(properties.capacity ?? properties.bike_stands ?? null);
	const elec = $derived(properties.electrical_bikes ?? 0);
	const mech = $derived(properties.mechanical_bikes ?? 0);
	const hasBreakdown = $derived(
		properties.mechanical_bikes !== undefined || properties.electrical_bikes !== undefined,
	);
</script>

<div class="flex flex-col gap-3">
	<div>
		<h3 class="text-base leading-tight font-bold text-gray-900">
			{properties.nom} <span class="text-xs text-gray-400"></span>
		</h3>

		<p class="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
			<MapPin size={12} />
			{properties.adresse1}{properties.commune ? `, ${properties.commune}` : ''} #{properties.idstation}
		</p>

		{#if isClosed}
			<p
				class="mt-2 inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700"
			>
				<CircleX size={12} />
				Station fermée
			</p>
		{/if}
	</div>

	<div class="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2">
		<span class="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase">
			Vélos dispos
		</span>
		<span class="text-lg font-bold text-gray-900 tabular-nums">
			{properties.available_bikes ?? '--'}
		</span>
		{#if hasBreakdown && !isClosed}
			<div class="flex flex-col items-center gap-2">
				<span
					class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-100 bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
				>
					<Bike size={12} />
					<span class="tabular-nums">{mech}</span>
					<span class="text-red-600/80">méca</span>
				</span>
				<span
					class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-green-100 bg-green-50 px-2 py-1 text-xs font-medium text-green-700"
				>
					<Zap size={12} class="fill-green-500 text-green-600" />
					<span class="tabular-nums">{elec}</span>
					<span class="text-green-600/80">élec</span>
				</span>
			</div>
		{/if}
	</div>

	<div class="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2">
		<span class="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase">
			<CircleParking size={14} />
			Places libres
		</span>
		<span class="flex items-baseline gap-1.5">
			<span class="text-lg font-bold text-gray-900 tabular-nums">
				{properties.available_stands ?? '--'}
			</span>
			{#if capacity !== null}
				<span class="text-xs text-gray-400 tabular-nums">/ {capacity}</span>
			{/if}
		</span>
	</div>
</div>
