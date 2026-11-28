<script lang="ts" module>
	export type MapVehicle = {
		id: string;
		line: string;
		lat: number;
		lon: number;
		color: string;
		textColor: string;
	};
</script>

<script lang="ts">
	import 'svelte-maplibre-gl/vite';
	import { MapLibre, GeoJSONSource, CircleLayer, SymbolLayer } from 'svelte-maplibre-gl';
	import * as maplibregl from 'maplibre-gl';

	interface Props {
		vehicles: MapVehicle[];
		selectedId: string | null;
		onSelect: (id: string | null) => void;
	}

	let { vehicles, selectedId, onSelect }: Props = $props();

	const HIT_RADIUS = 10;

	const geojson = $derived({
		type: 'FeatureCollection' as const,
		features: vehicles.map((vehicle) => ({
			type: 'Feature' as const,
			properties: {
				id: vehicle.id,
				line: vehicle.line,
				color: vehicle.color,
				textColor: vehicle.textColor,
				selected: vehicle.id === selectedId ? 1 : 0,
			},
			geometry: { type: 'Point' as const, coordinates: [vehicle.lon, vehicle.lat] },
		})),
	});

	let map = $state.raw<maplibregl.Map | undefined>();

	function onclick(event: maplibregl.MapMouseEvent) {
		if (!map) {
			return;
		}
		const { x, y } = event.point;
		const features = map.queryRenderedFeatures(
			[
				[x - HIT_RADIUS, y - HIT_RADIUS],
				[x + HIT_RADIUS, y + HIT_RADIUS],
			],
			{ layers: ['tcl-live-vehicles-circle'] },
		);
		let best: { id: string; distance: number } | null = null;
		for (const feature of features) {
			if (feature.geometry.type !== 'Point') {
				continue;
			}
			const point = map.project(feature.geometry.coordinates as [number, number]);
			const distance = Math.hypot(point.x - x, point.y - y);
			const id = feature.properties.id;
			if (typeof id === 'string' && (!best || distance < best.distance)) {
				best = { id, distance };
			}
		}
		onSelect(best?.id ?? null);
	}
</script>

<MapLibre
	bind:map
	{onclick}
	style="https://tiles.openfreemap.org/styles/positron"
	center={[4.85, 45.755]}
	zoom={12}
	minZoom={9}
	maxZoom={18}
	class="h-[70vh] min-h-[420px] w-full"
>
	<GeoJSONSource id="tcl-live-vehicles" data={geojson}>
		<CircleLayer
			id="tcl-live-vehicles-circle"
			paint={{
				'circle-radius': [
					'interpolate',
					['linear'],
					['zoom'],
					10,
					['match', ['get', 'selected'], 1, 7, 3],
					13,
					['match', ['get', 'selected'], 1, 9, 5],
					15,
					['match', ['get', 'selected'], 1, 12, 8],
					17,
					['match', ['get', 'selected'], 1, 14, 10],
				],
				'circle-color': ['get', 'color'],
				'circle-stroke-color': ['match', ['get', 'selected'], 1, '#111827', '#ffffff'],
				'circle-stroke-width': ['match', ['get', 'selected'], 1, 3, 1.5],
			}}
		/>
		<SymbolLayer
			id="tcl-live-vehicles-label"
			minzoom={14}
			layout={{
				'text-field': ['get', 'line'],
				'text-font': ['Noto Sans Bold'],
				'text-size': 9,
				'text-allow-overlap': true,
			}}
			paint={{ 'text-color': ['get', 'textColor'] }}
		/>
	</GeoJSONSource>
</MapLibre>
