<script lang="ts">
	import { GeoJSONSource, SymbolLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		vlColors,
		loadShieldIcons,
		createCompositeLineShieldIcon,
		calculateLineDistance,
	} from '$lib/utils/mapUtils';
	import type { GeoJSON, FeatureCollection } from 'geojson';
	import type maplibregl from 'maplibre-gl';
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

	$effect(() => {
		if (map && overpassQuery.data) {
			const { grouped, compositeIcons } = overpassQuery.data;
			const allFeatures = Object.values(grouped).flatMap((fc) => fc.features);
			loadShieldIcons(map, allFeatures);

			compositeIcons.forEach((combo) => {
				const iconName = `line-shield-${combo}`;
				if (map!.hasImage(iconName)) return;
				const lineNumbers = combo.split('-').map(Number);
				const colors = lineNumbers.map((line) => vlColors[line - 1]);
				const canvas = createCompositeLineShieldIcon(lineNumbers, colors);
				const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
				if (imageData) {
					map!.addImage(iconName, imageData);
				}
			});
		}
	});

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
	{@const shieldVisibility = isLayerVisible(layerId) ? 'visible' : 'none'}
	{@const shieldData = filteredByLine?.[lineNumber] ?? EMPTY_FEATURE_COLLECTION}
	<GeoJSONSource id={`osm-vl-${lineNumber}-shield-source`} data={shieldData}>
		<SymbolLayer
			id={`osm-vl-${lineNumber}-shield-low`}
			maxzoom={14}
			filter={['all', ['==', ['get', 'showShield'], 1], ['>=', ['get', 'distance'], 900]]}
			layout={{
				'icon-image': ['coalesce', ['get', 'compositeIconName'], `line-shield-${lineNumber}`],
				'icon-size': 0.3,
				'symbol-spacing': 1000000,
				'symbol-placement': 'line-center',
				'icon-rotation-alignment': 'viewport',
				visibility: shieldVisibility,
			}}
		/>
		<SymbolLayer
			id={`osm-vl-${lineNumber}-shield-med`}
			minzoom={13}
			maxzoom={17}
			filter={['all', ['==', ['get', 'showShield'], 1], ['>=', ['get', 'distance'], 300]]}
			layout={{
				'icon-image': ['coalesce', ['get', 'compositeIconName'], `line-shield-${lineNumber}`],
				'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.3, 15, 0.3, 17, 0.4],
				'symbol-spacing': 1000000,
				'symbol-placement': 'line-center',
				'icon-rotation-alignment': 'viewport',
				visibility: shieldVisibility,
			}}
		/>
		<SymbolLayer
			id={`osm-vl-${lineNumber}-shield-high`}
			minzoom={17}
			filter={['==', ['get', 'showShield'], 1]}
			layout={{
				'icon-image': ['coalesce', ['get', 'compositeIconName'], `line-shield-${lineNumber}`],
				'icon-size': 0.4,
				'symbol-spacing': 1000000,
				'symbol-placement': 'line-center',
				'icon-rotation-alignment': 'viewport',
				visibility: shieldVisibility,
			}}
		/>
	</GeoJSONSource>
{/each}
