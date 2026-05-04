<script lang="ts">
	import { GeoJSONSource, LineLayer } from 'svelte-maplibre-gl';
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

	const anyVisible = $derived(enabledSlugs.length > 0);

	const colorMatch = $derived(itinerairesColorMatch(itineraires));
	const enabledFilter = $derived(itinerairesEnabledFilter(enabledSlugs));

	const dataUrl = `/api/fiches/${ITINERAIRES_FICHE_TYPE}.geojson`;
</script>

{#if anyVisible}
	<GeoJSONSource id="itineraires-source" data={dataUrl}>
		<LineLayer
			id="itineraires-line"
			paint={{
				'line-color': colorMatch as any,
				'line-width': 8,
				'line-opacity': 0.45,
			}}
			layout={{ 'line-join': 'round', 'line-cap': 'round' }}
			filter={enabledFilter}
		/>

		{#each itineraires as itineraire (itineraire.slug)}
			{@const visible = isLayerVisible(itineraireLayerId(itineraire.slug))}
			<LineLayer
				id="itineraire-{itineraire.slug}-hitarea"
				paint={{
					'line-color': 'transparent',
					'line-width': 18,
					'line-opacity': 0,
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
{/if}
