<script lang="ts">
	import { GeoJSONSource, LineLayer, CircleLayer, SymbolLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import type { Feature, FeatureCollection, Position } from 'geojson';
	import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';

	let {
		isLayerVisible,
		handleMouseEnter,
		handleMouseLeave,
		boundary,
	}: {
		isLayerVisible: (id: string) => boolean;
		handleMouseEnter?: () => void;
		handleMouseLeave?: () => void;
		boundary?: FeatureCollection;
	} = $props();

	const COLOR = '#00a3a6';
	const TEXT_COLOR = '#00777a';

	function length(feature: Feature): number {
		const geometry = feature.geometry;
		const parts: Position[][] =
			geometry.type === 'MultiLineString'
				? geometry.coordinates
				: geometry.type === 'LineString'
					? [geometry.coordinates]
					: [];
		let total = 0;
		for (const part of parts) {
			for (let i = 1; i < part.length; i++) {
				total += Math.hypot(part[i][0] - part[i - 1][0], part[i][1] - part[i - 1][1]);
			}
		}
		return total;
	}

	// One trace per line: the other one loops at a terminus.
	function oneTracePerLine(features: Feature[]): Feature[] {
		const byLine = new Map<string, Feature>();
		for (const feature of features) {
			const line = String(feature.properties?.ligne ?? '');
			const current = byLine.get(line);
			if (!current || length(feature) < length(current)) {
				byLine.set(line, feature);
			}
		}
		return [...byLine.values()];
	}

	async function fetchCollection(type: string): Promise<FeatureCollection> {
		const response = await fetch(`/api/grandlyon/${type}`);
		if (!response.ok) {
			throw new Error('Failed to fetch Navigône data');
		}
		return response.json();
	}

	const query = createQuery(() => ({
		queryKey: ['navigone'],
		queryFn: async () => {
			const [route, stops] = await Promise.all([
				fetchCollection('navigoneRoute'),
				fetchCollection('navigoneStops'),
			]);
			return { route: { ...route, features: oneTracePerLine(route.features) }, stops };
		},
		staleTime: Infinity,
		enabled: isLayerVisible('navigone'),
		meta: { loadingLabel: 'Navigône' },
	}));

	const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

	const route = $derived.by(() => {
		const data = query.data?.route;
		if (!data) return empty;
		return boundary ? filterFeaturesInsideBoundary(data, boundary) : data;
	});

	const stops = $derived.by(() => {
		const data = query.data?.stops;
		if (!data) return empty;
		return boundary ? filterFeaturesInsideBoundary(data, boundary) : data;
	});

	const visibility = $derived(isLayerVisible('navigone') ? 'visible' : 'none');
</script>

<GeoJSONSource id="navigone-route-data" data={route}>
	<LineLayer
		id="navigone-route-casing"
		layout={{ 'line-join': 'round', 'line-cap': 'round', visibility }}
		paint={{
			'line-color': '#ffffff',
			'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3.5, 14, 5, 17, 7],
			'line-opacity': 0.8,
		}}
	/>
	<LineLayer
		id="navigone-route"
		layout={{ 'line-join': 'round', 'line-cap': 'butt', visibility }}
		paint={{
			'line-color': COLOR,
			'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 14, 3, 17, 4.5],
			'line-dasharray': [3, 1.6],
		}}
	/>
	<LineLayer
		id="navigone-route-hitarea"
		layout={{ 'line-join': 'round', 'line-cap': 'round', visibility }}
		paint={{ 'line-color': 'transparent', 'line-width': 20, 'line-opacity': 0 }}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	/>
	<SymbolLayer
		id="navigone-route-label"
		minzoom={13}
		layout={{
			'symbol-placement': 'line',
			'symbol-spacing': 400,
			'text-field': 'Navigône',
			'text-size': 12,
			'text-offset': [0, -0.9],
			visibility,
		}}
		paint={{ 'text-color': TEXT_COLOR, 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }}
	/>
</GeoJSONSource>

<GeoJSONSource id="navigone-stops-data" data={stops}>
	<CircleLayer
		id="navigone-stops"
		layout={{ visibility }}
		paint={{
			'circle-color': '#ffffff',
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3.5, 15, 6],
			'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 15, 3],
			'circle-stroke-color': COLOR,
		}}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	/>
	<SymbolLayer
		id="navigone-stop-labels"
		minzoom={13}
		layout={{
			'text-field': ['get', 'nom'],
			'text-size': 12,
			'text-offset': [0, 1.2],
			'text-anchor': 'top',
			'text-optional': true,
			visibility,
		}}
		paint={{ 'text-color': TEXT_COLOR, 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }}
	/>
</GeoJSONSource>
