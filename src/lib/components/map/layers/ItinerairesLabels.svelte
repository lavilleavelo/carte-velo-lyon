<script lang="ts">
	import { GeoJSONSource, SymbolLayer } from 'svelte-maplibre-gl';
	import {
		getItineraires,
		itineraireLayerId,
		ITINERAIRES_FICHE_TYPE,
	} from '$lib/config/itineraires';
	import { itinerairesColorMatch, itinerairesEnabledFilter } from './itinerairesShared';

	let {
		isLayerVisible,
	}: {
		isLayerVisible: (id: string) => boolean;
	} = $props();

	const itineraires = getItineraires().filter((i) => i.hasGeometry);

	const enabledSlugs = $derived(
		itineraires.filter((i) => isLayerVisible(itineraireLayerId(i.slug))).map((i) => i.slug),
	);

	const colorMatch = $derived(itinerairesColorMatch(itineraires));
	const enabledFilter = $derived(itinerairesEnabledFilter(enabledSlugs));

	const dataUrl = `/api/fiches/${ITINERAIRES_FICHE_TYPE}.geojson`;
</script>

<GeoJSONSource id="itineraires-labels-source" data={dataUrl}>
	<SymbolLayer
		id="itineraires-labels"
		minzoom={9}
		layout={{
			'text-field': ['get', 'title'] as any,
			'symbol-placement': 'line',
			'symbol-spacing': 350,
			'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
			'text-size': 12,
			'text-max-angle': 30,
			'text-keep-upright': true,
		}}
		paint={{
			'text-color': colorMatch as any,
			'text-halo-color': '#ffffff',
			'text-halo-width': 2.5,
		}}
		filter={enabledFilter}
	/>
</GeoJSONSource>
