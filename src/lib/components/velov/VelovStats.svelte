<script lang="ts">
	import Bike from '@lucide/svelte/icons/bike';
	import Zap from '@lucide/svelte/icons/zap';
	import CircleParking from '@lucide/svelte/icons/circle-parking';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import type { Station } from './types';

	let { stations }: { stations: Station[] } = $props();

	const numFmt = new Intl.NumberFormat('fr-FR');

	const stats = $derived.by(() => {
		const total = stations.length;
		let open = 0;
		let closed = 0;
		let bikes = 0;
		let mech = 0;
		let elec = 0;
		let stands = 0;
		let capacity = 0;
		let emptyStations = 0;
		let fullStations = 0;

		for (const s of stations) {
			if (s.status === 'CLOSED') {
				closed += 1;
			} else {
				open += 1;
			}
			bikes += s.bikes;
			mech += s.mech;
			elec += s.elec;
			stands += s.stands;
			capacity += s.capacity;
			if (s.status !== 'CLOSED' && s.bikes === 0) {
				emptyStations += 1;
			}
			if (s.status !== 'CLOSED' && s.stands === 0) {
				fullStations += 1;
			}
		}

		return {
			total,
			open,
			closed,
			bikes,
			mech,
			elec,
			stands,
			capacity,
			emptyStations,
			fullStations,
		};
	});
</script>

<section class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
	<div class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
		<div class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase">
			<MapPin class="h-3.5 w-3.5" />
			Stations
		</div>
		<div class="mt-1 text-2xl font-bold text-brand-navy">
			{numFmt.format(stats.total)}
		</div>
		<div class="text-xs text-gray-500">
			{numFmt.format(stats.open)} ouvertes · {numFmt.format(stats.closed)} fermées
		</div>
	</div>

	<div class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
		<div class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase">
			<Bike class="h-3.5 w-3.5" />
			Vélos disponibles
		</div>
		<div class="mt-1 text-2xl font-bold text-brand-navy">
			{numFmt.format(stats.bikes)}
		</div>
		<div class="flex items-center gap-2 text-xs text-gray-500">
			<span class="inline-flex items-center gap-1">
				<span class="inline-block h-2 w-2 rounded-full bg-red-600"></span>
				{numFmt.format(stats.mech)} méca.
			</span>
			<span class="inline-flex items-center gap-1">
				<span class="inline-block h-2 w-2 rounded-full bg-green-600"></span>
				{numFmt.format(stats.elec)} élec.
			</span>
		</div>
	</div>

	<div class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
		<div class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase">
			<CircleParking class="h-3.5 w-3.5" />
			Bornes libres
		</div>
		<div class="mt-1 text-2xl font-bold text-brand-navy">
			{numFmt.format(stats.stands)}
		</div>
		<div class="text-xs text-gray-500">
			sur {numFmt.format(stats.capacity)} bornes au total
		</div>
	</div>

	<div class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
		<div class="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase">
			<Zap class="h-3.5 w-3.5" />
			Stations Vides/Pleines
		</div>
		<div class="mt-1 flex items-baseline gap-3">
			<span class="text-2xl font-bold text-red-700">{numFmt.format(stats.emptyStations)}</span>
			<span class="text-xs text-gray-500">vides</span>
			<span class="text-2xl font-bold text-amber-700">{numFmt.format(stats.fullStations)}</span>
			<span class="text-xs text-gray-500">pleines</span>
		</div>
		<div class="text-xs text-gray-500">
			sur {numFmt.format(stats.total)} stations
		</div>
	</div>
</section>
