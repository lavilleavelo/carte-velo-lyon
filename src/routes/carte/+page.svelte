<script lang="ts">
	import { type } from 'arktype';
	import { useSearchParams } from 'runed/kit';
	import {
		MapLibre,
		GeoJSONSource,
		FillLayer,
		LineLayer,
		CircleLayer,
		AttributionControl,
		GeolocateControl,
		NavigationControl,
		Popup,
		SymbolLayer
	} from 'svelte-maplibre-gl';
	import maplibregl from 'maplibre-gl';
	import Filter from '@lucide/svelte/icons/filter';

	import { matchTypeColorReseau, matchTypeWidth } from '$lib/utils.ts';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import Geocoder from '$lib/components/Geocoder.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const mapSearchParamsSchema = type({
		layers: type('string[]').default(() =>
			['communes', 'cycleways', Array.from({ length: 12 }, (_, i) => `vl-${i + 1}`)].flat()
		),
		commune: 'string = ""',
		zoom: 'number = 11',
		center: type('number[]').default(() => [4.835659, 45.764043]),
		showProblematic: 'boolean = true',
		showParking: 'boolean = true',
		showCycleways: 'boolean = true',
		showCommunes: 'boolean = true',
		dimBackground: 'boolean = false'
	});

	const params = useSearchParams(mapSearchParamsSchema, {
		pushHistory: false,
		debounce: 100
	});

	const vlColors = [
		'#60A75B', // Line 1
		'#AC4D35', // Line 2
		'#3B7B64', // Line 3
		'#DC8953', // Line 4
		'#AF7392', // Line 5
		'#396083', // Line 6
		'#75BCAE', // Line 7
		'#7E6D98', // Line 8
		'#EAAB50', // Line 9
		'#9A8A4B', // Line 10
		'#4DADC9', // Line 11
		'#DBABB7' // Line 12
	];

	const availableLayers = [
		{
			id: 'communes',
			label: 'Limites des communes',
			color: '#6b7280',
			category: 'Communes'
		},
		{
			id: 'cycleways',
			label: 'Aménagements cyclables',
			color: '#19181a',
			category: 'Infrastructures Cyclables'
		},
		{
			id: 'parking',
			label: 'Stationnements vélos',
			color: '#0944f3',
			category: 'Infrastructures Cyclables'
		},
		{
			id: 'velov',
			label: 'Stations Velov',
			color: '#fbbf24',
			category: 'Infrastructures Cyclables'
		},
		...Array.from({ length: 12 }, (_, i) => ({
			id: `vl-${i + 1}`,
			label: `VL ${i + 1}`,
			color: vlColors[i],
			category: 'Voies Lyonnaises'
		})),
		{
			category: 'Baromètre Cyclable FUB',
			id: 'problematic-red',
			label: 'Zones prioritaires',
			color: '#ef4444'
		},
		{
			id: 'problematic-green',
			label: "Zones d'amélioration",
			color: '#22c55e',
			category: 'Baromètre Cyclable FUB'
		},
		{
			id: 'parking-demand',
			label: 'Zones de demande de stationnements vélos',
			color: '#0595d3',
			category: 'Baromètre Cyclable FUB'
		}
	] as const;

	const numFormatter = new Intl.NumberFormat('fr-FR', {
		style: 'decimal',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});

	let map: maplibregl.Map | undefined = $state();
	let filtersExpanded = $state(true);
	let cursor: string | undefined = $state();
	let selectedFeature: any = $state(null);
	let hoveredCommune: any = $state(null);
	let hoverLngLat = $state.raw(new maplibregl.LngLat(0, 0));

	const center = $derived.by(() => {
		const [lng, lat] = params.center;
		return { lng, lat };
	});

	const layersByCategory = $derived.by(() => {
		const grouped = new Map<string, Array<(typeof availableLayers)[number]>>();
		availableLayers.forEach((layer) => {
			const category = layer.category;
			if (!grouped.has(category)) {
				grouped.set(category, []);
			}
			grouped.get(category)!.push(layer);
		});
		return grouped;
	});

	function toggleLayer(layerId: string) {
		const currentLayers = [...(params.layers || [])];
		const index = currentLayers.indexOf(layerId);

		if (index >= 0) {
			currentLayers.splice(index, 1);
		} else {
			currentLayers.push(layerId);
		}

		params.layers = currentLayers;
	}

	function isLayerVisible(layerId: string): boolean {
		return (params.layers || []).includes(layerId);
	}

	function handleFeatureClick(e: any, type: string) {
		const features = e.features;
		if (features && features.length > 0) {
			selectedFeature = { ...features[0], type };
		}
	}

	function handleMouseEnter() {
		cursor = 'pointer';
	}

	function handleMouseLeave() {
		cursor = undefined;
	}

	function handleMapMove() {
		if (!map) return;
		const mapCenter = map.getCenter();
		params.center = [Number(mapCenter.lng), Number(mapCenter.lat)];
		params.zoom = map.getZoom();
	}

	function handleGeocoderSelect(coordinates: [number, number], name: string) {
		if (!map) return;
		map.flyTo({
			center: coordinates,
			zoom: 14,
			duration: 1500
		});
	}

	const LYON_BOUNDS: [number, number, number, number] = [4.6, 45.5, 5.1, 46.0];
	const MAP_BOUNDS: [[number, number], [number, number]] = [
		[4.2, 45.4],
		[5.5, 46.1]
	];
