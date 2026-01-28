<script lang="ts">
	import Bike from '@lucide/svelte/icons/bike';
	import CircleParking from '@lucide/svelte/icons/circle-parking';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Zap from '@lucide/svelte/icons/zap';

	let { properties } = $props();

	const isClosed = $derived(properties.status === 'CLOSED');
</script>

<div class="flex flex-col gap-4">
	<div class="border-b pb-3">
		<div class="flex items-start justify-between gap-2">
			<h3 class="text-lg leading-tight font-bold text-gray-900">
				{properties.nom} <span class="text-xs text-gray-400">#{properties.idstation}</span>
			</h3>
			<span
				class={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${isClosed ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}
			>
				{#if isClosed}
					<CircleX size={14} />
					Fermée
				{:else}
					<CircleCheck size={14} />
					Ouverte
				{/if}
			</span>
		</div>
		<p class="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
			<MapPin size={14} />
			{properties.adresse1}, {properties.commune}
		</p>
	</div>

	<div class="grid grid-cols-2 gap-3">
		<div class="flex flex-col rounded-lg border border-gray-100 bg-gray-50 p-3">
			<span class="mb-1 flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase">
				<Bike size={14} />
				Vélos dispos
			</span>
			<span class="text-2xl font-bold text-gray-900">{properties.available_bikes ?? '--'}</span>

			{#if properties.mechanical_bikes !== undefined || properties.electrical_bikes !== undefined}
				<div class="mt-3 flex flex-col gap-2">
					{#if properties.electrical_bikes > 0}
						<div
							class="flex items-center gap-1.5 rounded-md border border-yellow-100 bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700"
						>
							<Zap size={12} class="fill-yellow-500 text-yellow-500" />
							<span>{properties.electrical_bikes} élec.</span>
						</div>
					{/if}
					{#if properties.mechanical_bikes > 0}
						<div
							class="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600"
						>
							<Bike size={12} />
							<span>{properties.mechanical_bikes} méca.</span>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<div class="flex flex-col rounded-lg border border-gray-100 bg-gray-50 p-3">
			<span class="mb-1 flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase">
				<CircleParking size={14} />
				Places libres
			</span>
			<span class="text-2xl font-bold text-gray-900">{properties.available_stands ?? '--'}</span>
			<span class="mt-1 text-xs text-gray-400"
				>Total: {properties.capacity ?? properties.bike_stands ?? '--'}</span
			>
		</div>
	</div>
</div>
