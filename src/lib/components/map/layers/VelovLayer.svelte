<script lang="ts">
	import { GeoJSONSource, SymbolLayer, ImageLoader } from 'svelte-maplibre-gl';
	import velovDataUrl from '$lib/data/velov-data-grand-lyon.json?url';

	let { isLayerVisible, handleMouseEnter, handleMouseLeave } = $props();
</script>

<GeoJSONSource maxzoom={14} id="velov-stations-source" data={velovDataUrl}>
	<ImageLoader images={{ velov: '/velov-station.png' }}>
		<SymbolLayer
			id="velov-stations-layer"
			layout={{
				visibility: isLayerVisible('velov') ? 'visible' : 'none',
				'icon-image': 'velov',
				'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.2, 14, 0.7, 18, 1, 22, 1.1],
				'icon-allow-overlap': true,
				'icon-ignore-placement': true,
			}}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
		/>
	</ImageLoader>
</GeoJSONSource>
