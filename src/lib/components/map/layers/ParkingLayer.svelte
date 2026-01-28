<script lang="ts">
	import { GeoJSONSource, CircleLayer, SymbolLayer, ImageLoader } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import { processParkingData, processLPAParkingData } from '$lib/utils/parkingUtils';
	import parkingCoveredIcon from '$lib/assets/icons/arceau_couvert.png?url';
	import parkingVelostationIcon from '$lib/assets/icons/parking-velostation.png?url';
	import parkingSecureIcon from '$lib/assets/icons/box_securisee_velo.png?url';
	import parkingLpaIcon from '$lib/assets/icons/parking-lpa.png?url';

	let { isLayerVisible, handleMouseEnter, handleMouseLeave } = $props();

	const parkingQuery = createQuery(() => ({
		queryKey: ['parking'],
		queryFn: async () => {
			const response = await fetch(
				'https://data.grandlyon.com/geoserver/metropole-de-lyon/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=metropole-de-lyon:pvo_patrimoine_voirie.pvostationnementvelo&outputFormat=application/json&SRSNAME=EPSG:4171&sortBy=gid',
			);
			if (!response.ok) {
				throw new Error('Failed to fetch parking data');
			}
			const data = await response.json();
			return processParkingData(data.features);
		},
		staleTime: Infinity,
	}));

	const parkingLpaQuery = createQuery(() => ({
		queryKey: ['parking-lpa'],
		queryFn: async () => {
			const response = await fetch(
				'https://data.grandlyon.com/geoserver/metropole-de-lyon/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=metropole-de-lyon:pvo_patrimoine_voirie.pvoparking&outputFormat=application/json&SRSNAME=EPSG:4171&sortBy=gid',
			);
			if (!response.ok) {
				throw new Error('Failed to fetch parking LPA data');
			}
			const data = await response.json();
			return processLPAParkingData(data.features);
		},
		staleTime: Infinity,
	}));
</script>

<GeoJSONSource
	maxzoom={20}
	id="parking-data"
	data={{
		type: 'FeatureCollection',
		features: [...(parkingQuery.data?.features || []), ...(parkingLpaQuery.data?.features || [])],
	}}
>
	<ImageLoader
		images={{
			velov: '/velov-station.png',
			'parking-covered': [
				parkingCoveredIcon,
				{
					pixelRatio: 2,
				},
			],
			'parking-box': parkingSecureIcon,
			'parking-velostation': parkingVelostationIcon,
			'parking-lpa': parkingLpaIcon,
		}}
	>
		<CircleLayer
			id="parking-layer-circles"
			filter={['==', ['get', 'type'], 'arceaux']}
			layout={{
				visibility: isLayerVisible('parking-arceaux') ? 'visible' : 'none',
			}}
			paint={{
				'circle-opacity': 0.8,
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2, 15, 4, 18, 6],
				'circle-color': '#4ade80', // Green
				'circle-stroke-color': '#166534',
				'circle-stroke-width': 1,
			}}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
		/>

		<SymbolLayer
			id="parking-layer-capacity"
			filter={['all', ['==', ['get', 'type'], 'arceaux'], ['has', 'capacite']]}
			minzoom={16}
			layout={{
				visibility: isLayerVisible('parking-arceaux') ? 'visible' : 'none',
				'text-field': ['to-string', ['get', 'capacite']],
				'text-size': 10,
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
			layout={{
				visibility: isLayerVisible('parking-couverts') ? 'visible' : 'none',
				'icon-image': 'parking-covered',
				'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.2, 17, 0.5],
				'icon-allow-overlap': true,
				'text-field': ['step', ['zoom'], '', 16, ['to-string', ['get', 'capacite']]],
				'text-offset': [0, 1.2],
				'text-size': 10,
				'text-anchor': 'top',
			}}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
		/>

		<SymbolLayer
			id="parking-layer-box"
			filter={['==', ['get', 'type'], 'box']}
			layout={{
				visibility: isLayerVisible('parking-box') ? 'visible' : 'none',
				'icon-image': 'parking-secure',
				'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.2, 17, 0.4],
				'icon-allow-overlap': true,
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
				'text-color': '#1e40af', // Blue-800
				'text-halo-color': '#ffffff',
				'text-halo-width': 2,
			}}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
		/>
	</ImageLoader>
</GeoJSONSource>
