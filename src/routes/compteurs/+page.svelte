<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { parse } from '@std/csv';
	import { MapLibre, GeoJSONSource, CircleLayer, SymbolLayer, Popup } from 'svelte-maplibre-gl';
	import type { Map } from 'maplibre-gl';
	import maplibregl from 'maplibre-gl';

	let mapInstance: Map | undefined = $state();
	let selectedCompteur: any = $state(null);
	let popupLngLat = $state.raw(new maplibregl.LngLat(0, 0));

	const query = createQuery(() => ({
		queryKey: ['compteurs'],
		queryFn: async () => {
			const res = await fetch(
				'https://grist.lavilleavelo.org/o/lavilleavelo/api/docs/kZrMpcuc7DV9HApGfHAVEh/download/csv?viewSection=1&tableId=Compteurs_donnees&activeSortSpec=%5B%5D&filters=%5B%5D&linkingFilter=%7B%22filters%22%3A%7B%7D%2C%22operations%22%3A%7B%7D%7D'
			);
			if (!res.ok) {
				throw new Error('Failed to fetch compteur data');
			}

			const csvText = await res.text();
			return parse(csvText, {
				skipFirstRow: true,
				columns: ['lat', 'lon', 'nom_compteur', '2024', '2025']
			});
		}
	}));

	const mapCenter = $derived.by(() => {
		if (!query.data) return { lng: 4.835659, lat: 45.764043 };

		const lats = query.data.map((row) => parseFloat(row.lat)).filter((lat) => !isNaN(lat));
		const lons = query.data.map((row) => parseFloat(row.lon)).filter((lon) => !isNaN(lon));

		if (lats.length === 0 || lons.length === 0) return { lng: 4.835659, lat: 45.764043 };

		const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
		const centerLon = lons.reduce((a, b) => a + b, 0) / lons.length;

		return { lng: centerLon, lat: centerLat };
	});

	const geoJsonData = $derived.by(() => {
		if (!query.data) return null;

		const maxValue = Math.max(...query.data.map((row) => parseFloat(row['2025']) || 0));

		const features = query.data.map((row) => ({
			type: 'Feature' as const,
			geometry: {
				type: 'Point' as const,
				coordinates: [parseFloat(row.lon), parseFloat(row.lat)]
			},
			properties: {
				name: row.nom_compteur,
				count_2024: parseFloat(row['2024']) || 0,
				count_2025: parseFloat(row['2025']) || 0,
				circleRadius: 5 + ((parseFloat(row['2025']) || 0) / maxValue) * 25
			}
		}));

		return {
			type: 'FeatureCollection' as const,
			features
		};
	});

	const increase = $derived.by(() => {
		if (!selectedCompteur) return null;
		const count2024 = selectedCompteur.properties.count_2024;
		const count2025 = selectedCompteur.properties.count_2025;
		if (count2024 === 0) return null;
		return ((count2025 - count2024) / count2024) * 100;
	});

	function handleCompteurClick(e: any) {
		const features = e.features;
		if (features && features.length > 0) {
			selectedCompteur = features[0];
			popupLngLat = new maplibregl.LngLat(
				features[0].geometry.coordinates[0],
				features[0].geometry.coordinates[1]
			);
		}
	}

	function handleMapClick(e: any) {
		// Close popup when clicking on the map (not on a feature)
		if (!e.features || e.features.length === 0) {
			selectedCompteur = null;
		}
	}

	const numFormatter = new Intl.NumberFormat('fr-FR', {
		style: 'decimal',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	});

	const percentFormatter = new Intl.NumberFormat('fr-FR', {
		style: 'decimal',
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
		signDisplay: 'always'
	});

	function calculateEvolution(count2024: string, count2025: string): number | null {
		const val2024 = parseFloat(count2024);
		const val2025 = parseFloat(count2025);
		if (isNaN(val2024) || isNaN(val2025) || val2024 === 0) return null;
		return ((val2025 - val2024) / val2024) * 100;
	}
