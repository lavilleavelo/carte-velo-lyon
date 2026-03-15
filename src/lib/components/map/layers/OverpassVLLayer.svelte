<script lang="ts">
	import { GeoJSONSource, LineLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import { vlColors } from '$lib/utils/mapUtils';
	import type { GeoJSON } from 'geojson';

	let {
		isLayerVisible,
	}: {
		isLayerVisible: (id: string) => boolean;
	} = $props();

	const anyOsmVLVisible = $derived(
		Array.from({ length: 12 }, (_, i) => `osm-vl-${i + 1}`).some((id) => isLayerVisible(id)),
	);

	function extractLineNumber(ref: string | undefined): number | null {
		if (!ref) return null;
		const match = ref.match(/^VL(\d+)$/);
		return match ? parseInt(match[1], 10) : null;
	}

	function overpassToGrouped(data: any): Record<number, GeoJSON.FeatureCollection> {
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

		const result: Record<number, GeoJSON.FeatureCollection> = {};
		for (const [num, features] of Object.entries(grouped)) {
			result[Number(num)] = { type: 'FeatureCollection', features };
		}
		return result;
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
	}));
</script>

{#if overpassQuery.data}
	{#each Array.from({ length: 12 }, (_, index) => index + 1) as lineNumber}
		{@const layerId = `osm-vl-${lineNumber}`}
		{@const lineIndex = lineNumber - 1}
		{#if overpassQuery.data[lineNumber]}
			<GeoJSONSource id={`osm-vl-${lineNumber}-source`} data={overpassQuery.data[lineNumber]}>
				<LineLayer
					id={`osm-vl-${lineNumber}-line-contour`}
					layout={{
						'line-join': 'round',
						'line-cap': 'round',
						visibility: isLayerVisible(layerId) ? 'visible' : 'none',
					}}
					paint={{
						'line-color': '#ffffff',
						'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 14, 6],
						'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.3, 14, 0.8],
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
						'line-width': 2,
						'line-opacity': 0.9,
						'line-dasharray': [4, 2],
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
					}}
				/>
			</GeoJSONSource>
		{/if}
	{/each}
{/if}
