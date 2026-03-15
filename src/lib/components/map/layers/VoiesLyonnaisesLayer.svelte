<script lang="ts">
	import { GeoJSONSource, LineLayer, SymbolLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import { processVoiesLyonnaisesData, vlColors, loadShieldIcons } from '$lib/utils/mapUtils';
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
	}: {
		isLayerVisible: (id: string) => boolean;
		map: maplibregl.Map | undefined;
		projectVLStatuses?: string[];
		projectVLSubLayers?: readonly ProjectVLSubLayer[];
	} = $props();

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
		const expression: any[] = ['match', ['get', 'status']];
		projectVLSubLayers.forEach((layer) => {
			layer.statuses.forEach((status) => {
				expression.push(status, layer.customStyle.color);
			});
		});
		expression.push('#000000');
		return expression as maplibregl.DataDrivenPropertyValueSpecification<string>;
	});

	const dashArrayExpression = $derived.by(() => {
		const expression: any[] = ['match', ['get', 'status']];
		projectVLSubLayers.forEach((layer) => {
			layer.statuses.forEach((status) => {
				expression.push(status, ['literal', layer.customStyle.dashArray]);
			});
		});
		expression.push(['literal', [1, 0]]);
		return expression as maplibregl.DataDrivenPropertyValueSpecification<number[]>;
	});
</script>

{#each Array.from({ length: 12 }, (_, index) => index + 1).reverse() as lineNumber}
	{@const layerId = `vl-${lineNumber}`}
	{@const lineIndex = lineNumber - 1}
	{#if vlQuery.data?.grouped[lineNumber]}
		<GeoJSONSource id={`vl-${lineNumber}-source`} data={vlQuery.data.grouped[lineNumber]}>
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
					'line-opacity': 1,
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
					'line-color': '#000000',
					'line-width': 3,
					'line-opacity': 1,
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

			{@const osmVlVisible = isLayerVisible(`osm-vl-${lineNumber}`)}
			<SymbolLayer
				id={`vl-${lineNumber}-labels-low`}
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
				id={`vl-${lineNumber}-labels-med`}
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
				id={`vl-${lineNumber}-labels-high`}
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
	{/if}
{/each}

{#each Array.from({ length: 12 }, (_, index) => index + 1).reverse() as lineNumber}
	{@const layerId = 'project-vl'}
	{#if vlQuery.data?.grouped[lineNumber]}
		<GeoJSONSource id={`vl-project-${lineNumber}-source`} data={vlQuery.data.grouped[lineNumber]}>
			<LineLayer
				id={`vl-project-${lineNumber}-casing`}
				paint={{
					'line-color': '#ffffff',
					'line-width': 4,
					'line-opacity': 0.8,
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
					'line-opacity': 0.9,
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
	{/if}
{/each}