</script>

<div class="space-y-2">
	{#if query.isLoading}
		<p>Chargement des données des compteurs...</p>
	{:else if query.isError}
		<p>Erreur lors du chargement des données des compteurs: {query.error.message}</p>
	{:else}
		<h1 class="mb-4 text-2xl font-bold">Données des compteurs</h1>
		<MapLibre
			bind:map={mapInstance}
			style={'https://tiles.openfreemap.org/styles/positron'}
			center={[mapCenter.lng, mapCenter.lat]}
			zoom={12}
			class="h-[calc(100vh-400px)] w-full"
			onclick={handleMapClick}
		>
			{#if geoJsonData}
				<GeoJSONSource id="compteurs" data={geoJsonData}>
					<CircleLayer
						id="compteurs-circles"
						paint={{
							'circle-radius': ['get', 'circleRadius'],
							'circle-color': '#3b82f6',
							'circle-opacity': 0.7,
							'circle-stroke-width': 2,
							'circle-stroke-color': '#1e40af'
						}}
						onclick={handleCompteurClick}
					/>
					<SymbolLayer
						id="compteurs-labels"
						layout={{
							'text-field': ['get', 'name'],
							'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
							'text-offset': [0, 0],
							'text-anchor': 'left',
							'text-size': 12
						}}
						paint={{
							'text-color': '#1f2937',
							'text-halo-color': '#ffffff',
							'text-halo-width': 2
						}}
					/>
				</GeoJSONSource>
			{/if}
			{#if selectedCompteur}
				<Popup lnglat={popupLngLat} closeButton={false} closeOnClick={false}>
					<div class="min-w-[200px] p-2">
						<div class="mb-2 text-sm font-semibold">
							{selectedCompteur.properties.name}
						</div>
						<div class="space-y-1 text-xs">
							<div class="flex items-center justify-between gap-4">
								<span class="text-gray-600">2024:</span>
								<span class="font-medium"
									>{numFormatter.format(selectedCompteur.properties.count_2024)}</span
								>
							</div>
							<div class="flex items-center justify-between gap-4">
								<span class="text-gray-600">2025:</span>
								<span class="font-medium"
									>{numFormatter.format(selectedCompteur.properties.count_2025)}</span
								>
							</div>
							{#if increase !== null}
								<div class="mt-2 flex items-center justify-between gap-4 border-t pt-1">
									<span class="text-gray-600">Évolution:</span>
									<span
										class="font-semibold"
										class:text-green-600={increase > 0}
										class:text-red-600={increase < 0}
									>
										{percentFormatter.format(increase)}%
									</span>
								</div>
							{/if}
						</div>
					</div>
				</Popup>
			{/if}
		</MapLibre>
		<table class="min-w-full border border-gray-300">
			<thead>
				<tr class="bg-gray-200">
					<th class="border border-gray-300 px-4 py-2">Compteur</th>
					<th class="border border-gray-300 px-4 py-2">2024</th>
					<th class="border border-gray-300 px-4 py-2">2025</th>
					<th class="border border-gray-300 px-4 py-2">Évolution</th>
				</tr>
			</thead>
			<tbody>
				{#each query.data as row}
					{@const evolution = calculateEvolution(row['2024'], row['2025'])}
					<tr>
						<td class="border border-gray-300 px-4 py-2">{row.nom_compteur}</td>
						<td class="border border-gray-300 px-4 py-2"
							>{numFormatter.format(parseFloat(row['2024']))}</td
						>
						<td class="border border-gray-300 px-4 py-2"
							>{numFormatter.format(parseFloat(row['2025']))}</td
						>
						<td class="border border-gray-300 px-4 py-2">
							{#if evolution !== null}
								<span
									class="font-semibold"
									class:text-green-600={evolution > 0}
									class:text-red-600={evolution < 0}
								>
									{percentFormatter.format(evolution)}%
								</span>
							{:else}
								<span class="text-gray-400">N/A</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
