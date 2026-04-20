<script lang="ts">
	import { GeoJSONSource, CircleLayer, SymbolLayer, ImageLoader } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import { processParkingData } from '$lib/utils/parkingUtils';
	import parkingCoveredIcon from '$lib/assets/icons/arceau_couvert.png?url';
	import parkingVelostationIcon from '$lib/assets/icons/parking-velostation.png?url';
	import parkingBoxIcon from '$lib/assets/icons/box_securisee_velo.png?url';
	import parkingLpaIcon from '$lib/assets/icons/parking-lpa.png?url';
	import { filterFeaturesInsideBoundary, filterFeaturesByYear } from '$lib/utils/geoFilter';
	import type { FeatureCollection } from 'geojson';

	let {
		isLayerVisible,
		handleMouseEnter,
		handleMouseLeave,
		boundary,
		yearRange,
	}: {
		isLayerVisible: (id: string) => boolean;
		handleMouseEnter: () => void;
		handleMouseLeave: () => void;
		boundary?: FeatureCollection;
		yearRange?: [number, number];
	} = $props();

	const parkingQuery = createQuery(() => ({
		queryKey: ['parking'],
		queryFn: async () => {
			const response = await fetch('/api/grandlyon/parking');
			if (!response.ok) {
				throw new Error('Failed to fetch parking data');
			}
			const data = await response.json();
			return processParkingData(data.features);
		},
		staleTime: Infinity,
		enabled:
			isLayerVisible('parking-arceaux') ||
			isLayerVisible('parking-couverts') ||
			isLayerVisible('parking-box') ||
			isLayerVisible('parking-velostation') ||
			isLayerVisible('parking-lpa'),
	}));

	const parkingData = $derived.by(() => {
		let base: FeatureCollection = parkingQuery.data || {
			type: 'FeatureCollection' as const,
			features: [],
		};
		if (boundary) base = filterFeaturesInsideBoundary(base, boundary);
		if (yearRange) base = filterFeaturesByYear(base, 'anneerealisation', yearRange);
		return base;
	});
</script>

<ImageLoader
	images={{
		velov: '/velov-station.png',
		'parking-covered': [
			parkingCoveredIcon,
			{
				pixelRatio: 2,
			},
		],
		'parking-box': parkingBoxIcon,
		'parking-velostation': parkingVelostationIcon,
		'parking-lpa': parkingLpaIcon,
	}}
