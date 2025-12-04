<script lang="ts">
	import type { PageData } from './$types';
	import {
		MapLibre,
		GeoJSONSource,
		LineLayer,
		FillLayer,
		FeatureState,
		Popup,
		AttributionControl,
		FullScreenControl
	} from 'svelte-maplibre-gl';
	import maplibregl from 'maplibre-gl';
	import voiesCyclables from '$lib/data/metropole-de-lyon_pvo_patrimoine_voirie.pvoamenagementcyclable.json';
	import * as Table from '$lib/components/ui/table/index.js';
	import { goto, preloadData } from '$app/navigation';

	let { data }: { data: PageData } = $props();
</script>

<div
	class="rounded-lg bg-brand-navy p-6 text-white shadow-lg"
	style="view-transition-name: page-header;"
>
	<h1 class="text-2xl opacity-90">Carte des aménagements cyclables dans la Métropole de Lyon</h1>
</div>

<div style="view-transition-name: main-map;">
	<div class="mt-10 mb-8 text-center text-2xl text-gray-600 hover:text-gray-800">
		<a href="/carte">Voir la carte</a>
	</div>
</div>
