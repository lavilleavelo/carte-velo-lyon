<script lang="ts">
	import { GeoJSONSource, LineLayer } from 'svelte-maplibre-gl';

	let { isLayerVisible, data } = $props();
</script>

<GeoJSONSource id="arrondissements" data={data.arrondissementsLyon} maxzoom={14}>
	<LineLayer
		id="arrondissements-line"
		source="arrondissements"
		layout={{
			visibility: isLayerVisible('communes') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': '#2563eb',
			'line-width': 2,
			'line-opacity': 0.3,
		}}
	/>
</GeoJSONSource>

<GeoJSONSource maxzoom={14} data={data.communesLimit} id="communes-source">
	<LineLayer
		id="communes-layer"
		layout={{
			visibility: isLayerVisible('communes') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': '#6b7280',
			'line-width': 2,
			'line-opacity': 0.5,
		}}
	/>
</GeoJSONSource>
