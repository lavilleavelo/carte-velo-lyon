<script lang="ts">
	import { GeoJSONSource, LineLayer, SymbolLayer } from 'svelte-maplibre-gl';
	import { vlColors } from '$lib/utils/mapUtils';

	let { isLayerVisible, handleMouseEnter, handleMouseLeave, processedVLData } = $props();
</script>

{#each Array.from({ length: 12 }, (_, index) => index + 1).reverse() as lineNumber}
	{@const layerId = `vl-${lineNumber}`}
	{@const lineIndex = lineNumber - 1}
	{#if processedVLData.grouped[lineNumber]}
		<GeoJSONSource id={`vl-${lineNumber}-source`} data={processedVLData.grouped[lineNumber]}>
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
				onmouseenter={handleMouseEnter}
				onmouseleave={handleMouseLeave}
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
				onmouseenter={handleMouseEnter}
				onmouseleave={handleMouseLeave}
			/>

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
					visibility: isLayerVisible(layerId) ? 'visible' : 'none',
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
					visibility: isLayerVisible(layerId) ? 'visible' : 'none',
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
					visibility: isLayerVisible(layerId) ? 'visible' : 'none',
				}}
			/>
		</GeoJSONSource>
	{/if}
{/each}
