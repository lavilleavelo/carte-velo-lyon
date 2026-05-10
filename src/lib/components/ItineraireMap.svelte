<script lang="ts">
	import {
		MapLibre,
		AttributionControl,
		NavigationControl,
		GeoJSONSource,
		LineLayer,
		SymbolLayer,
	} from 'svelte-maplibre-gl';
	import MapStyleToggle from '$lib/components/map/MapStyleToggle.svelte';
	import OsmCyclewayLayer from '$lib/components/map/layers/OsmCyclewayLayer.svelte';
	import { createMapStyleState } from '$lib/utils/mapStyleToggle.svelte';
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

	const VISIBLE_LAYERS = new Set(['osm-cycleways']);

	function isLayerVisible(id: string): boolean {
		return VISIBLE_LAYERS.has(id);
	}

	const LYON_METRO_BBOX: [number, number, number, number] = [4.65, 45.6, 5.1, 45.92];

	const initialBounds = $derived.by<[[number, number], [number, number]]>(() => {
		const [w, s, e, n] = bbox;
		const [lw, ls, le, ln] = LYON_METRO_BBOX;
		const iw = Math.max(w, lw);
		const ie = Math.min(e, le);
		const is_ = Math.max(s, ls);
		const in_ = Math.min(n, ln);

		if (iw >= ie || is_ >= in_) {
			return [
				[w, s],
				[e, n],
			];
		}

		return [
			[iw, is_],
			[ie, in_],
		];
	});

	const center = $derived<{ lng: number; lat: number }>({
		lng: (initialBounds[0][0] + initialBounds[1][0]) / 2,
		lat: (initialBounds[0][1] + initialBounds[1][1]) / 2,
	});

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
		minZoom={5}
		maxZoom={18}
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
				id="itineraire-detail-line-casing"
				paint={{
					'line-color': '#ffffff',
					'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 7, 15, 12],
				}}
				layout={{ 'line-join': 'round', 'line-cap': 'round' }}
			/>
			<LineLayer
				id="itineraire-detail-line"
				paint={{
					'line-color': '#000',
					'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 12, 4, 15, 8],
					'line-opacity': 0.45,
				}}
				layout={{ 'line-join': 'round', 'line-cap': 'round' }}
			/>
		</GeoJSONSource>

		<OsmCyclewayLayer {isLayerVisible} {map} opacityScale={0.4} />

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
