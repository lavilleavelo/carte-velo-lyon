<script lang="ts">
	import { MapLibre, AttributionControl, NavigationControl, Marker } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import { onMount } from 'svelte';
	import MapStyleToggle from '$lib/components/map/MapStyleToggle.svelte';
	import NavigationButtons from '$lib/components/map/NavigationButtons.svelte';
	import {
		loadDefaultProvider,
		parseOsmId,
		type PoiContext,
	} from '$lib/config/navigationProviders';
	import ParkingLayer from '$lib/components/map/layers/ParkingLayer.svelte';
	import CyclewayLayer from '$lib/components/map/layers/CyclewayLayer.svelte';
	import OsmCyclewayLayer from '$lib/components/map/layers/OsmCyclewayLayer.svelte';
	import VoiesLyonnaisesLayer from '$lib/components/map/layers/VoiesLyonnaisesLayer.svelte';
	import OverpassVLLayer from '$lib/components/map/layers/OverpassVLLayer.svelte';
	import VoiesLyonnaisesShields from '$lib/components/map/layers/VoiesLyonnaisesShields.svelte';
	import { createMapStyleState } from '$lib/utils/mapStyleToggle.svelte';
	import { voirieQueryOptions } from '$lib/queries/cyclewayQueries';
	import type maplibregl from 'maplibre-gl';

	let {
		lng,
		lat,
		zoom = 16,
		name,
		osmId,
	}: { lng: number; lat: number; zoom?: number; name?: string; osmId?: string } = $props();

	const poiContext = $derived.by<PoiContext | undefined>(() => {
		const parsed = parseOsmId(osmId);
		if (!parsed && !name) {
			return undefined;
		}

		return { ...parsed, name };
	});

	const mapStyleState = createMapStyleState('cyclopolis', () => {});

	let map: maplibregl.Map | undefined = $state();
	let cursor: string | undefined = $state();

	const VISIBLE_LAYERS = new Set([
		'cycleways',
		'osm-cycleways',
		'parking-arceaux',
		'parking-couverts',
		'parking-box',
		'parking-velostation',
		'parking-lpa',
		...Array.from({ length: 12 }, (_, i) => `vl-${i + 1}`),
	]);

	function isLayerVisible(id: string): boolean {
		return VISIBLE_LAYERS.has(id);
	}

	const voirieQuery = createQuery(() => voirieQueryOptions());

	function handleMouseEnter() {
		cursor = 'pointer';
	}
	function handleMouseLeave() {
		cursor = undefined;
	}

	let defaultNavProvider = $state(loadDefaultProvider());
	onMount(() => {
		defaultNavProvider = loadDefaultProvider();
	});
</script>

<div class="relative h-[40vh] min-h-64 overflow-hidden md:h-[50vh] md:rounded-xl md:shadow">
	<MapLibre
		bind:map
		class="h-full w-full"
		style={mapStyleState.getMapStyleUrl()}
		center={{ lng, lat }}
		{zoom}
		attributionControl={false}
		cooperativeGestures={true}
		{cursor}
	>
		<AttributionControl compact={true} position="bottom-left" />
		<NavigationControl position="top-right" showCompass={false} />
		<MapStyleToggle
			currentStyle={mapStyleState.mapStyle}
			onSelect={mapStyleState.setMapStyle}
			position="top-right"
		/>

		<CyclewayLayer {isLayerVisible} voirieData={voirieQuery.data} />
		<OsmCyclewayLayer {isLayerVisible} {map} />
		<VoiesLyonnaisesLayer {isLayerVisible} {map} />
		<VoiesLyonnaisesShields {isLayerVisible} {map} />
		<OverpassVLLayer {isLayerVisible} {map} />
		<ParkingLayer {isLayerVisible} {handleMouseEnter} {handleMouseLeave} />

		<Marker lnglat={{ lng, lat }} />
	</MapLibre>

	<div class="pointer-events-none absolute right-3 bottom-3 z-10 w-64 max-w-[calc(100%-1.5rem)]">
		<div class="pointer-events-auto rounded-lg bg-white/95 p-1.5 shadow-lg backdrop-blur">
			<NavigationButtons {lat} {lng} defaultProviderId={defaultNavProvider} {poiContext} />
		</div>
	</div>
</div>