>
	<GeoJSONSource id="parking-source" data={parkingData}>
		<!-- Arceaux: small dots, visible from lower zoom -->
		<CircleLayer
			id="parking-layer-circles"
			filter={['==', ['get', 'type'], 'arceaux']}
			minzoom={11}
			layout={{
				visibility: isLayerVisible('parking-arceaux') ? 'visible' : 'none',
			}}
			paint={{
				'circle-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 14, 0.8, 16, 1],
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 14, 2, 16, 4, 18, 6],
				'circle-color': '#4ade80',
				'circle-stroke-color': '#166534',
				'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 14, 0, 16, 1],
			}}
		/>

		<CircleLayer
			id="parking-layer-circles-hitarea"
			filter={['==', ['get', 'type'], 'arceaux']}
			minzoom={11}
			layout={{
				visibility: isLayerVisible('parking-arceaux') ? 'visible' : 'none',
			}}
			paint={{
				'circle-opacity': 0,
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 6, 14, 8, 16, 14, 18, 20],
				'circle-color': 'transparent',
			}}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
		/>

		<SymbolLayer
			id="parking-layer-capacity"
			filter={['all', ['==', ['get', 'type'], 'arceaux'], ['has', 'capacite']]}
			minzoom={15}
			layout={{
				visibility: isLayerVisible('parking-arceaux') ? 'visible' : 'none',
				'text-field': ['to-string', ['get', 'capacite']],
				'text-size': ['interpolate', ['linear'], ['zoom'], 15, 9, 17, 11],
				'text-offset': [0, 1.2],
				'text-anchor': 'top',
				'text-font': ['Open Sans Bold'],
			}}
			paint={{
				'text-color': '#166534',
				'text-halo-color': '#ffffff',
				'text-halo-width': 1,
			}}
		/>

		<SymbolLayer
			id="parking-layer-roof"
			filter={['==', ['get', 'type'], 'arceaux-couverts']}
			minzoom={13}
			layout={{
				visibility: isLayerVisible('parking-couverts') ? 'visible' : 'none',
				'icon-image': 'parking-covered',
				'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.15, 15, 0.3, 17, 0.5],
				'icon-allow-overlap': true,
				'text-field': ['step', ['zoom'], '', 16, ['to-string', ['get', 'capacite']]],
				'text-offset': [0, 1.2],
				'text-size': 10,
				'text-anchor': 'top',
			}}
		/>

		<CircleLayer
			id="parking-layer-roof-hitarea"
			filter={['==', ['get', 'type'], 'arceaux-couverts']}
			minzoom={13}
			layout={{
				visibility: isLayerVisible('parking-couverts') ? 'visible' : 'none',
			}}
			paint={{
				'circle-opacity': 0,
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 8, 15, 14, 18, 20],
				'circle-color': 'transparent',
			}}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
		/>

		<SymbolLayer
			id="parking-layer-box"
			filter={['==', ['get', 'type'], 'box']}
			minzoom={15}
			layout={{
				visibility: isLayerVisible('parking-box') ? 'visible' : 'none',
				'icon-image': 'parking-box',
				'icon-size': ['interpolate', ['linear'], ['zoom'], 15, 0.2, 17, 0.3],
				'icon-allow-overlap': true,
			}}
		/>

		<CircleLayer
			id="parking-layer-box-hitarea"
			filter={['==', ['get', 'type'], 'box']}
			minzoom={15}
			layout={{
				visibility: isLayerVisible('parking-box') ? 'visible' : 'none',
			}}
			paint={{
				'circle-opacity': 0,
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 12, 18, 20],
				'circle-color': 'transparent',
			}}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
		/>

		<SymbolLayer
			id="parking-layer-velostation"
			filter={['==', ['get', 'type'], 'velostation']}
			layout={{
				visibility: isLayerVisible('parking-velostation') ? 'visible' : 'none',
				'icon-image': 'parking-velostation',
				'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.3, 17, 0.7],
				'icon-allow-overlap': true,
			}}
		/>

		<CircleLayer
			id="parking-layer-velostation-hitarea"
			filter={['==', ['get', 'type'], 'velostation']}
			layout={{
				visibility: isLayerVisible('parking-velostation') ? 'visible' : 'none',
			}}
			paint={{
				'circle-opacity': 0,
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 12, 15, 18, 18, 24],
				'circle-color': 'transparent',
			}}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
		/>

		<SymbolLayer
			id="parking-layer-lpa"
			filter={['==', ['get', 'type'], 'lpa']}
			layout={{
				visibility: isLayerVisible('parking-lpa') ? 'visible' : 'none',
				'icon-image': 'parking-lpa',
				'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.3, 17, 0.6],
				'icon-allow-overlap': true,
				'text-field': ['step', ['zoom'], '', 15, ['to-string', ['get', 'capacite']]],
				'text-offset': [0, 1.2],
				'text-size': 11,
				'text-anchor': 'top',
				'text-font': ['Open Sans Bold'],
			}}
			paint={{
				'text-color': '#1e40af',
				'text-halo-color': '#ffffff',
				'text-halo-width': 2,
			}}
		/>

		<CircleLayer
			id="parking-layer-lpa-hitarea"
			filter={['==', ['get', 'type'], 'lpa']}
			layout={{
				visibility: isLayerVisible('parking-lpa') ? 'visible' : 'none',
			}}
			paint={{
				'circle-opacity': 0,
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 12, 15, 18, 18, 24],
				'circle-color': 'transparent',
			}}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
		/>
	</GeoJSONSource>
</ImageLoader>
