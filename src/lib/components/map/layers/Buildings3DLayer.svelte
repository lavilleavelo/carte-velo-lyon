<script lang="ts">
	import { FillExtrusionLayer } from 'svelte-maplibre-gl';

	let {
		isLayerVisible,
	}: {
		isLayerVisible: (id: string) => boolean;
	} = $props();
</script>

<FillExtrusionLayer
	id="batiments-3d"
	source="osm-vector"
	source-layer="building"
	minzoom={14}
	layout={{
		visibility: isLayerVisible('batiments-3d') ? 'visible' : 'none',
	}}
	paint={{
		'fill-extrusion-color': '#d1d5db',
		'fill-extrusion-height': [
			'interpolate',
			['linear'],
			['zoom'],
			14,
			0,
			15,
			['coalesce', ['get', 'render_height'], 0],
		],
		'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
		'fill-extrusion-opacity': 0.6,
	}}
/>
