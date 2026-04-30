<script lang="ts">
	import { GeoJSONSource, LineLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import { processVoiesLyonnaisesData, vlColors, loadShieldIcons } from '$lib/utils/mapUtils';
	import {
		EMPTY_FEATURE_COLLECTION,
		filterFeaturesByYear,
		filterFeaturesInsideBoundary,
	} from '$lib/utils/geoFilter';
	import type { Feature, FeatureCollection } from 'geojson';
	import type maplibregl from 'maplibre-gl';

	type ProjectVLSubLayer = {
		id: string;
		label: string;
		statuses: readonly string[];
		customStyle: {
			color: string;
			dashArray: readonly number[];
		};
	};

	let {
		isLayerVisible,
		map,
		projectVLStatuses = ['wip', 'planned', 'variante'],
		projectVLSubLayers = [],
		boundary,
		yearRange,
		opacityScale = 1,
	}: {
		isLayerVisible: (id: string) => boolean;
		map: maplibregl.Map | undefined;
		projectVLStatuses?: string[];
		projectVLSubLayers?: readonly ProjectVLSubLayer[];
		boundary?: FeatureCollection;
		yearRange?: [number, number];
		opacityScale?: number;
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

	const activeProjectStatuses = $derived.by(() => {
		return projectVLSubLayers
			.filter((l) => projectVLStatuses.includes(l.id))
			.flatMap((l) => l.statuses);
	});

	const colorExpression = $derived.by(() => {
		const cases: any[] = [];
		projectVLSubLayers.forEach((layer) => {
			layer.statuses.forEach((status) => {
				cases.push(status, layer.customStyle.color);
			});
		});

		if (cases.length === 0) {
			return '#ffffff' as maplibregl.DataDrivenPropertyValueSpecification<string>;
		}

		return [
			'match',
			['get', 'status'],
			...cases,
			'#ffffff',
		] as maplibregl.DataDrivenPropertyValueSpecification<string>;
	});

	const dashArrayExpression = $derived.by(() => {
		const cases: any[] = [];
		projectVLSubLayers.forEach((layer) => {
			layer.statuses.forEach((status) => {
				cases.push(status, ['literal', layer.customStyle.dashArray]);
			});
		});

		if (cases.length === 0) {
			return [1, 0] as maplibregl.DataDrivenPropertyValueSpecification<number[]>;
		}

		return [
			'match',
			['get', 'status'],
			...cases,
			['literal', [1, 0]],
		] as maplibregl.DataDrivenPropertyValueSpecification<number[]>;
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
	{@const lineIndex = lineNumber - 1}
	{@const lineData = groupedLineData?.[lineNumber] ?? EMPTY_FEATURE_COLLECTION}
	<GeoJSONSource id={`vl-${lineNumber}-source`} data={lineData}>
		<LineLayer
			id={`vl-${lineNumber}-line-contour`}
			layout={{
				'line-join': 'round',
				'line-cap': 'round',
				visibility: isLayerVisible(layerId) ? 'visible' : 'none',
			}}
			paint={{
				'line-color': vlColors[lineIndex],
				'line-width': 6,
				'line-opacity': opacityScale,
			}}
			filter={['==', ['get', 'status'], 'done']}
		/>
		<LineLayer
			id={`vl-${lineNumber}-line`}
			layout={{
				'line-join': 'round',
				'line-cap': 'round',
				visibility: isLayerVisible(layerId) ? 'visible' : 'none',
			}}
			paint={{
				'line-color': 'rgb(255 255 255 / 0.5)',
				'line-width': 3,
				'line-opacity': opacityScale,
			}}
			filter={['==', ['get', 'status'], 'done']}
		/>

		<LineLayer
			id={`vl-${lineNumber}-line-hitarea`}
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
			filter={['==', ['get', 'status'], 'done']}
		/>
	</GeoJSONSource>
{/each}

{#each Array.from({ length: 12 }, (_, index) => index + 1).reverse() as lineNumber}
	{@const layerId = 'project-vl'}
	{@const projectData = groupedLineData?.[lineNumber] ?? EMPTY_FEATURE_COLLECTION}
	<GeoJSONSource id={`vl-project-${lineNumber}-source`} data={projectData}>
		<LineLayer
			id={`vl-project-${lineNumber}-casing`}
			paint={{
				'line-color': '#ffffff',
				'line-width': 4,
				'line-opacity': 0.8 * opacityScale,
			}}
			layout={{
				visibility: isLayerVisible(layerId) ? 'visible' : 'none',
				'line-join': 'round',
				'line-cap': 'round',
			}}
			filter={['in', ['get', 'status'], ['literal', activeProjectStatuses]]}
		/>

		<LineLayer
			id={`vl-project-${lineNumber}-line`}
			layout={{
				'line-join': 'round',
				'line-cap': 'round',
				visibility: isLayerVisible(layerId) ? 'visible' : 'none',
			}}
			paint={{
				'line-color': colorExpression,
				'line-width': 3,
				'line-opacity': 0.9 * opacityScale,
				'line-dasharray': dashArrayExpression,
			}}
			filter={['in', ['get', 'status'], ['literal', activeProjectStatuses]]}
		/>

		<LineLayer
			id={`vl-project-${lineNumber}-line-hitarea`}
			paint={{
				'line-color': 'transparent',
				'line-width': 20,
				'line-opacity': 0,
			}}
			layout={{
				visibility: isLayerVisible(layerId) ? 'visible' : 'none',
				'line-join': 'round',
				'line-cap': 'round',
			}}
			filter={['in', ['get', 'status'], ['literal', activeProjectStatuses]]}
		/>
	</GeoJSONSource>
{/each}
