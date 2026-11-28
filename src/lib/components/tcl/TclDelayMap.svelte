<script lang="ts">
	import 'svelte-maplibre-gl/vite';
	import {
		MapLibre,
		GeoJSONSource,
		FillLayer,
		LineLayer,
		CircleLayer,
		SymbolLayer,
		Popup,
	} from 'svelte-maplibre-gl';
	import * as maplibregl from 'maplibre-gl';
	import { untrack } from 'svelte';

	type Cell = [latIndex: number, lonIndex: number, journeys: number, lost: number, spent: number];

	type Routes = {
		type: 'FeatureCollection';
		features: {
			type: 'Feature';
			properties: { line: string; direction: string; name: string };
			geometry:
				| { type: 'MultiLineString'; coordinates: [number, number][][] }
				| { type: 'LineString'; coordinates: [number, number][] };
		}[];
	};

	interface Props {
		cells: Cell[];
		cellSize: { lat: number; lon: number };
		bins: { min: number; color: string; label: string }[];
		neutralColor: string;
		metric?: 'lost' | 'spent';
		routes: Routes;
		fitKey: string;
		stops?: { id: number; name: string; lat: number; lon: number }[];
		fromStop?: number | null;
		toStop?: number | null;
		onStopClick?: (id: number) => void;
	}

	let {
		cells,
		cellSize,
		bins,
		neutralColor,
		metric = 'lost',
		routes,
		fitKey,
		stops = [],
		fromStop = null,
		toStop = null,
		onStopClick,
	}: Props = $props();

	let hoveredStop = $state.raw<{ lngLat: maplibregl.LngLat; name: string } | null>(null);

	const stopFeatures = $derived({
		type: 'FeatureCollection' as const,
		features: stops.map((stop) => ({
			type: 'Feature' as const,
			properties: {
				id: stop.id,
				name: stop.name,
				role: stop.id === fromStop ? 'from' : stop.id === toStop ? 'to' : '',
			},
			geometry: { type: 'Point' as const, coordinates: [stop.lon, stop.lat] },
		})),
	});

	function onStopMove(event: maplibregl.MapLayerMouseEvent) {
		const feature = event.features?.[0];
		hoveredStop = feature ? { lngLat: event.lngLat, name: String(feature.properties.name) } : null;
	}

	function onStopSelect(event: maplibregl.MapLayerMouseEvent) {
		const id = Number(event.features?.[0]?.properties.id);
		if (Number.isFinite(id)) {
			onStopClick?.(id);
		}
	}

	let map = $state.raw<maplibregl.Map | undefined>();

	let hovered = $state.raw<{
		lngLat: maplibregl.LngLat;
		lost: number;
		spent: number;
		journeys: number;
	} | null>(null);

	const geojson = $derived({
		type: 'FeatureCollection' as const,
		features: cells.map(([latIndex, lonIndex, journeys, lost, spent]) => {
			const south = latIndex * cellSize.lat;
			const west = lonIndex * cellSize.lon;
			return {
				type: 'Feature' as const,
				properties: { lost, spent, journeys },
				geometry: {
					type: 'Polygon' as const,
					coordinates: [
						[
							[west, south],
							[west + cellSize.lon, south],
							[west + cellSize.lon, south + cellSize.lat],
							[west, south + cellSize.lat],
							[west, south],
						],
					],
				},
			};
		}),
	});

	const fillColor = $derived([
		'step',
		['get', metric],
		neutralColor,
		...bins.flatMap((bin) => [bin.min, bin.color]),
	] as unknown as maplibregl.ExpressionSpecification);

	function fitView(target: maplibregl.Map) {
		const bounds = new maplibregl.LngLatBounds();
		for (const feature of routes.features) {
			const parts =
				feature.geometry.type === 'MultiLineString'
					? feature.geometry.coordinates
					: [feature.geometry.coordinates];
			for (const part of parts) {
				for (const position of part) {
					bounds.extend(position);
				}
			}
		}
		if (routes.features.length === 0) {
			for (const [latIndex, lonIndex] of cells) {
				bounds.extend([lonIndex * cellSize.lon, latIndex * cellSize.lat]);
			}
		}
		if (!bounds.isEmpty()) {
			target.fitBounds(bounds, { padding: 32, maxZoom: 15, duration: 600 });
		}
	}

	$effect(() => {
		const target = map;
		void fitKey;
		if (target) {
			untrack(() => fitView(target));
		}
	});

	function onmousemove(event: maplibregl.MapLayerMouseEvent) {
		const feature = event.features?.[0];
		if (!feature) {
			hovered = null;
			return;
		}
		hovered = {
			lngLat: event.lngLat,
			lost: Number(feature.properties.lost),
			spent: Number(feature.properties.spent),
			journeys: Number(feature.properties.journeys),
		};
	}
