<script lang="ts">
	import { GeoJSONSource, LineLayer, SymbolLayer } from 'svelte-maplibre-gl';
	import { EMPTY_FEATURE_COLLECTION } from '$lib/utils/geoFilter';
	import {
		BANDE_DASHARRAY,
		BUS_VELO_DASHARRAY,
		BUS_VELO_LINE_CAP,
		DSC_ARROW_SYMBOL_SPACING,
		DSC_ARROW_TEXT_SIZE,
		NORMAL_LINE_OPACITY,
		PISTE_BIDIR_LINE_WIDTH,
		PISTE_UNIDIR_LINE_WIDTH,
		VOIE_VERTE_DASHARRAY,
		VOIE_VERTE_LINE_CAP,
		VOIE_VERTE_LINE_WIDTH,
	} from './cyclewayStyles';

	let {
		isLayerVisible,
		voirieData,
		hoveredFeatureId = null,
		selectedFeatureIds = [],
	}: {
		isLayerVisible: (id: string) => boolean;
		voirieData: any;
		hoveredFeatureId?: string | number | null;
		selectedFeatureIds?: readonly (string | number)[];
	} = $props();

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

	const HOVER_COLOR = '#facc15';
	const SELECTED_COLOR = '#f97316';
	const hoverFilter: any = $derived(
		hoveredFeatureId == null ? ['==', ['id'], -1] : ['==', ['id'], hoveredFeatureId],
	);
	const selectedFilter: any = $derived(
		selectedFeatureIds.length === 0
			? ['==', ['id'], -1]
			: ['in', ['id'], ['literal', [...selectedFeatureIds]]],
	);
</script>

<GeoJSONSource
	maxzoom={13}
	data={voirieData ?? EMPTY_FEATURE_COLLECTION}
	id="cycleways-source"
	generateId
>
	<LineLayer
		id="cw-selected"
		filter={selectedFilter}
		minzoom={14}
		paint={{
			'line-color': SELECTED_COLOR,
			'line-width': ['interpolate', ['linear'], ['zoom'], 14, 6, 17, 11],
			'line-opacity': 0.5,
		}}
		layout={{ 'line-cap': 'round', 'line-join': 'round', visibility }}
	/>

	<LineLayer
		id="cw-hover"
		filter={hoverFilter}
		minzoom={14}
		paint={{
			'line-color': HOVER_COLOR,
			'line-width': ['interpolate', ['linear'], ['zoom'], 14, 5, 17, 9],
			'line-opacity': 0.85,
		}}
		layout={{ 'line-cap': 'round', 'line-join': 'round', visibility }}
	/>

	<LineLayer
		id="cw-piste-bidir"
		filter={filterPisteBidir}
		paint={{
			'line-color': COLOR,
			'line-width': PISTE_BIDIR_LINE_WIDTH,
			'line-opacity': NORMAL_LINE_OPACITY,
		}}
		layout={{ 'line-cap': 'round', 'line-join': 'round', visibility }}
	/>

	<LineLayer
		id="cw-piste-unidir"
		filter={filterPisteUnidir}
		paint={{
			'line-color': COLOR,
			'line-width': PISTE_UNIDIR_LINE_WIDTH,
			'line-opacity': NORMAL_LINE_OPACITY,
		}}
		layout={{ 'line-cap': 'round', 'line-join': 'round', visibility }}
	/>

	<LineLayer
		id="cw-voie-verte"
		filter={filterVoieVerte}
		paint={{
			'line-color': COLOR,
			'line-width': VOIE_VERTE_LINE_WIDTH,
			'line-opacity': NORMAL_LINE_OPACITY,
			'line-dasharray': VOIE_VERTE_DASHARRAY,
		}}
		layout={{ 'line-cap': VOIE_VERTE_LINE_CAP, visibility }}
	/>

	<LineLayer
		id="cw-bande"
		filter={filterBande}
		paint={{
			'line-color': COLOR,
			'line-width': 3,
			'line-opacity': NORMAL_LINE_OPACITY,
			'line-dasharray': BANDE_DASHARRAY,
		}}
		layout={{ visibility }}
	/>

	<LineLayer
		id="cw-bus-velo"
		filter={filterBusVelo}
		paint={{
			'line-color': COLOR,
			'line-width': 2.5,
			'line-opacity': NORMAL_LINE_OPACITY,
			'line-dasharray': BUS_VELO_DASHARRAY,
		}}
		layout={{ 'line-cap': BUS_VELO_LINE_CAP, visibility }}
	/>

	<SymbolLayer
		id="cw-dsc-arrows"
		filter={filterDsc}
		layout={{
			'symbol-placement': 'line',
			'symbol-spacing': DSC_ARROW_SYMBOL_SPACING,
			'text-field': '↔',
			'text-size': DSC_ARROW_TEXT_SIZE,
			'text-keep-upright': false,
			'text-rotation-alignment': 'map',
			'text-pitch-alignment': 'map',
			'text-allow-overlap': true,
			'text-ignore-placement': true,
			visibility,
		}}
		paint={{ 'text-color': COLOR, 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }}
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
