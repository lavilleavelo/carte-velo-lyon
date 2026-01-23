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
		SymbolLayer,
	} from 'svelte-maplibre-gl';
	import maplibregl from 'maplibre-gl';
	import Filter from '@lucide/svelte/icons/filter';
	import positronStyleCustom from './positron-custom.json';

	import { matchTypeColorReseau, matchTypeWidth } from '$lib/utils.ts';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import Geocoder from '$lib/components/Geocoder.svelte';
	import type { PageData } from './$types';
	import { processVoiesLyonnaisesData, vlColors, loadShieldIcons } from '$lib/utils/mapUtils';

	let { data }: { data: PageData } = $props();

	const mapSearchParamsSchema = type({
		layers: type('string[]').default(() =>
			['communes', 'cycleways', Array.from({ length: 12 }, (_, i) => `vl-${i + 1}`)].flat(),
		),
		commune: 'string = ""',
		zoom: 'number = 11',
		center: type('number[]').default(() => [4.835659, 45.764043]),
		showProblematic: 'boolean = true',
		showParking: 'boolean = true',
		showCycleways: 'boolean = true',
		showCommunes: 'boolean = true',
		dimBackground: 'boolean = false',
	});

	const params = useSearchParams(mapSearchParamsSchema, {
		pushHistory: false,
		debounce: 100,
	});

	const availableLayers = [
		{
			id: 'communes',
			label: 'Limites des communes',
			color: '#6b7280',
			category: 'Communes',
		},
		{
			id: 'cycleways',
			label: 'Aménagements cyclables',
			color: '#19181a',
			category: 'Infrastructures Cyclables',
		},
		{
			id: 'parking',
			label: 'Stationnements vélos',
			color: '#0944f3',
			category: 'Infrastructures Cyclables',
		},
		{
			id: 'velov',
			label: 'Stations Velov',
			color: '#fbbf24',
			category: 'Infrastructures Cyclables',
		},
		...Array.from({ length: 12 }, (_, i) => ({
			id: `vl-${i + 1}`,
			label: `${i + 1}`,
			color: vlColors[i],
			category: 'Voies Lyonnaises',
		})),
		{
			category: 'Baromètre Cyclable FUB',
			id: 'problematic-red',
			label: 'Zones prioritaires',
			color: '#ef4444',
		},
		{
			id: 'problematic-green',
			label: "Zones d'amélioration",
			color: '#22c55e',
			category: 'Baromètre Cyclable FUB',
		},
		{
			id: 'parking-demand',
			label: 'Zones de demande de stationnements',
			color: '#0595d3',
			category: 'Baromètre Cyclable FUB',
		},
	] as const;

	const numFormatter = new Intl.NumberFormat('fr-FR', {
		style: 'decimal',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});

	let map: maplibregl.Map | undefined = $state();
	let filtersExpanded = $state(true);
	let cursor: string | undefined = $state();
	let selectedFeature: any = $state(null);
	let hoveredCommune: any = $state(null);
	let hoverLngLat = $state.raw(new maplibregl.LngLat(0, 0));
	let collapsedCategories = $state(
		new Set<string>(
			// Initially collapse all categories if no layer from that category is active
			availableLayers
				.map((layer) => layer.category)
				.filter(
					(category, index, self) =>
						self.indexOf(category) === index &&
						!availableLayers
							.filter((layer) => layer.category === category)
							.some((layer) => (params.layers || []).includes(layer.id)),
				),
		),
	);

	const processedVLData = $derived(processVoiesLyonnaisesData(data.voiesLyonnaises));

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

	function toggleCategory(category: string) {
		const categoryLayers = layersByCategory.get(category);
		if (!categoryLayers) return;

		const layerIds = categoryLayers.map((layer) => layer.id);
		const allVisible = layerIds.every((id) => isLayerVisible(id));

		if (allVisible) {
			// Turn off all layers in category
			params.layers = (params.layers || []).filter((id) => !layerIds.includes(id));
		} else {
			// Turn on all layers in category
			const currentLayers = new Set(params.layers || []);
			layerIds.forEach((id) => currentLayers.add(id));
			params.layers = Array.from(currentLayers);
		}
	}

	function isCategoryVisible(category: string): boolean {
		const categoryLayers = layersByCategory.get(category);
		if (!categoryLayers) return false;
		return categoryLayers.some((layer) => isLayerVisible(layer.id));
	}

	function isCategoryCollapsed(category: string): boolean {
		return collapsedCategories.has(category);
	}

	function toggleCategoryCollapse(category: string) {
		if (collapsedCategories.has(category)) {
			collapsedCategories.delete(category);
		} else {
			collapsedCategories.add(category);
		}
		collapsedCategories = new Set(collapsedCategories);
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
			duration: 1500,
		});
	}

	const LYON_BOUNDS: [number, number, number, number] = [4.6, 45.5, 5.1, 46.0];
	const MAP_BOUNDS: [[number, number], [number, number]] = [
		[4.2, 45.4],
		[5.5, 46.1],
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
							<div class="max-h-[60vh] max-w-[350px] overflow-y-auto p-4">
								<div class="flex flex-col gap-4">
									{#each [...layersByCategory.entries()] as [category, layers]}
										<div class="flex flex-col gap-2">
											<div class="flex items-center justify-between">
												<button
													onclick={() => toggleCategoryCollapse(category)}
													class="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase transition-colors hover:text-gray-700"
												>
													<svg
														class="h-3 w-3 transition-transform duration-200"
														class:rotate-180={!isCategoryCollapsed(category)}
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
													{category}
												</button>
												<button
													onclick={() => toggleCategory(category)}
													class="rounded px-2 py-0.5 text-xs transition-colors hover:bg-gray-100"
													class:text-brand-navy={isCategoryVisible(category)}
													class:text-gray-400={!isCategoryVisible(category)}
													title={isCategoryVisible(category)
														? 'Désactiver toutes les couches'
														: 'Activer toutes les couches'}
												>
													{isCategoryVisible(category) ? 'Tout désactiver' : 'Tout activer'}
												</button>
											</div>
											{#if !isCategoryCollapsed(category)}
												<div class="flex flex-row flex-wrap gap-2 pl-1">
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
											{/if}
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
					style="https://openmaptiles.geo.data.gouv.fr/styles/osm-bright/style.json"
					center={[center.lng, center.lat]}
					zoom={params.zoom}
					maxBounds={MAP_BOUNDS}
					{cursor}
					attributionControl={false}
					maxZoom={22}
					onload={async (ev) => {
						map = ev.target;
						await loadShieldIcons(map, processedVLData.allFeatures);
					}}
					onmoveend={handleMapMove}
				>
					<NavigationControl position="top-right" />
					<GeolocateControl position="top-right" />
					<AttributionControl compact={true} />

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
						<FillLayer
							id="communes-fill"
							layout={{
								visibility: isLayerVisible('communes') ? 'visible' : 'none',
							}}
							paint={{
								'fill-color': '#6b7280',
								'fill-opacity': 0.05,
							}}
						/>
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
						<SymbolLayer
							id="communes-labels"
							layout={{
								'text-field': ['get', 'nom'],
								'text-font': ['Noto Sans Regular'],
								'text-max-width': 8,
								'text-offset': [0, -0.1],
								'text-size': ['interpolate', ['exponential', 1.2], ['zoom'], 4, 10, 7, 11, 11, 15],
								'text-allow-overlap': false,
								'text-ignore-placement': false,
								'text-optional': true,
								'symbol-spacing': 1e6,
								visibility: isLayerVisible('communes') ? 'visible' : 'none',
							}}
							paint={{
								'text-color': '#000',
								'text-halo-blur': 1,
								'text-halo-color': '#fff',
								'text-halo-width': 1,
							}}
						/>
					</GeoJSONSource>

					<GeoJSONSource maxzoom={14} data={data.voirieData} id="cycleways-source">
						<LineLayer
							id="cycleways-layer"
							paint={{
								'line-color': matchTypeColorReseau,
								'line-width': matchTypeWidth,
								'line-opacity': 0.8,
							}}
							layout={{
								visibility: isLayerVisible('cycleways') ? 'visible' : 'none',
							}}
							onclick={(e) => handleFeatureClick(e, 'cycleway')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
					</GeoJSONSource>

					<GeoJSONSource maxzoom={14} data={data.clustersRouges} id="clusters-red-source">
						<FillLayer
							id="clusters-red-fill"
							layout={{
								visibility: isLayerVisible('problematic-red') ? 'visible' : 'none',
							}}
							paint={{
								'fill-color': '#ef4444',
								'fill-opacity': 0.5,
							}}
							onclick={(e) => handleFeatureClick(e, 'cluster-red')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
						<LineLayer
							id="clusters-red-border"
							layout={{
								visibility: isLayerVisible('problematic-red') ? 'visible' : 'none',
							}}
							paint={{
								'line-color': '#b91c1c',
								'line-width': 2,
								'line-opacity': 0.8,
							}}
							onclick={(e) => handleFeatureClick(e, 'cluster-red')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
					</GeoJSONSource>

					<GeoJSONSource maxzoom={14} data={data.pointsRouges} id="points-red-source">
						<CircleLayer
							id="points-red-layer"
							layout={{
								visibility: isLayerVisible('problematic-red') ? 'visible' : 'none',
							}}
							paint={{
								'circle-color': '#ef4444',
								'circle-radius': 2,
								'circle-opacity': 0.8,
								'circle-stroke-width': 0.5,
								'circle-stroke-color': '#fff',
							}}
							onclick={(e) => handleFeatureClick(e, 'point-red')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
					</GeoJSONSource>

					<GeoJSONSource maxzoom={14} data={data.clustersVerts} id="clusters-green-source">
						<FillLayer
							id="clusters-green-fill"
							layout={{
								visibility: isLayerVisible('problematic-green') ? 'visible' : 'none',
							}}
							paint={{
								'fill-color': '#22c55e',
								'fill-opacity': 0.5,
							}}
							onclick={(e) => handleFeatureClick(e, 'cluster-green')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
						<LineLayer
							id="clusters-green-border"
							layout={{
								visibility: isLayerVisible('problematic-green') ? 'visible' : 'none',
							}}
							paint={{
								'line-color': '#16a34a',
								'line-width': 2,
								'line-opacity': 0.8,
							}}
							onclick={(e) => handleFeatureClick(e, 'cluster-green')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
					</GeoJSONSource>

					<GeoJSONSource maxzoom={14} data={data.pointsVerts} id="points-green-source">
						<CircleLayer
							id="points-green-layer"
							layout={{
								visibility: isLayerVisible('problematic-green') ? 'visible' : 'none',
							}}
							paint={{
								'circle-color': '#22c55e',
								'circle-radius': 2,
								'circle-opacity': 0.8,
								'circle-stroke-width': 0.5,
								'circle-stroke-color': '#fff',
							}}
							onclick={(e) => handleFeatureClick(e, 'point-green')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
					</GeoJSONSource>

					<GeoJSONSource maxzoom={14} data={data.clusterStationnements} id="parking-demand-source">
						<FillLayer
							id="parking-demand-fill"
							layout={{
								visibility: isLayerVisible('parking-demand') ? 'visible' : 'none',
							}}
							paint={{
								'fill-color': '#0595d3',
								'fill-opacity': 0.5,
							}}
							onclick={(e) => handleFeatureClick(e, 'parking-demand')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
						<LineLayer
							id="parking-demand-line"
							layout={{
								visibility: isLayerVisible('parking-demand') ? 'visible' : 'none',
							}}
							paint={{
								'line-color': '#0595d3',
								'line-width': 2,
								'line-opacity': 0.8,
							}}
							onclick={(e) => handleFeatureClick(e, 'parking-demand')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
					</GeoJSONSource>

					<GeoJSONSource
						maxzoom={14}
						id="parking-data"
						data="https://data.grandlyon.com/geoserver/metropole-de-lyon/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=metropole-de-lyon:pvo_patrimoine_voirie.pvostationnementvelo&outputFormat=application/json&SRSNAME=EPSG:4171&sortBy=gid"
					>
						<CircleLayer
							id="parking-layer-small"
							layout={{
								visibility: isLayerVisible('parking') ? 'visible' : 'none',
							}}
							paint={{
								'circle-opacity': 0.5,
								'circle-radius': [
									'interpolate',
									['linear'],
									['zoom'],
									10,
									2,
									12,
									2,
									15,
									3,
									17,
									8,
									20,
									14,
									22,
									20,
								],
								'circle-color': '#0944f3',
								'circle-stroke-color': '#ffffff',
								'circle-stroke-width': 0.5,
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
									['literal', ['Consigne collective', 'Box', 'Consigne individuelle']],
								],
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
									1.3,
								],
								'icon-allow-overlap': true,
								'icon-ignore-placement': true,
							}}
							onclick={(e) => handleFeatureClick(e, 'parking')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
					</GeoJSONSource>

					<GeoJSONSource
						maxzoom={14}
						id="velov-stations"
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
									1.4,
								],
								'icon-allow-overlap': true,
								'icon-ignore-placement': true,
							}}
							onclick={(e) => handleFeatureClick(e, 'velov')}
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>
					</GeoJSONSource>

					{#each Array.from({ length: 12 }, (_, index) => index + 1).reverse() as lineNumber}
						{@const layerId = `vl-${lineNumber}`}
						{@const lineIndex = lineNumber - 1}
						{#if processedVLData.grouped[lineNumber]}
							<GeoJSONSource
								id={`vl-${lineNumber}-source`}
								data={processedVLData.grouped[lineNumber]}
							>
								<LineLayer
									id={`vl-${lineNumber}-line-contour`}
									layout={{
										'line-join': 'round',
										'line-cap': 'round',
										visibility: isLayerVisible(layerId) ? 'visible' : 'none',
									}}
									paint={{
										'line-color': vlColors[lineIndex],
										'line-width': 6,
										'line-opacity': 1,
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
										visibility: isLayerVisible(layerId) ? 'visible' : 'none',
									}}
									paint={{
										'line-color': '#000000',
										'line-width': 3,
										'line-opacity': 1,
									}}
									filter={['==', ['get', 'status'], 'done']}
									onclick={(e) => handleFeatureClick(e, `vl-${lineNumber}`)}
									onmouseenter={handleMouseEnter}
									onmouseleave={handleMouseLeave}
								/>

								<!-- Label layers for line numbers -->
								<!-- Low zoom: only show on long segments -->
								<SymbolLayer
									id={`vl-${lineNumber}-labels-low`}
									maxzoom={14}
									filter={[
										'all',
										['==', ['get', 'status'], 'done'],
										['>=', ['get', 'distance'], 900],
									]}
									layout={{
										'icon-image': [
											'coalesce',
											['get', 'compositeIconName'],
											['concat', 'line-shield-', lineNumber],
										],
										'icon-size': 0.3,
										'symbol-spacing': 1000000,
										'symbol-placement': 'line-center',
										'icon-rotation-alignment': 'viewport',
										visibility: isLayerVisible(layerId) ? 'visible' : 'none',
									}}
								/>

								<!-- Medium zoom: show on medium-length segments -->
								<SymbolLayer
									id={`vl-${lineNumber}-labels-med`}
									minzoom={13}
									maxzoom={17}
									filter={[
										'all',
										['==', ['get', 'status'], 'done'],
										['>=', ['get', 'distance'], 300],
									]}
									layout={{
										'icon-image': [
											'coalesce',
											['get', 'compositeIconName'],
											['concat', 'line-shield-', lineNumber],
										],
										'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.3, 15, 0.3, 17, 0.4],
										'symbol-spacing': 1000000,
										'symbol-placement': 'line-center',
										visibility: isLayerVisible(layerId) ? 'visible' : 'none',
									}}
								/>

								<!-- High zoom: show all labels -->
								<SymbolLayer
									id={`vl-${lineNumber}-labels-high`}
									minzoom={17}
									filter={['==', ['get', 'status'], 'done']}
									layout={{
										'icon-image': [
											'coalesce',
											['get', 'compositeIconName'],
											['concat', 'line-shield-', lineNumber],
										],
										'icon-size': 0.4,
										'symbol-spacing': 1000000,
										'symbol-placement': 'line-center',
										visibility: isLayerVisible(layerId) ? 'visible' : 'none',
									}}
								/>
							</GeoJSONSource>
						{/if}
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
