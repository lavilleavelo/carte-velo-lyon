<script lang="ts">
	import { GeoJSONSource, LineLayer, SymbolLayer } from 'svelte-maplibre-gl';

	let { isLayerVisible, voirieData } = $props();

	const COLOR = '#166534';

	const isBidir = ['==', ['get', 'senscirculation'], 'Double'];
	const isPiste = ['==', ['get', 'typeamenagement'], 'Piste Cyclable'];

	const filterPisteBidir: any = ['all', isPiste, isBidir];
	const filterPisteUnidir: any = ['all', isPiste, ['!', isBidir]];
	const filterVoieVerte: any = ['==', ['get', 'typeamenagement'], 'Voie verte'];
	const filterBande: any = ['==', ['get', 'typeamenagement'], 'Bande Cyclable'];
	const filterBusVelo: any = [
		'in',
		['get', 'typeamenagement'],
		['literal', ['Couloir bus vélo élargi', 'Couloir bus vélo non élargi']],
	];
	const filterDsc: any = ['==', ['get', 'typeamenagement'], 'Double sens cyclable'];

	const visibility = $derived(isLayerVisible('cycleways') ? 'visible' : 'none');
</script>

<GeoJSONSource
	maxzoom={13}
	data={voirieData ?? { type: 'FeatureCollection', features: [] }}
	id="cycleways-source"
>
	<LineLayer
		id="cw-piste-bidir"
		filter={filterPisteBidir}
		paint={{ 'line-color': COLOR, 'line-width': 4, 'line-opacity': 0.9 }}
		layout={{ 'line-cap': 'round', 'line-join': 'round', visibility }}
	/>

	<LineLayer
		id="cw-piste-unidir"
		filter={filterPisteUnidir}
		paint={{ 'line-color': COLOR, 'line-width': 2, 'line-opacity': 0.9 }}
		layout={{ 'line-cap': 'round', 'line-join': 'round', visibility }}
	/>

	<LineLayer
		id="cw-voie-verte"
		filter={filterVoieVerte}
		paint={{
			'line-color': COLOR,
			'line-width': 1.2,
			'line-gap-width': 2,
			'line-opacity': 0.9,
		}}
		layout={{ visibility }}
	/>

	<LineLayer
		id="cw-bande"
		filter={filterBande}
		paint={{
			'line-color': COLOR,
			'line-width': 3,
			'line-opacity': 0.9,
			'line-dasharray': [1.5, 1],
		}}
		layout={{ visibility }}
	/>

	<LineLayer
		id="cw-bus-velo"
		filter={filterBusVelo}
		paint={{
			'line-color': COLOR,
			'line-width': 2.5,
			'line-opacity': 0.9,
			'line-dasharray': [0.2, 1.6],
		}}
		layout={{ 'line-cap': 'round', visibility }}
	/>

	<LineLayer
		id="cw-dsc-base"
		filter={filterDsc}
		paint={{ 'line-color': COLOR, 'line-width': 1.5, 'line-opacity': 0.5 }}
		layout={{ visibility }}
	/>

	<SymbolLayer
		id="cw-dsc-arrows"
		filter={filterDsc}
		layout={{
			'symbol-placement': 'line',
			'symbol-spacing': 40,
			'text-field': '→',
			'text-size': 16,
			'text-keep-upright': false,
			'text-rotation-alignment': 'map',
			'text-pitch-alignment': 'map',
			'text-allow-overlap': true,
			'text-ignore-placement': true,
			visibility,
		}}
		paint={{ 'text-color': COLOR, 'text-halo-color': '#ffffff', 'text-halo-width': 1 }}
	/>

	<LineLayer
		id="cycleways-layer-hitarea"
		paint={{
			'line-color': 'transparent',
			'line-width': 20,
			'line-opacity': 0,
		}}
		layout={{ visibility }}
	/>
</GeoJSONSource>
