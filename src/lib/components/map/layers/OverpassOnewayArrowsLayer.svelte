<script lang="ts">
	import { GeoJSONSource, SymbolLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import type { FeatureCollection } from 'geojson';
	import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';

	let {
		boundary,
	}: {
		boundary?: FeatureCollection;
	} = $props();

	type OverpassWay = {
		type: 'way';
		id: number;
		geometry?: { lon: number; lat: number }[];
		tags?: Record<string, string>;
	};

	const MAJOR_CLASSES = new Set([
		'motorway',
		'trunk',
		'primary',
		'secondary',
		'primary_link',
		'secondary_link',
	]);

	function overpassToGeoJSON(data: { elements?: OverpassWay[] }): FeatureCollection {
		const features: GeoJSON.Feature[] = [];
		for (const el of data.elements ?? []) {
			if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) {
				continue;
			}

			const tags = el.tags ?? {};
			const coords = el.geometry.map((p) => [p.lon, p.lat]);
			const reverse = tags.oneway === '-1';
			const highway = tags.highway ?? '';
			features.push({
				type: 'Feature',
				properties: {
					osmId: el.id,
					highway,
					isMajor: MAJOR_CLASSES.has(highway) ? 1 : 0,
					arrow: reverse ? '←' : '→',
				},
				geometry: { type: 'LineString', coordinates: coords },
			});
		}
		return { type: 'FeatureCollection', features };
	}

	const onewaysQuery = createQuery(() => ({
		queryKey: ['overpass-oneways'],
		queryFn: async () => {
			const response = await fetch('/api/overpass-oneways');
			if (!response.ok) {
				throw new Error('Failed to fetch Overpass one-way data');
			}
			return overpassToGeoJSON(await response.json());
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		meta: { loadingLabel: 'Sens uniques (OSM)' },
	}));

	const filteredData = $derived.by(() => {
		const data = onewaysQuery.data;
		if (!data) return undefined;
		return boundary ? filterFeaturesInsideBoundary(data, boundary) : data;
	});
</script>

{#if filteredData}
	<GeoJSONSource id="overpass-oneways-source" data={filteredData}>
		<SymbolLayer
			id="overpass-oneways-major"
			minzoom={11}
			maxzoom={15}
			filter={['==', ['get', 'isMajor'], 1]}
			layout={{
				'symbol-placement': 'line',
				'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 11, 260, 14, 180],
				'text-font': ['Noto Sans Regular'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 11, 18, 14, 24],
				'text-rotation-alignment': 'map',
				'text-pitch-alignment': 'viewport',
				'text-keep-upright': false,
				'text-field': ['get', 'arrow'],
			}}
			paint={{
				'text-color': '#5b6470',
				'text-halo-color': '#ffffff',
				'text-halo-width': 1.5,
				'text-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 12, 0.95],
			}}
		/>

		<SymbolLayer
			id="overpass-oneways-minor"
			minzoom={13}
			maxzoom={15}
			filter={['==', ['get', 'isMajor'], 0]}
			layout={{
				'symbol-placement': 'line',
				'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 12.5, 220, 14, 180],
				'text-font': ['Noto Sans Regular'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 12.5, 22, 14, 24],
				'text-rotation-alignment': 'map',
				'text-pitch-alignment': 'viewport',
				'text-keep-upright': false,
				'text-field': ['get', 'arrow'],
			}}
			paint={{
				'text-color': '#5b6470',
				'text-halo-color': '#ffffff',
				'text-halo-width': 1.5,
				'text-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0.7, 13.5, 0.95],
			}}
		/>
	</GeoJSONSource>
{/if}
