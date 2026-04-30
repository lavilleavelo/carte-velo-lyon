<script lang="ts">
	import { GeoJSONSource, SymbolLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import type { FeatureCollection } from 'geojson';
	import type maplibregl from 'maplibre-gl';
	import { EMPTY_FEATURE_COLLECTION, filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
	import { createOnewayArrowIcon } from '$lib/utils/mapUtils';

	let {
		boundary,
		map,
		maxzoom = 22,
	}: {
		boundary?: FeatureCollection;
		map?: maplibregl.Map;
		maxzoom?: number;
	} = $props();

	const ICON_FORWARD = 'oneway-arrow-forward';
	const ICON_REVERSE = 'oneway-arrow-reverse';
	const COLOR = '#000000';

	function ensureIcons(m: maplibregl.Map) {
		const register = (name: string, reverse: boolean) => {
			if (m.hasImage(name)) {
				return;
			}

			const canvas = createOnewayArrowIcon(COLOR, reverse);
			const ctx = canvas.getContext('2d');
			const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
			if (imageData) {
				m.addImage(name, imageData, { pixelRatio: window.devicePixelRatio || 1 });
			}
		};

		register(ICON_FORWARD, false);
		register(ICON_REVERSE, true);
	}

	$effect(() => {
		if (map) {
			ensureIcons(map);
		}
	});

	type OverpassWay = {
		type: 'way';
		id: number;
		geometry?: { lon: number; lat: number }[];
		tags?: Record<string, string>;
	};

	const MAJOR_CLASSES = new Set([
		'primary',
		'secondary',
		'primary_link',
		'secondary_link',
	]);

	const EXCLUDED_HIGHWAYS = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link']);

	function overpassToGeoJSON(data: { elements?: OverpassWay[] }): FeatureCollection {
		const features: GeoJSON.Feature[] = [];
		for (const el of data.elements ?? []) {
			if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) {
				continue;
			}

			const tags = el.tags ?? {};
			const highway = tags.highway ?? '';
			if (EXCLUDED_HIGHWAYS.has(highway)) {
				continue;
			}

			const coords = el.geometry.map((p) => [p.lon, p.lat]);
			const reverse = tags.oneway === '-1';
			features.push({
				type: 'Feature',
				properties: {
					osmId: el.id,
					highway,
					isMajor: MAJOR_CLASSES.has(highway) ? 1 : 0,
					reverse: reverse ? 1 : 0,
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
		if (!data) return EMPTY_FEATURE_COLLECTION;
		return boundary ? filterFeaturesInsideBoundary(data, boundary) : data;
	});

	const iconImageExpr: any = ['case', ['==', ['get', 'reverse'], 1], ICON_REVERSE, ICON_FORWARD];
</script>

<GeoJSONSource id="overpass-oneways-source" data={filteredData}>
		<SymbolLayer
			id="overpass-oneways-major"
			minzoom={14}
			{maxzoom}
			filter={['==', ['get', 'isMajor'], 1]}
			layout={{
				'symbol-placement': 'line',
				'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 11, 220, 14, 140],
				'icon-image': iconImageExpr,
				'icon-rotation-alignment': 'map',
				'icon-pitch-alignment': 'map',
				'icon-keep-upright': false,
				'icon-allow-overlap': false,
				'icon-ignore-placement': false,
			}}
			paint={{
				'icon-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 12, 0.5],
			}}
		/>

		<SymbolLayer
			id="overpass-oneways-minor"
			minzoom={14}
			{maxzoom}
			filter={['==', ['get', 'isMajor'], 0]}
			layout={{
				'symbol-placement': 'line',
				'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 12.5, 180, 14, 140],
				'icon-image': iconImageExpr,
				'icon-rotation-alignment': 'map',
				'icon-pitch-alignment': 'map',
				'icon-keep-upright': false,
				'icon-allow-overlap': false,
				'icon-ignore-placement': false,
			}}
			paint={{
				'icon-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0.4, 13.5, 0.5],
			}}
		/>
</GeoJSONSource>
