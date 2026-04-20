<script lang="ts">
	import VelovLayer from '$lib/components/map/layers/VelovLayer.svelte';
	import ParkingLayer from '$lib/components/map/layers/ParkingLayer.svelte';
	import PumpLayer from '$lib/components/map/layers/PumpLayer.svelte';
	import WaterFountainLayer from '$lib/components/map/layers/WaterFountainLayer.svelte';
	import VoiesLyonnaisesLayer from '$lib/components/map/layers/VoiesLyonnaisesLayer.svelte';
	import type { FeatureCollection } from 'geojson';
	import type maplibregl from 'maplibre-gl';

	let {
		layers,
		boundary,
		map,
		yearRange,
	}: {
		layers: string[];
		boundary?: FeatureCollection;
		map?: maplibregl.Map;
		yearRange?: [number, number];
	} = $props();

	const isParkingVisible = (id: string) => layers.includes('parking') && id.startsWith('parking-');
	const isVelovVisible = (id: string) => layers.includes('velov') && id === 'velov';
	const isPumpVisible = (id: string) => layers.includes('pumps') && id === 'pumps';
	const isFountainVisible = (id: string) =>
		layers.includes('fountains') && id === 'water-fountains';
	const isVLVisible = (id: string) =>
		layers.includes('vl') && (id === 'vl' || id.startsWith('vl-'));

	function noop() {}
</script>

<ParkingLayer
	isLayerVisible={isParkingVisible}
	handleMouseEnter={noop}
	handleMouseLeave={noop}
	{boundary}
	{yearRange}
/>
<PumpLayer
	isLayerVisible={isPumpVisible}
	handleMouseEnter={noop}
	handleMouseLeave={noop}
	{boundary}
/>
<WaterFountainLayer
	isLayerVisible={isFountainVisible}
	handleMouseEnter={noop}
	handleMouseLeave={noop}
	{boundary}
	{yearRange}
/>
<VoiesLyonnaisesLayer isLayerVisible={isVLVisible} {map} {boundary} {yearRange} />
<VelovLayer
	isLayerVisible={isVelovVisible}
	handleMouseEnter={noop}
	handleMouseLeave={noop}
	{boundary}
/>
