<script lang="ts">
	import { GeoJSONSource, LineLayer } from 'svelte-maplibre-gl';
	import {
		getItineraires,
		itineraireLayerId,
		ITINERAIRES_FICHE_TYPE,
	} from '$lib/config/itineraires';
	import {
		itinerairesColorMatch,
		itinerairesEnabledFilter,
		itinerairesOffsetMatch,
	} from './itinerairesShared';

	let {
		isLayerVisible,
		highlightedSlugs = [],
		beforeId,
	}: {
		isLayerVisible: (id: string) => boolean;
		highlightedSlugs?: readonly string[];
		beforeId?: string;
	} = $props();

	const itineraires = getItineraires().filter((i) => i.hasGeometry);

	const visibleItineraires = $derived(
		itineraires.filter((i) => isLayerVisible(itineraireLayerId(i.slug))),
	);
	const enabledSlugs = $derived(visibleItineraires.map((i) => i.slug));

	const colorMatch = $derived(itinerairesColorMatch(itineraires));
	const offsetMatch = $derived(itinerairesOffsetMatch(visibleItineraires));
	const enabledFilter = $derived(itinerairesEnabledFilter(enabledSlugs));
	const highlightFilter = $derived(
		highlightedSlugs.length > 0
			? (['in', ['get', 'slug'], ['literal', highlightedSlugs]] as any)
			: (['==', ['get', 'slug'], '__none__'] as any),
	);

	const dataUrl = `/api/fiches/${ITINERAIRES_FICHE_TYPE}.geojson`;
</script>

<GeoJSONSource id="itineraires-source" data={dataUrl}>
	<LineLayer
		id="itineraires-line-casing"
		{beforeId}
		paint={{
			'line-color': '#ffffff',
			'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 7, 15, 12],
			'line-offset': offsetMatch as any,
		}}
		layout={{ 'line-join': 'round', 'line-cap': 'round' }}
		filter={enabledFilter}
	/>
	<LineLayer
		id="itineraires-line"
		{beforeId}
		paint={{
			'line-color': colorMatch as any,
			'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 12, 4, 15, 8],
			'line-opacity': 0.45,
			'line-offset': offsetMatch as any,
		}}
		layout={{ 'line-join': 'round', 'line-cap': 'round' }}
		filter={enabledFilter}
	/>
	<LineLayer
		id="itineraires-line-highlight"
		{beforeId}
		paint={{
			'line-color': '#facc15',
			'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 1.5, 15, 2],
			'line-gap-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 7, 15, 12],
			'line-offset': offsetMatch as any,
		}}
		layout={{ 'line-join': 'round', 'line-cap': 'round' }}
		filter={highlightFilter}
	/>

	{#each itineraires as itineraire (itineraire.slug)}
		{@const visible = isLayerVisible(itineraireLayerId(itineraire.slug))}
		<LineLayer
			id="itineraire-{itineraire.slug}-hitarea"
			{beforeId}
			paint={{
				'line-color': 'transparent',
				'line-width': 18,
				'line-opacity': 0,
				'line-offset': offsetMatch as any,
			}}
			layout={{
				visibility: visible ? 'visible' : 'none',
				'line-join': 'round',
				'line-cap': 'round',
			}}
			filter={['==', ['get', 'slug'], itineraire.slug] as any}
		/>
	{/each}
</GeoJSONSource>