</script>

<div
	class="
	 flex
	 h-[calc(100vh-60px)]
	 w-screen flex-col"
	style="position: relative; left: 50%; transform: translateX(-50%); max-width: none; margin-top: -30px"
>
	<div class="relative flex-1">
		<div class="h-full overflow-hidden rounded-lg shadow-lg">
			<div class="absolute top-4 left-4 z-10 flex flex-col gap-4">
				<div class="overflow-hidden rounded-lg bg-white shadow-lg">
					<div class="p-3">
						<Geocoder onSelect={handleGeocoderSelect} bbox={LYON_BOUNDS} />
					</div>
				</div>

				<div class="overflow-hidden rounded-lg bg-white shadow-lg">
					<Collapsible.Root bind:open={filtersExpanded}>
						<Collapsible.Trigger
							class="flex w-full items-center justify-between rounded-none p-4 hover:bg-gray-50"
						>
							<div class="flex items-center gap-2">
								<Filter size={16} />
								<span class="font-semibold">Filtres</span>
								{#if (params.layers || []).length > 0}
									<span class="rounded-full bg-brand-navy px-2 py-0.5 text-xs text-white">
										{(params.layers || []).length} couche{(params.layers || []).length > 1
											? 's'
											: ''}
									</span>
								{/if}
							</div>
							<svg
								class="h-4 w-4 transition-transform duration-200"
								class:rotate-180={filtersExpanded}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						</Collapsible.Trigger>

						<Collapsible.Content class="border-t">
							<div class="max-h-[60vh] overflow-y-auto p-4">
								<div class="flex flex-col gap-4">
									{#each [...layersByCategory.entries()] as [category, layers]}
										<div class="flex flex-col gap-2">
											<h3 class="text-xs font-semibold text-gray-500 uppercase">
												{category}
											</h3>
											<div class="flex flex-col gap-2 pl-1">
												{#each layers as layer}
													<div class="flex items-center gap-2">
														<Checkbox
															id={layer.id}
															checked={isLayerVisible(layer.id)}
															onCheckedChange={() => toggleLayer(layer.id)}
														/>
														<Label for={layer.id} class="flex items-center gap-2 text-sm">
															<span
																class="inline-block h-3 w-3 rounded-full"
																style="background-color: {layer.color}"
															></span>
															{layer.label}
														</Label>
													</div>
												{/each}
											</div>
										</div>
									{/each}
								</div>
							</div></Collapsible.Content
						>
					</Collapsible.Root>
				</div>
			</div>

			{#if selectedFeature}
				<div
					class="absolute bottom-4 left-4 z-10 w-80 max-w-md overflow-hidden rounded-lg bg-white shadow-lg"
				>
					<div class="flex items-center justify-between border-b bg-gray-50 p-3">
						<h3 class="text-sm font-semibold">Informations</h3>
						<button
							onclick={() => (selectedFeature = null)}
							class="rounded-full p-1 transition-colors hover:bg-gray-200"
							aria-label="Fermer"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</div>
					<div class="max-h-[300px] overflow-y-auto p-4">
						<div class="space-y-2 text-sm">
							{#each Object.entries(selectedFeature.properties) as prop}
								{#if prop[0] !== 'scores'}
									<div class="flex flex-col">
										<span class="text-xs font-medium text-gray-500">{prop[0]}</span>
										<span class="text-gray-900">{prop[1]}</span>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<div class="h-[calc(100vh-60px)] transition-all duration-300 ease-in-out">
				<MapLibre
					class="h-[calc(100vh-60px)] w-full"
					style={'https://tiles.openfreemap.org/styles/positron'}
					center={[center.lng, center.lat]}
					zoom={params.zoom}
					maxBounds={MAP_BOUNDS}
					{cursor}
					attributionControl={false}
					onload={(ev: { target: maplibregl.Map }) => {
						map = ev.target;
					}}
					onmoveend={handleMapMove}
				>
					<NavigationControl position="top-right" />
					<GeolocateControl position="top-right" />
					<AttributionControl compact={true} />

					<GeoJSONSource id="arrondissements" data={data.arrondissementsLyon}>
						<LineLayer
							id="arrondissements-line"
							source="arrondissements"
							layout={{
								visibility: isLayerVisible('communes') ? 'visible' : 'none'
							}}
							paint={{
								'line-color': '#2563eb',
								'line-width': 2,
								'line-opacity': 0.3
							}}
						/>
					</GeoJSONSource>

					<GeoJSONSource data={data.communesLimit} id="communes-source">
						<FillLayer
							id="communes-fill"
							layout={{
								visibility: isLayerVisible('communes') ? 'visible' : 'none'
							}}
							paint={{
								'fill-color': '#6b7280',
								'fill-opacity': 0.05
							}}
						/>
						<LineLayer
							id="communes-layer"
							layout={{
								visibility: isLayerVisible('communes') ? 'visible' : 'none'
							}}
							paint={{
								'line-color': '#6b7280',
								'line-width': 2,
								'line-opacity': 0.5
							}}
						/>
						{#if params.dimBackground}
							<SymbolLayer
								id="communes-labels"
								layout={{
									visibility: isLayerVisible('communes') ? 'visible' : 'none',
									'text-field': ['get', 'nom'],
									'text-font': ['systems-ui-bold'],
									'text-size': 14,
									'text-anchor': 'center',
									'text-max-width': 10,
									'text-allow-overlap': false,
									'text-ignore-placement': false
								}}
								paint={{
									'text-color': '#ffffff',
									'text-halo-color': '#000000',
									'text-halo-width': 1.1,
									'text-halo-blur': 0
								}}
							/>
						{/if}
						{#if hoveredCommune && selectedScoreIndicator.property !== null}
							<Popup
								lnglat={hoverLngLat}
								offset={[0, -10]}
								closeButton={false}
								closeOnClick={false}
							>
								<div class="min-w-[150px]">
									<div class="mb-1 text-sm font-semibold">
										{hoveredCommune.properties.nom}
									</div>
									<div class=" text-xs text-gray-600">
										<div class="mb-1">{selectedScoreIndicator.label}</div>
										<div class="font-bold text-brand-navy">
											{numFormatter.format(
												JSON.parse(hoveredCommune.properties.scores)?.[
													selectedScoreIndicator.property
												] ?? 'N/A'
											)}
										</div>
									</div>
								</div>
							</Popup>
						{/if}
					</GeoJSONSource>

					<GeoJSONSource data={data.voirieData} id="cycleways-source">
						<LineLayer
							id="cycleways-layer"
							paint={{
								'line-color': matchTypeColorReseau,
								'line-width': matchTypeWidth,
								'line-opacity': 0.8
							}}
							layout={{
								visibility: isLayerVisible('cycleways') ? 'visible' : 'none'
							}}
							onclick={(e) => handleFeatureClick(e, 'cycleway')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
					</GeoJSONSource>

					<GeoJSONSource data={data.clustersRouges} id="clusters-red-source">
						<FillLayer
							id="clusters-red-fill"
							layout={{
								visibility: isLayerVisible('problematic-red') ? 'visible' : 'none'
							}}
							paint={{
								'fill-color': '#ef4444',
								'fill-opacity': 0.5
							}}
							onclick={(e) => handleFeatureClick(e, 'cluster-red')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
						<LineLayer
							id="clusters-red-border"
							layout={{
								visibility: isLayerVisible('problematic-red') ? 'visible' : 'none'
							}}
							paint={{
								'line-color': '#b91c1c',
								'line-width': 2,
								'line-opacity': 0.8
							}}
							onclick={(e) => handleFeatureClick(e, 'cluster-red')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
					</GeoJSONSource>

					<GeoJSONSource data={data.pointsRouges} id="points-red-source">
						<CircleLayer
							id="points-red-layer"
							layout={{
								visibility: isLayerVisible('problematic-red') ? 'visible' : 'none'
							}}
							paint={{
								'circle-color': '#ef4444',
								'circle-radius': 2,
								'circle-opacity': 0.8,
								'circle-stroke-width': 0.5,
								'circle-stroke-color': '#fff'
							}}
							onclick={(e) => handleFeatureClick(e, 'point-red')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
					</GeoJSONSource>

					<GeoJSONSource data={data.clustersVerts} id="clusters-green-source">
						<FillLayer
							id="clusters-green-fill"
							layout={{
								visibility: isLayerVisible('problematic-green') ? 'visible' : 'none'
							}}
							paint={{
								'fill-color': '#22c55e',
								'fill-opacity': 0.5
							}}
							onclick={(e) => handleFeatureClick(e, 'cluster-green')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
						<LineLayer
							id="clusters-green-border"
							layout={{
								visibility: isLayerVisible('problematic-green') ? 'visible' : 'none'
							}}
							paint={{
								'line-color': '#16a34a',
								'line-width': 2,
								'line-opacity': 0.8
							}}
							onclick={(e) => handleFeatureClick(e, 'cluster-green')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
					</GeoJSONSource>

					<GeoJSONSource data={data.pointsVerts} id="points-green-source">
						<CircleLayer
							id="points-green-layer"
							layout={{
								visibility: isLayerVisible('problematic-green') ? 'visible' : 'none'
							}}
							paint={{
								'circle-color': '#22c55e',
								'circle-radius': 2,
								'circle-opacity': 0.8,
								'circle-stroke-width': 0.5,
								'circle-stroke-color': '#fff'
							}}
							onclick={(e) => handleFeatureClick(e, 'point-green')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
					</GeoJSONSource>

					<GeoJSONSource data={data.clusterStationnements} id="parking-demand-source">
						<FillLayer
							id="parking-demand-fill"
							layout={{
								visibility: isLayerVisible('parking-demand') ? 'visible' : 'none'
							}}
							paint={{
								'fill-color': '#0595d3',
								'fill-opacity': 0.5
							}}
							onclick={(e) => handleFeatureClick(e, 'parking-demand')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
						<LineLayer
							id="parking-demand-line"
							layout={{
								visibility: isLayerVisible('parking-demand') ? 'visible' : 'none'
							}}
							paint={{
								'line-color': '#0595d3',
								'line-width': 2,
								'line-opacity': 0.8
							}}
							onclick={(e) => handleFeatureClick(e, 'parking-demand')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
					</GeoJSONSource>

					<GeoJSONSource
						id="parking-source"
						data="https://data.grandlyon.com/geoserver/metropole-de-lyon/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=metropole-de-lyon:pvo_patrimoine_voirie.pvostationnementvelo&outputFormat=application/json&SRSNAME=EPSG:4171&sortBy=gid"
					>
						<CircleLayer
							id="parking-layer-small"
							layout={{
								visibility: isLayerVisible('parking') ? 'visible' : 'none'
							}}
							paint={{
								'circle-radius': [
									'interpolate',
									['linear'],
									['zoom'],
									10,
									3,
									12,
									3,
									15,
									3,
									17,
									8,
									20,
									14,
									22,
									20
								],
								'circle-color': '#0944f3',
								'circle-stroke-color': '#ffffff',
								'circle-stroke-width': 0.5
							}}
							onclick={(e) => handleFeatureClick(e, 'parking')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
						<SymbolLayer
							id="parking-layer"
							filter={[
								'all',
								['==', ['get', 'validite'], 'Validé'],
								[
									'in',
									['get', 'mobiliervelo'],
									['literal', ['Consigne collective', 'Box', 'Consigne individuelle']]
								]
							]}
							layout={{
								visibility: isLayerVisible('parking') ? 'visible' : 'none',
								'icon-image': 'parking',
								'icon-size': [
									'interpolate',
									['linear'],
									['zoom'],
									10,
									0.5,
									14,
									0.7,
									18,
									1.1,
									22,
									1.3
								],
								'icon-allow-overlap': true,
								'icon-ignore-placement': true
							}}
							onclick={(e) => handleFeatureClick(e, 'parking')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
					</GeoJSONSource>

					<GeoJSONSource
						id="velov-stations-source"
						data="https://data.grandlyon.com/geoserver/metropole-de-lyon/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=metropole-de-lyon:pvo_patrimoine_voirie.pvostationvelov&outputFormat=application/json&SRSNAME=EPSG:4171&sortBy=gid"
					>
						<SymbolLayer
							id="velov-stations-layer"
							layout={{
								visibility: isLayerVisible('velov') ? 'visible' : 'none',
								'icon-image': 'bicycle',
								'icon-size': [
									'interpolate',
									['linear'],
									['zoom'],
									10,
									0.6,
									14,
									0.8,
									18,
									1.2,
									22,
									1.4
								],
								'icon-allow-overlap': true,
								'icon-ignore-placement': true
							}}
							onclick={(e) => handleFeatureClick(e, 'velov')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
					</GeoJSONSource>

					{#each Array.from({ length: 12 }, (_, index) => index).reverse() as lineData, index}
						{@const lineNumber = index}
						{@const layerId = `vl-${lineNumber}`}
						<GeoJSONSource
							id={`vl-${lineNumber}-source`}
							data={`https://raw.githubusercontent.com/lavilleavelo/cyclopolis/refs/heads/main/content/voies-cyclables/ligne-${lineNumber}.json`}
						>
							<LineLayer
								id={`vl-${lineNumber}-line-contour`}
								layout={{
									'line-join': 'round',
									'line-cap': 'round',
									visibility: isLayerVisible(layerId) ? 'visible' : 'none'
								}}
								paint={{
									'line-color': '#000000',
									'line-width': 8,
									'line-opacity': 1
								}}
								filter={['==', ['get', 'status'], 'done']}
								onclick={(e) => handleFeatureClick(e, `vl-${lineNumber}`)}
								onmouseenter={handleMouseEnter}
								onmouseleave={handleMouseLeave}
							/>
							<LineLayer
								id={`vl-${lineNumber}-line`}
								layout={{
									'line-join': 'round',
									'line-cap': 'round',
									visibility: isLayerVisible(layerId) ? 'visible' : 'none'
								}}
								paint={{
									'line-color': vlColors[index],
									'line-width': 7,
									'line-opacity': 1
								}}
								filter={['==', ['get', 'status'], 'done']}
								onclick={(e) => handleFeatureClick(e, `vl-${lineNumber}`)}
								onmouseenter={handleMouseEnter}
								onmouseleave={handleMouseLeave}
							/>
						</GeoJSONSource>
					{/each}
				</MapLibre>
			</div>
		</div>
	</div>
</div>

<style>
	:global(.maplibregl-popup-content) {
		padding: 0;
		border-radius: 0.5rem;
		max-width: 350px;
	}

	:global(.maplibregl-popup-close-button) {
		font-size: 20px;
		padding: 0 8px;
	}
</style>
