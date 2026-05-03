<script lang="ts">
	import VelovLayer from '$lib/components/map/layers/VelovLayer.svelte';
	import ParkingLayer from '$lib/components/map/layers/ParkingLayer.svelte';
	import PumpLayer from '$lib/components/map/layers/PumpLayer.svelte';
	import WaterFountainLayer from '$lib/components/map/layers/WaterFountainLayer.svelte';
	import VoiesLyonnaisesShields from '$lib/components/map/layers/VoiesLyonnaisesShields.svelte';
	import OverpassVLShields from '$lib/components/map/layers/OverpassVLShields.svelte';
	import OverpassOnewayArrowsLayer from '$lib/components/map/layers/OverpassOnewayArrowsLayer.svelte';
	import MetroLayer from '$lib/components/map/layers/MetroLayer.svelte';
	import TramLayer from '$lib/components/map/layers/TramLayer.svelte';
	import BusLayer from '$lib/components/map/layers/BusLayer.svelte';
	import ToiletLayer from '$lib/components/map/layers/ToiletLayer.svelte';
	import SchoolLayer from '$lib/components/map/layers/SchoolLayer.svelte';
	import AdditionalPOILayer from '$lib/components/map/layers/AdditionalPOILayer.svelte';
	import CountersLayer from '$lib/components/map/layers/CountersLayer.svelte';
	import TargetNetworkLayer from '$lib/components/map/layers/TargetNetworkLayer.svelte';
	import AccidentsVeloLayer from '$lib/components/map/layers/AccidentsVeloLayer.svelte';
	import type { FeatureCollection } from 'geojson';
	import type maplibregl from 'maplibre-gl';

	let {
		visible,
		boundary,
		map,
		yearRange,
		targetNetworkHorizons = [],
	}: {
		visible: Set<string>;
		boundary?: FeatureCollection;
		map?: maplibregl.Map;
		yearRange?: [number, number];
		targetNetworkHorizons?: string[];
	} = $props();

	const isLayerVisible = (id: string) => visible.has(id);

	function noop() {}
</script>

<ParkingLayer
	{isLayerVisible}
	handleMouseEnter={noop}
	handleMouseLeave={noop}
	{boundary}
	{yearRange}
/>
<PumpLayer {isLayerVisible} handleMouseEnter={noop} handleMouseLeave={noop} {boundary} />
<WaterFountainLayer
	{isLayerVisible}
	handleMouseEnter={noop}
	handleMouseLeave={noop}
	{boundary}
	{yearRange}
/>
<VoiesLyonnaisesShields {isLayerVisible} {map} {boundary} {yearRange} />
<OverpassVLShields {isLayerVisible} {map} {boundary} />
<OverpassOnewayArrowsLayer {boundary} {map} />
<VelovLayer {isLayerVisible} handleMouseEnter={noop} handleMouseLeave={noop} {map} {boundary} />
{#if visible.has('metro')}
	<MetroLayer {isLayerVisible} handleMouseEnter={noop} handleMouseLeave={noop} {map} {boundary} />
{/if}
{#if visible.has('tram')}
	<TramLayer {isLayerVisible} handleMouseEnter={noop} handleMouseLeave={noop} {map} {boundary} />
{/if}
<BusLayer {isLayerVisible} handleMouseEnter={noop} handleMouseLeave={noop} {map} {boundary} />
<ToiletLayer {isLayerVisible} handleMouseEnter={noop} handleMouseLeave={noop} {map} {boundary} />
<SchoolLayer {isLayerVisible} handleMouseEnter={noop} handleMouseLeave={noop} {map} {boundary} />
<AdditionalPOILayer
	{isLayerVisible}
	handleMouseEnter={noop}
	handleMouseLeave={noop}
	{map}
	{boundary}
/>
<CountersLayer {isLayerVisible} handleMouseEnter={noop} handleMouseLeave={noop} {boundary} />
<TargetNetworkLayer {isLayerVisible} {targetNetworkHorizons} {boundary} />
<AccidentsVeloLayer
	{isLayerVisible}
	handleMouseEnter={noop}
	handleMouseLeave={noop}
	{map}
	{boundary}
/>
