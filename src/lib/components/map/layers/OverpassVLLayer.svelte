<script lang="ts">
	import { GeoJSONSource, LineLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import { vlColors, calculateLineDistance } from '$lib/utils/mapUtils';
	import type { GeoJSON, FeatureCollection } from 'geojson';
	import type * as maplibregl from 'maplibre-gl';
	import { EMPTY_FEATURE_COLLECTION, filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';

	let {
		isLayerVisible,
		map,
		boundary,
	}: {
		isLayerVisible: (id: string) => boolean;
		map: maplibregl.Map | undefined;
		boundary?: FeatureCollection;
	} = $props();

	const anyOsmVLVisible = $derived(
		Array.from({ length: 12 }, (_, i) => `osm-vl-${i + 1}`).some((id) => isLayerVisible(id)),
	);

	function extractLineNumber(ref: string | undefined): number | null {
		if (!ref) return null;
		const match = ref.match(/^VL(\d+)$/);
		return match ? parseInt(match[1], 10) : null;
	}

	function coordsKey(coords: number[][]): string {
		return coords.map((c) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`).join('|');
	}

	function assignOffsetsAndCompositeIcons(grouped: Record<number, GeoJSON.Feature[]>) {
		const sharedSegments = new Map<string, Set<number>>();

		for (const [lineNum, features] of Object.entries(grouped)) {
			for (const feature of features) {
				const coords = (feature.geometry as GeoJSON.LineString).coordinates;
				const key = coordsKey(coords);
				if (!sharedSegments.has(key)) {
					sharedSegments.set(key, new Set());
				}
				sharedSegments.get(key)!.add(Number(lineNum));
			}
		}

		const compositeIcons = new Set<string>();

		const OFFSET_STEP = 5;
		for (const [lineNum, features] of Object.entries(grouped)) {
			for (const feature of features) {
				const coords = (feature.geometry as GeoJSON.LineString).coordinates;
				const key = coordsKey(coords);
				const lines = sharedSegments.get(key)!;
				const sortedLines = [...lines].sort((a, b) => a - b);

				if (sortedLines.length > 1) {
					const idx = sortedLines.indexOf(Number(lineNum));
					const lastIdx = sortedLines.length - 1;
					const center = lastIdx / 2;
					const combo = sortedLines.join('-');
					compositeIcons.add(combo);
					feature.properties = {
						...feature.properties,
						offset: (idx - center) * OFFSET_STEP,
						compositeIconName: `line-shield-${combo}`,
						showShield: idx === 0 ? 1 : 0,
						contourWidth: lastIdx * OFFSET_STEP + 8,
					};
				} else {
					feature.properties = {
						...feature.properties,
						offset: 0,
						showShield: 1,
						contourWidth: 8,
					};
				}
			}
		}

		return compositeIcons;
	}

	function overpassToGrouped(data: any): {
		grouped: Record<number, GeoJSON.FeatureCollection>;
		compositeIcons: Set<string>;
	} {
		const grouped: Record<number, GeoJSON.Feature[]> = {};

		for (const element of data.elements || []) {
			const properties: Record<string, any> = {
				...element.tags,
				osmId: element.id,
				osmType: element.type,
			};

			const lineNumber = extractLineNumber(element.tags?.ref);

			if (element.type === 'way' && element.geometry) {
				const feature: GeoJSON.Feature = {
					type: 'Feature',
					properties,
					geometry: {
						type: 'LineString',
						coordinates: element.geometry.map((p: { lon: number; lat: number }) => [p.lon, p.lat]),
					},
				};
				if (lineNumber) {
					(grouped[lineNumber] ??= []).push(feature);
				}
			} else if (element.type === 'relation' && element.members) {
				const relLineNumber = lineNumber ?? extractLineNumber(element.tags?.ref);
				if (!relLineNumber) continue;

				for (const member of element.members) {
					if (member.type === 'way' && member.geometry) {
						(grouped[relLineNumber] ??= []).push({
							type: 'Feature',
							properties: { ...properties, role: member.role },
							geometry: {
								type: 'LineString',
								coordinates: member.geometry.map((p: { lon: number; lat: number }) => [
									p.lon,
									p.lat,
								]),
							},
						});
					}
				}
			}
		}

		const compositeIcons = assignOffsetsAndCompositeIcons(grouped);

		for (const features of Object.values(grouped)) {
			for (const feature of features) {
				const coords = (feature.geometry as GeoJSON.LineString).coordinates;
				feature.properties = {
					...feature.properties,
					distance: calculateLineDistance(coords as [number, number][]),
				};
			}
		}

		const result: Record<number, GeoJSON.FeatureCollection> = {};
		for (const [num, features] of Object.entries(grouped)) {
			result[Number(num)] = { type: 'FeatureCollection', features };
		}
		return { grouped: result, compositeIcons };
	}

	const overpassQuery = createQuery(() => ({
		queryKey: ['overpass-vl'],
		queryFn: async () => {
			const response = await fetch('/api/overpass-vl');
			if (!response.ok) {
				throw new Error('Failed to fetch Overpass VL data');
			}
			const data = await response.json();
			return overpassToGrouped(data);
		},
		staleTime: Infinity,
		enabled: anyOsmVLVisible,
		refetchOnWindowFocus: false,
		meta: { loadingLabel: 'Voies Lyonnaises (OSM)' },
	}));

	const filteredByLine = $derived.by(() => {
		const data = overpassQuery.data;
		if (!data) return undefined;
		const out: Record<number, GeoJSON.FeatureCollection> = {};
		for (const [num, fc] of Object.entries(data.grouped)) {
			out[Number(num)] = boundary ? filterFeaturesInsideBoundary(fc, boundary) : fc;
		}
		return out;
	});
</script>

{#each Array.from({ length: 12 }, (_, index) => index + 1) as lineNumber}
	{@const layerId = `osm-vl-${lineNumber}`}
	{@const lineIndex = lineNumber - 1}
	{@const vlVisible = isLayerVisible(`vl-${lineNumber}`)}
	{@const lineData = filteredByLine?.[lineNumber] ?? EMPTY_FEATURE_COLLECTION}
	<GeoJSONSource id={`osm-vl-${lineNumber}-source`} data={lineData}>
		<LineLayer
			id={`osm-vl-${lineNumber}-line-contour`}
			filter={['==', ['get', 'showShield'], 1]}
			layout={{
				'line-join': 'round',
				'line-cap': 'round',
				visibility: isLayerVisible(layerId) ? 'visible' : 'none',
			}}
			paint={{
				'line-color': '#ffffff',
				'line-width': ['get', 'contourWidth'],
				'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.3, 14, 0.9],
			}}
		/>
		<LineLayer
			id={`osm-vl-${lineNumber}-line-casing`}
			layout={{
				'line-join': 'round',
				'line-cap': 'round',
				visibility: isLayerVisible(layerId) ? 'visible' : 'none',
			}}
			paint={{
				'line-color': '#333333',
				'line-width': 5,
				'line-opacity': 0.4,
				'line-offset': ['get', 'offset'],
			}}
		/>
		<LineLayer
			id={`osm-vl-${lineNumber}-line`}
			layout={{
				'line-join': 'round',
				'line-cap': 'round',
				visibility: isLayerVisible(layerId) ? 'visible' : 'none',
			}}
			paint={{
				'line-color': vlColors[lineIndex],
				'line-width': 3.5,
				'line-opacity': 0.9,
				'line-dasharray': vlVisible ? [4, 2] : [1, 0],
				'line-offset': ['get', 'offset'],
			}}
		/>
		<LineLayer
			id={`osm-vl-${lineNumber}-line-hitarea`}
			layout={{
				'line-join': 'round',
				'line-cap': 'round',
				visibility: isLayerVisible(layerId) ? 'visible' : 'none',
			}}
			paint={{
				'line-color': 'transparent',
				'line-width': 20,
				'line-opacity': 0,
				'line-offset': ['get', 'offset'],
			}}
		/>
	</GeoJSONSource>
{/each}
