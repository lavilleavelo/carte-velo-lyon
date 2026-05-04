<script lang="ts">
	import {
		MapLibre,
		AttributionControl,
		NavigationControl,
		GeoJSONSource,
		LineLayer,
		SymbolLayer,
	} from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import MapStyleToggle from '$lib/components/map/MapStyleToggle.svelte';
	import CyclewayLayer from '$lib/components/map/layers/CyclewayLayer.svelte';
	import OsmCyclewayLayer from '$lib/components/map/layers/OsmCyclewayLayer.svelte';
	import { createMapStyleState } from '$lib/utils/mapStyleToggle.svelte';
	import { voirieQueryOptions } from '$lib/queries/cyclewayQueries';
	import type maplibregl from 'maplibre-gl';

	let {
		title,
		geoJsonUrl,
		bbox,
		color = '#1e3a5f',
	}: {
		title: string;
		geoJsonUrl: string;
		bbox: [number, number, number, number];
		color?: string;
	} = $props();

	const mapStyleState = createMapStyleState('cyclopolis', () => {});

	let map: maplibregl.Map | undefined = $state();

	const VISIBLE_LAYERS = new Set(['cycleways', 'osm-cycleways']);

	function isLayerVisible(id: string): boolean {
		return VISIBLE_LAYERS.has(id);
	}

	const voirieQuery = createQuery(() => voirieQueryOptions());

	const center = $derived<{ lng: number; lat: number }>({
		lng: (bbox[0] + bbox[2]) / 2,
		lat: (bbox[1] + bbox[3]) / 2,
	});

	const initialBounds: [[number, number], [number, number]] = [
		[bbox[0], bbox[1]],
		[bbox[2], bbox[3]],
	];

	let didFit = false;
	$effect(() => {
		if (!map || didFit) {
			return;
		}
		map.fitBounds(initialBounds, { padding: 40, duration: 0 });
		didFit = true;
	});
</script>

<div class="relative h-[45vh] min-h-72 overflow-hidden md:h-[55vh] md:rounded-xl md:shadow">
	<MapLibre
		bind:map
		class="h-full w-full"
		style={mapStyleState.getMapStyleUrl()}
		{center}
		zoom={9}
		attributionControl={false}
		cooperativeGestures={true}
	>
		<AttributionControl compact={true} position="bottom-left" />
		<NavigationControl position="top-right" showCompass={false} />
		<MapStyleToggle
			currentStyle={mapStyleState.mapStyle}
			onSelect={mapStyleState.setMapStyle}
			position="top-right"
		/>

		<GeoJSONSource id="itineraire-detail-source" data={geoJsonUrl}>
			<LineLayer
				id="itineraire-detail-line"
				paint={{
					'line-color': color,
					'line-width': 8,
					'line-opacity': 0.45,
				}}
				layout={{ 'line-join': 'round', 'line-cap': 'round' }}
			/>
		</GeoJSONSource>

		<CyclewayLayer {isLayerVisible} voirieData={voirieQuery.data} />
		<OsmCyclewayLayer {isLayerVisible} {map} />

		<GeoJSONSource id="itineraire-detail-label-source" data={geoJsonUrl}>
			<SymbolLayer
				id="itineraire-detail-label"
				minzoom={9}
				layout={{
					'text-field': title,
					'symbol-placement': 'line',
					'symbol-spacing': 350,
					'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
					'text-size': 12,
					'text-max-angle': 30,
					'text-keep-upright': true,
				}}
				paint={{
					'text-color': color,
					'text-halo-color': '#ffffff',
					'text-halo-width': 2.5,
				}}
			/>
		</GeoJSONSource>
	</MapLibre>
</div>
