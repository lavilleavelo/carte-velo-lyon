<script lang="ts">
	import { GeoJSONSource, CircleLayer, SymbolLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';

	let {
		isLayerVisible,
		handleMouseEnter,
		handleMouseLeave,
	}: {
		isLayerVisible: (id: string) => boolean;
		handleMouseEnter: () => void;
		handleMouseLeave: () => void;
	} = $props();

	interface CounterData {
		name: string;
		slug: string;
		description?: string;
		arrondissement?: string;
		cyclopolisId?: string;
		coordinates: [number, number];
		counts: { month: string; count: number }[];
	}

	function countersToGeoJSON(
		counters: CounterData[],
		type: 'velo' | 'voiture',
	): GeoJSON.FeatureCollection {
		return {
			type: 'FeatureCollection',
			features: counters
				.filter((c) => c.coordinates && c.coordinates.length === 2)
				.map((counter) => {
					const lastCount = counter.counts?.length
						? counter.counts[counter.counts.length - 1]
						: null;
					const linkSlug = counter.slug;
					return {
						type: 'Feature' as const,
						properties: {
							name: counter.name,
							description: counter.description || '',
							arrondissement: counter.arrondissement || '',
							counterType: type,
							lastCount: lastCount?.count ?? 0,
							lastMonth: lastCount?.month ?? null,
							cyclopolisUrl: `https://cyclopolis.fr/compteurs/${type}/${linkSlug}`,
							counts: JSON.stringify(counter.counts || []),
						},
						geometry: {
							type: 'Point' as const,
							coordinates: counter.coordinates,
						},
					};
				}),
		};
	}

	const countersQuery = createQuery(() => ({
		queryKey: ['counters'],
		queryFn: async () => {
			const response = await fetch('/api/counters');
			if (!response.ok) {
				throw new Error('Failed to fetch counters data');
			}
			const data = await response.json();
			return {
				velo: countersToGeoJSON(data.velo, 'velo'),
				voiture: countersToGeoJSON(data.voiture, 'voiture'),
			};
		},
		staleTime: Infinity,
		enabled: isLayerVisible('counters-velo') || isLayerVisible('counters-voiture'),
		refetchOnWindowFocus: false,
		meta: { loadingLabel: 'Compteurs' },
	}));

	// Circle radius based on last monthly count
	// Bike: ~2k (small) to ~150k (large)
	// Car: ~50k (small) to ~500k (large)
	const veloRadiusExpr: any = [
		'interpolate',
		['linear'],
		['zoom'],
		11,
		['interpolate', ['linear'], ['get', 'lastCount'], 0, 3, 50000, 6, 150000, 12],
		14,
		['interpolate', ['linear'], ['get', 'lastCount'], 0, 5, 50000, 10, 150000, 18],
		17,
		['interpolate', ['linear'], ['get', 'lastCount'], 0, 7, 50000, 14, 150000, 24],
	];

	const voitureRadiusExpr: any = [
		'interpolate',
		['linear'],
		['zoom'],
		11,
		['interpolate', ['linear'], ['get', 'lastCount'], 0, 3, 200000, 6, 500000, 12],
		14,
		['interpolate', ['linear'], ['get', 'lastCount'], 0, 5, 200000, 10, 500000, 18],
		17,
		['interpolate', ['linear'], ['get', 'lastCount'], 0, 7, 200000, 14, 500000, 24],
	];
</script>

{#if countersQuery.data}
	<GeoJSONSource id="counters-velo-source" data={countersQuery.data.velo}>
		<CircleLayer
			id="counters-velo-layer"
			minzoom={11}
			layout={{
				visibility: isLayerVisible('counters-velo') ? 'visible' : 'none',
			}}
			paint={{
				'circle-color': '#1e3a5f',
				'circle-radius': veloRadiusExpr,
				'circle-opacity': 0.85,
				'circle-stroke-color': '#ffffff',
				'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 14, 2],
			}}
		/>

		<CircleLayer
			id="counters-velo-hitarea"
			minzoom={11}
			layout={{
				visibility: isLayerVisible('counters-velo') ? 'visible' : 'none',
			}}
			paint={{
				'circle-color': 'transparent',
				'circle-opacity': 0,
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 14, 14, 20, 17, 28],
			}}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
		/>

		<SymbolLayer
			id="counters-velo-label"
			minzoom={13}
			layout={{
				visibility: isLayerVisible('counters-velo') ? 'visible' : 'none',
				'text-field': ['get', 'name'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 13, 9, 16, 12],
				'text-offset': [0, 1.8],
				'text-anchor': 'top',
				'text-font': ['Open Sans Bold'],
				'text-optional': true,
			}}
			paint={{
				'text-color': '#1e3a5f',
				'text-halo-color': '#ffffff',
				'text-halo-width': 1.5,
			}}
		/>
	</GeoJSONSource>

	<GeoJSONSource id="counters-voiture-source" data={countersQuery.data.voiture}>
		<CircleLayer
			id="counters-voiture-layer"
			minzoom={11}
			layout={{
				visibility: isLayerVisible('counters-voiture') ? 'visible' : 'none',
			}}
			paint={{
				'circle-color': '#dc2626',
				'circle-radius': voitureRadiusExpr,
				'circle-opacity': 0.85,
				'circle-stroke-color': '#ffffff',
				'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 14, 2],
			}}
		/>

		<CircleLayer
			id="counters-voiture-hitarea"
			minzoom={11}
			layout={{
				visibility: isLayerVisible('counters-voiture') ? 'visible' : 'none',
			}}
			paint={{
				'circle-color': 'transparent',
				'circle-opacity': 0,
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 14, 14, 20, 17, 28],
			}}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
		/>

		<SymbolLayer
			id="counters-voiture-label"
			minzoom={13}
			layout={{
				visibility: isLayerVisible('counters-voiture') ? 'visible' : 'none',
				'text-field': ['get', 'name'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 13, 9, 16, 12],
				'text-offset': [0, 1.8],
				'text-anchor': 'top',
				'text-font': ['Open Sans Bold'],
				'text-optional': true,
			}}
			paint={{
				'text-color': '#991b1b',
				'text-halo-color': '#ffffff',
				'text-halo-width': 1.5,
			}}
		/>
	</GeoJSONSource>
{/if}
