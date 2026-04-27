<script lang="ts">
	import { GeoJSONSource, SymbolLayer, CircleLayer, ImageLoader } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import velovDataUrl from '$lib/data/velov-data-grand-lyon.json?url';
	import { fetchVelovAvailability } from '$lib/utils/velovUtils';
	import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
	import type { FeatureCollection, Point } from 'geojson';

	let {
		isLayerVisible,
		handleMouseEnter,
		handleMouseLeave,
		boundary,
	}: {
		isLayerVisible: (id: string) => boolean;
		handleMouseEnter: () => void;
		handleMouseLeave: () => void;
		boundary?: FeatureCollection;
	} = $props();

	const velovQuery = createQuery(() => ({
		queryKey: ['velov-availability'],
		queryFn: async () => {
			const [staticResponse, availabilityMap] = await Promise.all([
				fetch(velovDataUrl),
				fetchVelovAvailability(),
			]);

			const staticData: FeatureCollection<Point> = await staticResponse.json();

			const enrichedFeatures = staticData.features.map((feature) => {
				const id = feature.properties?.idstation;
				if (id && availabilityMap.has(id)) {
					const availability = availabilityMap.get(id)!;
					return {
						...feature,
						properties: {
							...feature.properties,
							available_bikes: availability.main_stands.availabilities.bikes,
							available_stands: availability.main_stands.availabilities.stands,
							mechanical_bikes: availability.main_stands.availabilities.mechanicalBikes,
							electrical_bikes: availability.main_stands.availabilities.electricalBikes,
							status: availability.status,
							capacity: availability.main_stands.capacity,
						},
					};
				}
				return feature;
			});

			return {
				...staticData,
				features: enrichedFeatures,
			} as FeatureCollection<Point>;
		},
		enabled: isLayerVisible('velov'),
		refetchOnWindowFocus: false,
		staleTime: Infinity, // until reload
		meta: { loadingLabel: 'Stations Vélo’v' },
	}));

	const EMPTY_FC: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };

	const velovSourceData = $derived.by<FeatureCollection<Point> | string>(() => {
		if (boundary) {
			if (!velovQuery.data) {
				return EMPTY_FC;
			}

			return filterFeaturesInsideBoundary(velovQuery.data, boundary) as FeatureCollection<Point>;
		}
		return velovQuery.data ?? velovDataUrl;
	});
</script>

<ImageLoader images={{ velov: '/velov-station.png' }} />

<GeoJSONSource maxzoom={14} id="velov-stations-source" data={velovSourceData}>
	<SymbolLayer
		id="velov-stations-layer"
		layout={{
			visibility: isLayerVisible('velov') ? 'visible' : 'none',
			'icon-image': 'velov',
			'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.2, 14, 0.7, 18, 1, 22, 1.1],
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'text-allow-overlap': true,
			'text-ignore-placement': true,
			'symbol-sort-key': 0,
			'text-field': [
				'step',
				['zoom'],
				'',
				15,
				[
					'format',
					[
						'concat',
						['to-string', ['get', 'available_bikes']],
						' / ',
						['to-string', ['get', 'capacity']],
					],
					{ 'font-scale': 1, 'text-color': '#ffffff' },
				],
			],
			'text-offset': [0, 1.2],
			'text-anchor': 'top',
			'text-size': ['interpolate', ['linear'], ['zoom'], 15, 12, 18, 14],
		}}
		paint={{
			'text-halo-color': '#d61016',
			'text-halo-width': 2,
		}}
	/>

	<CircleLayer
		id="velov-stations-layer-hitarea"
		layout={{
			visibility: isLayerVisible('velov') ? 'visible' : 'none',
		}}
		paint={{
			'circle-opacity': 0,
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 10, 14, 20, 18, 28, 22, 32],
			'circle-color': 'transparent',
		}}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	/>
</GeoJSONSource>
