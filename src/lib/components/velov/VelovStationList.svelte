<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import type { Station, StationStatusFilter, StationSortKey } from './types';

	let {
		stations,
		query = $bindable(''),
		commune = $bindable(''),
		status = $bindable('all'),
		sort = $bindable('bikes'),
		onSelect,
	}: {
		stations: Station[];
		query?: string;
		commune?: string;
		status?: StationStatusFilter;
		sort?: StationSortKey;
		onSelect?: (s: Station) => void;
	} = $props();

	const numFmt = new Intl.NumberFormat('fr-FR');

	const communes = $derived.by(() => {
		const set = new Set<string>();
		for (const s of stations) {
			if (s.commune) {
				set.add(s.commune);
			}
		}
		return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
	});

	const filteredStations = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const filtered = stations.filter((s) => {
			if (status === 'open' && s.status === 'CLOSED') {
				return false;
			}
			if (status === 'closed' && s.status !== 'CLOSED') {
				return false;
			}
			if (commune && s.commune !== commune) {
				return false;
			}
			if (q) {
				const hay = `${s.nom} ${s.adresse} ${s.commune} ${s.idstation}`.toLowerCase();
				if (!hay.includes(q)) {
					return false;
				}
			}
			return true;
		});
		const cmp: Record<StationSortKey, (a: Station, b: Station) => number> = {
			bikes: (a, b) => b.bikes - a.bikes,
			elec: (a, b) => b.elec - a.elec,
			mech: (a, b) => b.mech - a.mech,
			stands: (a, b) => b.stands - a.stands,
			capacity: (a, b) => b.capacity - a.capacity,
			name: (a, b) => a.nom.localeCompare(b.nom, 'fr'),
		};
		filtered.sort(cmp[sort] ?? cmp.bikes);
		return filtered;
	});
</script>

<section class="space-y-3">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h2 class="text-xl font-bold text-brand-navy">Toutes les stations</h2>
		<span class="text-xs text-gray-500 tabular-nums">
			{numFmt.format(filteredStations.length)} / {numFmt.format(stations.length)}
		</span>
	</div>

	<div class="flex flex-wrap gap-2">
		<label class="relative min-w-[200px] flex-1">
			<Search
				class="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400"
			/>
			<input
				type="search"
				placeholder="Rechercher une station, une rue, un numéro…"
				bind:value={query}
				class="w-full rounded-md border border-gray-200 bg-white py-1.5 pr-3 pl-8 text-sm shadow-sm focus:border-brand-navy focus:ring-1 focus:ring-brand-navy focus:outline-none"
			/>
		</label>

		<select
			bind:value={commune}
			class="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-navy focus:outline-none"
		>
			<option value="">Toutes communes</option>
			{#each communes as c (c)}
				<option value={c}>{c}</option>
			{/each}
		</select>

		<select
			bind:value={status}
			class="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-navy focus:outline-none"
		>
			<option value="all">Toutes</option>
			<option value="open">Ouvertes</option>
			<option value="closed">Fermées</option>
		</select>

		<select
			bind:value={sort}
			class="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-navy focus:outline-none"
		>
			<option value="bikes">Trier par : vélos disponibles</option>
			<option value="elec">Trier par : vélos élec</option>
			<option value="mech">Trier par : vélos méca</option>
			<option value="stands">Trier par : bornes libres</option>
			<option value="capacity">Trier par : capacité</option>
			<option value="name">Trier par : nom</option>
		</select>
	</div>

	<div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
		<div class="max-h-[600px] overflow-y-auto">
			<table class="w-full text-sm">
				<thead class="sticky top-0 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
					<tr>
						<th class="px-3 py-2 text-left">Station</th>
						<th class="px-3 py-2 text-left">Commune</th>
						<th class="px-3 py-2 text-right" title="Vélos mécaniques">Méca</th>
						<th class="px-3 py-2 text-right" title="Vélos à assistance électrique">Élec</th>
						<th class="px-3 py-2 text-right" title="Bornes libres">Libres</th>
						<th class="px-3 py-2 text-right">Capacité</th>
						<th class="px-3 py-2 text-center">État</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredStations as s (s.idstation)}
						{@const isClosed = s.status === 'CLOSED'}
						<tr
							class="cursor-pointer border-t border-gray-100 hover:bg-gray-50 {isClosed
								? 'opacity-60'
								: ''}"
							onclick={() => onSelect?.(s)}
						>
							<td class="px-3 py-2">
								<div class="flex flex-col">
									<span class="font-medium text-gray-900">{s.nom}</span>
									<span class="truncate text-xs text-gray-500">{s.adresse}</span>
								</div>
							</td>
							<td class="px-3 py-2 text-gray-600">{s.commune}</td>
							<td class="px-3 py-2 text-right tabular-nums">
								<span class="inline-flex items-center gap-1">
									<span class="inline-block h-2 w-2 rounded-full bg-red-600"></span>
									{s.mech}
								</span>
							</td>
							<td class="px-3 py-2 text-right tabular-nums">
								<span class="inline-flex items-center gap-1">
									<span class="inline-block h-2 w-2 rounded-full bg-green-600"></span>
									{s.elec}
								</span>
							</td>
							<td class="px-3 py-2 text-right text-gray-700 tabular-nums">{s.stands}</td>
							<td class="px-3 py-2 text-right text-gray-500 tabular-nums">{s.capacity}</td>
							<td class="px-3 py-2 text-center">
								{#if isClosed}
									<span
										class="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700"
									>
										<CircleX class="h-3 w-3" />
										Fermée
									</span>
								{:else}
									<span
										class="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700"
									>
										<CircleCheck class="h-3 w-3" />
										Ouverte
									</span>
								{/if}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="7" class="px-3 py-6 text-center text-sm text-gray-500">
								Aucune station ne correspond à ces filtres.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</section>
