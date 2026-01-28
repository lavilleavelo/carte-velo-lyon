<script lang="ts">
	import { GeoJSONSource, LineLayer } from 'svelte-maplibre-gl';
	import { matchTypeColorReseau, matchTypeWidth } from '$lib/utils.ts';

	let { isLayerVisible, handleMouseEnter, handleMouseLeave, data } = $props();
</script>

<GeoJSONSource maxzoom={14} data={data.voirieData} id="cycleways-source">
	<LineLayer
		id="cycleways-layer"
		paint={{
			'line-color': matchTypeColorReseau,
			'line-width': matchTypeWidth,
			'line-opacity': 0.8,
		}}
		layout={{
			visibility: isLayerVisible('cycleways') ? 'visible' : 'none',
		}}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	/>
</GeoJSONSource>
