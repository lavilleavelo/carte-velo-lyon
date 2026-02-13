<script lang="ts">
	import { GeoJSONSource, LineLayer } from 'svelte-maplibre-gl';
	import communesLimitUrl from '$lib/data/communes_limit_arrondissements.json?url';
	import arrondissementsLyonUrl from '$lib/data/metropole-de-lyon_adr_voie_lieu.adrarrond.json?url';

	let { isLayerVisible, handleMouseEnter, handleMouseLeave } = $props();
</script>

<GeoJSONSource id="arrondissements" data={arrondissementsLyonUrl} maxzoom={13}>
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

<GeoJSONSource maxzoom={13} data={communesLimitUrl} id="communes-source">
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
	<LineLayer
		id="communes-layer-hitarea"
		layout={{
			visibility: isLayerVisible('communes') ? 'visible' : 'none',
		}}
		paint={{
			'line-color': 'transparent',
			'line-width': 20,
			'line-opacity': 0,
		}}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	/>
</GeoJSONSource>
