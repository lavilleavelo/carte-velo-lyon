<script lang="ts">
	import { GeoJSONSource, SymbolLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import { processVoiesLyonnaisesData, loadShieldIcons } from '$lib/utils/mapUtils';
	import {
		EMPTY_FEATURE_COLLECTION,
		filterFeaturesByYear,
		filterFeaturesInsideBoundary,
	} from '$lib/utils/geoFilter';
	import type { Feature, FeatureCollection } from 'geojson';
	import type maplibregl from 'maplibre-gl';

	let {
		isLayerVisible,
		map,
		boundary,
		yearRange,
	}: {
		isLayerVisible: (id: string) => boolean;
		map: maplibregl.Map | undefined;
		boundary?: FeatureCollection;
		yearRange?: [number, number];
	} = $props();

	function getVlYear(f: Feature): number | null {
		const props = f.properties as Record<string, unknown> | null;
		if (props?.status !== 'done') {
			return null;
		}
		const doneAt = props?.doneAt;
		if (typeof doneAt !== 'string') {
			return null;
		}

		const match = doneAt.match(/(\d{4})/);
		return match ? Number(match[1]) : null;
	}

	const vlQuery = createQuery(() => ({
		queryKey: ['voies-lyonnaises'],
		queryFn: async () => {
			const response = await fetch('/api/voies-lyonnaises');
			if (!response.ok) {
				throw new Error('Failed to fetch voies lyonnaises data');
			}
			const data = await response.json();
			return processVoiesLyonnaisesData(data);
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		meta: { loadingLabel: 'Voies Lyonnaises' },
	}));

	$effect(() => {
		if (map && vlQuery.data) {
			loadShieldIcons(map, vlQuery.data.allFeatures);
		}
	});

	const groupedLineData = $derived.by(() => {
		if (!vlQuery.data) {
			return undefined;
		}

		if (!boundary && !yearRange) {
			return vlQuery.data.grouped;
		}

		const out: Record<number, FeatureCollection> = {};
		for (const [key, fc] of Object.entries(vlQuery.data.grouped)) {
			let filtered = fc as FeatureCollection;
			if (boundary) {
				filtered = filterFeaturesInsideBoundary(filtered, boundary);
			}

			if (yearRange) {
				filtered = filterFeaturesByYear(filtered, getVlYear, yearRange);
			}

			out[Number(key)] = filtered;
		}

		return out;
	});
</script>

{#each Array.from({ length: 12 }, (_, index) => index + 1).reverse() as lineNumber}
	{@const layerId = `vl-${lineNumber}`}
	{@const shieldData = groupedLineData?.[lineNumber] ?? EMPTY_FEATURE_COLLECTION}
	<GeoJSONSource id={`vl-${lineNumber}-shield-source`} data={shieldData}>
		{@const osmVlVisible = isLayerVisible(`osm-vl-${lineNumber}`)}
		<SymbolLayer
			id={`vl-${lineNumber}-shield-low`}
			maxzoom={14}
			filter={['all', ['==', ['get', 'status'], 'done'], ['>=', ['get', 'distance'], 900]]}
			layout={{
				'icon-image': [
					'coalesce',
					['get', 'compositeIconName'],
					['concat', 'line-shield-', lineNumber],
				],
				'icon-size': 0.3,
				'symbol-spacing': 1000000,
				'symbol-placement': 'line-center',
				'icon-rotation-alignment': 'viewport',
				visibility: isLayerVisible(layerId) && !osmVlVisible ? 'visible' : 'none',
			}}
		/>

		<SymbolLayer
			id={`vl-${lineNumber}-shield-med`}
			minzoom={13}
			maxzoom={17}
			filter={['all', ['==', ['get', 'status'], 'done'], ['>=', ['get', 'distance'], 300]]}
			layout={{
				'icon-image': [
					'coalesce',
					['get', 'compositeIconName'],
					['concat', 'line-shield-', lineNumber],
				],
				'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.3, 15, 0.3, 17, 0.4],
				'symbol-spacing': 1000000,
				'symbol-placement': 'line-center',
				visibility: isLayerVisible(layerId) && !osmVlVisible ? 'visible' : 'none',
			}}
		/>

		<SymbolLayer
			id={`vl-${lineNumber}-shield-high`}
			minzoom={17}
			filter={['==', ['get', 'status'], 'done']}
			layout={{
				'icon-image': [
					'coalesce',
					['get', 'compositeIconName'],
					['concat', 'line-shield-', lineNumber],
				],
				'icon-size': 0.4,
				'symbol-spacing': 1000000,
				'symbol-placement': 'line-center',
				visibility: isLayerVisible(layerId) && !osmVlVisible ? 'visible' : 'none',
			}}
		/>
	</GeoJSONSource>
{/each}