</script>

<MapLibre
	bind:map
	style="https://tiles.openfreemap.org/styles/positron"
	center={[4.8345, 45.7632]}
	zoom={13}
	minZoom={10}
	maxZoom={18}
	class="h-[520px] w-full rounded-lg"
>
	<GeoJSONSource id="tcl-delay-cells" data={geojson}>
		<FillLayer
			id="tcl-delay-cells-fill"
			paint={{ 'fill-color': fillColor, 'fill-opacity': 0.8 }}
			{onmousemove}
			onmouseleave={() => (hovered = null)}
		/>
		<LineLayer
			id="tcl-delay-cells-outline"
			paint={{ 'line-color': '#ffffff', 'line-width': 1, 'line-opacity': 0.8 }}
		/>
	</GeoJSONSource>
	<GeoJSONSource id="tcl-routes" data={routes}>
		<LineLayer
			id="tcl-routes-casing"
			layout={{ 'line-join': 'round', 'line-cap': 'round' }}
			paint={{ 'line-color': '#ffffff', 'line-width': 4, 'line-opacity': 0.9 }}
		/>
		<LineLayer
			id="tcl-routes-line"
			layout={{ 'line-join': 'round', 'line-cap': 'round' }}
			paint={{ 'line-color': '#1e293b', 'line-width': 1.5 }}
		/>
		<SymbolLayer
			id="tcl-routes-label"
			layout={{
				'text-field': ['get', 'line'],
				'text-font': ['Noto Sans Bold'],
				'text-size': 12,
				'symbol-placement': 'line',
				'symbol-spacing': 280,
			}}
			paint={{ 'text-color': '#1e293b', 'text-halo-color': '#ffffff', 'text-halo-width': 2 }}
		/>
	</GeoJSONSource>
	<GeoJSONSource id="tcl-stops" data={stopFeatures}>
		<CircleLayer
			id="tcl-stops-circle"
			paint={{
				'circle-radius': [
					'interpolate',
					['linear'],
					['zoom'],
					11,
					['match', ['get', 'role'], '', 2, 6],
					15,
					['match', ['get', 'role'], '', 5, 9],
				],
				'circle-color': ['match', ['get', 'role'], 'from', '#1e3a8a', 'to', '#f54900', '#ffffff'],
				'circle-stroke-color': '#1e293b',
				'circle-stroke-width': ['match', ['get', 'role'], '', 1.5, 2.5],
			}}
			onmousemove={onStopMove}
			onmouseleave={() => (hoveredStop = null)}
			onclick={onStopSelect}
		/>
		<SymbolLayer
			id="tcl-stops-label"
			filter={['!=', ['get', 'role'], '']}
			layout={{
				'text-field': ['get', 'name'],
				'text-font': ['Noto Sans Bold'],
				'text-size': 13,
				'text-offset': [0, 1.3],
				'text-anchor': 'top',
			}}
			paint={{ 'text-color': '#1e293b', 'text-halo-color': '#ffffff', 'text-halo-width': 2 }}
		/>
	</GeoJSONSource>
	{#if hoveredStop}
		<Popup lnglat={hoveredStop.lngLat} closeButton={false} closeOnClick={false} offset={10}>
			<div class="p-1 text-xs font-semibold">{hoveredStop.name}</div>
		</Popup>
	{:else if hovered}
		<Popup lnglat={hovered.lngLat} closeButton={false} closeOnClick={false} offset={12}>
			<div class="space-y-1 p-1 text-xs">
				<div class="font-semibold">
					{metric === 'spent'
						? `${hovered.spent} s passées dans le carré`
						: hovered.lost > 0
							? `${hovered.lost} s de retard pris`
							: `${-hovered.lost} s regagnées`}
				</div>
				<div class="text-gray-600">
					{metric === 'spent'
						? hovered.lost > 0
							? `${hovered.lost} s de retard pris`
							: `${-hovered.lost} s regagnées`
						: `${hovered.spent} s passées dans le carré`}, en moyenne sur
					{hovered.journeys.toLocaleString('fr-FR')} passages
				</div>
			</div>
		</Popup>
	{/if}
</MapLibre>
