<script lang="ts">
	import '../../app.css';
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
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
		ImageLoader,
	} from 'svelte-maplibre-gl';
	import maplibregl from 'maplibre-gl';
	import Filter from '@lucide/svelte/icons/filter';
	import MapContextMenu from '$lib/components/map/MapContextMenu.svelte';
	import FilterPanel from '$lib/components/map/FilterPanel.svelte';
	import FeatureInfo from '$lib/components/map/FeatureInfo.svelte';
	import MobileDrawer from '$lib/components/MobileDrawer.svelte';
	import PanoramaxViewer from '$lib/components/PanoramaxViewer.svelte';

	import { matchTypeColorReseau, matchTypeWidth } from '$lib/utils.ts';
	import Geocoder from '$lib/components/Geocoder.svelte';
	import GeocoderMarker from '$lib/components/GeocoderMarker.svelte';
	import type { PageData } from './$types';
	import { processVoiesLyonnaisesData, vlColors, loadShieldIcons } from '$lib/utils/mapUtils';
	import velovDataUrl from '$lib/data/velov-data-grand-lyon.json?url';

	let { data }: { data: PageData } = $props();

	const mapSearchParamsSchema = type({
		layers: type('string[]').default(() =>
			['communes', 'cycleways', Array.from({ length: 12 }, (_, i) => `vl-${i + 1}`)].flat(),
		),
		commune: 'string = ""',
		zoom: 'number = 11',
		center: type('number[]').default(() => [4.835659, 45.764043]),
		selected: type('number[]').default(() => []),
	});

	const params = useSearchParams(mapSearchParamsSchema, {
		pushHistory: false,
		debounce: 100,
	});

	const availableLayers = [
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
			category: 'Stationnements',
		},
		{
			id: 'velov',
			label: 'Stations Velov',
			color: '#EA2127FF',
			category: 'Vélov',
		},
		...Array.from({ length: 12 }, (_, i) => ({
			id: `vl-${i + 1}`,
			label: `${i + 1}`,
			color: vlColors[i],
			category: 'Voies Lyonnaises',
		})),
		{
			id: 'communes',
			label: 'Limites des communes',
			color: '#6b7280',
			category: 'Communes',
		},
	] as const;

	let map: maplibregl.Map | undefined = $state();
	let showMobileFilters = $state(false);
	let cursor: string | undefined = $state();

	let geocoderHighlight: { lng: number; lat: number } | null = $state(null);
	let geocoderHighlightFading = $state(false);
	let geocoderHighlightTimeout: ReturnType<typeof setTimeout> | null = null;
	let geocoderFadeTimeout: ReturnType<typeof setTimeout> | null = null;

	let contextMenuVisible = $state(false);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);
	let contextMenuLngLat: { lng: number; lat: number } | null = $state(null);
	let innerWidth = $state(0);
	let bearing = $state(0);
	let pitch = $state(0);

	let touchTimeout: ReturnType<typeof setTimeout> | null = null;
	let touchStartPoint: { x: number; y: number } | null = null;

	let collapsedCategories = $state(
		new Set<string>(
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

	const processedVLData = $derived(
		data?.voiesLyonnaises
			? processVoiesLyonnaisesData(data.voiesLyonnaises)
			: { grouped: {}, allFeatures: [] },
	);

	let zoom = $state(params.zoom);
	let center = $state<{ lng: number; lat: number }>({
		lng: params.center[0],
		lat: params.center[1],
	});

	$effect(() => {
		const pZoom = params.zoom;
		const [pLng, pLat] = params.center;

		untrack(() => {
			if (Math.abs(pZoom - zoom) > 0.001) {
				zoom = pZoom;
			}
			if (Math.abs(pLng - center.lng) > 0.0001 || Math.abs(pLat - center.lat) > 0.0001) {
				center = { lng: pLng, lat: pLat };
			}
		});
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
			params.layers = (params.layers || []).filter((id) => !layerIds.includes(id));
		} else {
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

	let selectedFeatures: any[] = $state([]);
	let selectedLngLat: { lng: number; lat: number } | null = $state(null);
	let showPanoramax = $state(false);

	function getInteractableLayers(): string[] {
		const interactableLayerIds: string[] = [];

		if (isLayerVisible('cycleways')) {
			interactableLayerIds.push('cycleways-layer');
		}

		if (isLayerVisible('parking')) {
			interactableLayerIds.push('parking-layer-small', 'parking-layer');
		}

		if (isLayerVisible('velov')) {
			interactableLayerIds.push('velov-stations-layer');
		}

		Array.from({ length: 12 }, (_, i) => i + 1).forEach((num) => {
			if (isLayerVisible(`vl-${num}`)) {
				interactableLayerIds.push(`vl-${num}-line`, `vl-${num}-line-contour`);
			}
		});

		return interactableLayerIds;
	}

	function selectFeaturesAt(point: { x: number; y: number }, lngLat: { lng: number; lat: number }) {
		if (!map) return;

		const interactableLayerIds = getInteractableLayers();
		const features = map.queryRenderedFeatures(point, { layers: interactableLayerIds });

		if (features.length > 0) {
			selectedFeatures = features
				.filter(
					(feature, index, self) =>
						index ===
						self.findIndex(
							(t) =>
								t.properties?.id === feature.properties?.id &&
								t.geometry.type === feature.geometry.type,
						),
				)
				.map((f) => {
					if (f.layer.id === 'cycleways-layer') return { ...f, type: 'cycleway' };
					if (f.layer.id.startsWith('parking-')) return { ...f, type: 'parking' };
					if (f.layer.id === 'velov-stations-layer') return { ...f, type: 'velov' };
					if (f.layer.id.startsWith('vl-')) return { ...f, type: f.layer.id.split('-line')[0] };
					return { ...f, type: 'default' };
				});
			selectedLngLat = lngLat;
		} else {
			selectedFeatures = [];
			selectedLngLat = null;
		}
	}

	function handleMapClick(e: any) {
		params.selected = [e.lngLat.lng, e.lngLat.lat];
		selectFeaturesAt(e.point, e.lngLat);
	}

	function handleMouseEnter() {
		cursor = 'pointer';
	}

	function handleMouseLeave() {
		cursor = undefined;
	}

	function handleGeocoderSelect(coordinates: [number, number], _name: string) {
		if (!map) return;
		map.flyTo({
			center: coordinates,
			zoom: 16,
			duration: 1500,
		});

		if (geocoderHighlightTimeout) {
			clearTimeout(geocoderHighlightTimeout);
		}
		if (geocoderFadeTimeout) {
			clearTimeout(geocoderFadeTimeout);
		}

		geocoderHighlightFading = false;
		geocoderHighlight = { lng: coordinates[0], lat: coordinates[1] };

		geocoderHighlightTimeout = setTimeout(() => {
			geocoderHighlightFading = true;
		}, 3000);

		geocoderFadeTimeout = setTimeout(() => {
			geocoderHighlight = null;
			geocoderHighlightFading = false;
		}, 4000);
	}

	function handleMapContextMenu(event: any) {
		event.preventDefault();
		const e = event.originalEvent as MouseEvent;
		contextMenuVisible = true;
		contextMenuX = e.clientX;
		contextMenuY = e.clientY;
		contextMenuLngLat = {
			lng: event.lngLat.lng,
			lat: event.lngLat.lat,
		};
	}

	function closeContextMenu() {
		contextMenuVisible = false;
		contextMenuLngLat = null;
	}

	function handleTouchStart(e: any) {
		if (e.points.length !== 1) return;
		const point = e.point;
		const lngLat = e.lngLat;

		touchStartPoint = point;
		touchTimeout = setTimeout(() => {
			contextMenuVisible = true;
			contextMenuX = e.originalEvent.touches[0].clientX;
			contextMenuY = e.originalEvent.touches[0].clientY;
			contextMenuLngLat = lngLat;
		}, 500);
	}

	function handleTouchMove(e: any) {
		if (!touchStartPoint) return;
		const point = e.point;
		const dist = Math.sqrt(
			Math.pow(point.x - touchStartPoint.x, 2) + Math.pow(point.y - touchStartPoint.y, 2),
		);
		if (dist > 10) {
			if (touchTimeout) clearTimeout(touchTimeout);
			touchTimeout = null;
			touchStartPoint = null;
		}
	}

	function handleTouchEnd() {
		if (touchTimeout) {
			clearTimeout(touchTimeout);
			touchTimeout = null;
		}
		touchStartPoint = null;
	}

	const LYON_BOUNDS: [number, number, number, number] = [4.6, 45.5, 5.1, 46.0];
	const MAP_BOUNDS: [[number, number], [number, number]] = [
		[4.2, 45.4],
		[5.5, 46.1],
	];
</script>

<svelte:window bind:innerWidth />

<div
	class="relative flex h-[calc(100vh)] w-[100vw] flex-row overflow-hidden"
	style="margin-left: calc(50% - 50vw); width: 100vw;"
>
	<div class="relative h-full flex-1">
		<div
			class="absolute top-4 left-1/2 z-20 w-full max-w-xs -translate-x-1/2 px-4 sm:max-w-sm md:max-w-md"
		>
			<div class="rounded-lg shadow-md">
				<Geocoder onSelect={handleGeocoderSelect} bbox={LYON_BOUNDS} />
			</div>
		</div>

		{#if selectedFeatures.length > 0}
			<div class="absolute top-4 left-4 z-20 hidden md:block">
				<FeatureInfo
					features={selectedFeatures}
					coordinates={selectedLngLat}
					onOpenPanoramax={() => (showPanoramax = true)}
					onClose={() => (selectedFeatures = [])}
				/>
			</div>
		{/if}

		<button
			class="absolute bottom-12 left-4 z-20 rounded-full bg-white p-3 shadow-lg md:hidden"
			onclick={() => (showMobileFilters = true)}
			aria-label="Filtres"
		>
			<Filter size={24} />
		</button>

		<MapLibre
			class="h-full w-full"
			style="https://openmaptiles.geo.data.gouv.fr/styles/osm-bright/style.json"
			bind:map
			bind:zoom
			bind:center
			bind:bearing
			bind:pitch
			maxBounds={MAP_BOUNDS}
			{cursor}
			attributionControl={false}
			maxZoom={22}
			onload={async () => {
				if (map) {
					await loadShieldIcons(map, processedVLData.allFeatures);
					if (params.selected && params.selected.length === 2) {
						setTimeout(() => {
							if (!map) return;
							const [lng, lat] = params.selected;
							const point = map.project([lng, lat]);
							selectFeaturesAt(point, { lng, lat });
						}, 100);
					}
				}
			}}
			oncontextmenu={handleMapContextMenu}
			onclick={handleMapClick}
			ontouchstart={handleTouchStart}
			ontouchmove={handleTouchMove}
			ontouchend={handleTouchEnd}
			onmoveend={() => {
				params.zoom = zoom;
				params.center = [center.lng, center.lat];
			}}
		>
			<AttributionControl compact={true} />

			{#if innerWidth >= 768}
				<GeolocateControl position="top-right" />
			{:else}
				<GeolocateControl position="bottom-right" />
			{/if}

			{#if innerWidth >= 768}
				<NavigationControl position="top-right" showCompass={bearing !== 0 || pitch !== 0} />
			{/if}

			{#if geocoderHighlight}
				<GeocoderMarker lnglat={geocoderHighlight} fading={geocoderHighlightFading} />
			{/if}

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
						'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 14, 0.7, 18, 1.1, 22, 1.3],
						'icon-allow-overlap': true,
						'icon-ignore-placement': true,
					}}
					onmouseenter={handleMouseEnter}
					onmouseleave={handleMouseLeave}
				/>
			</GeoJSONSource>

			<GeoJSONSource maxzoom={14} id="velov-stations-source" data={velovDataUrl}>
				<ImageLoader images={{ velov: '/velov-station.png' }}>
					<SymbolLayer
						id="velov-stations-layer"
						layout={{
							visibility: isLayerVisible('velov') ? 'visible' : 'none',
							'icon-image': 'velov',
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
						onmouseenter={handleMouseEnter}
						onmouseleave={handleMouseLeave}
					/>
				</ImageLoader>
			</GeoJSONSource>

			{#each Array.from({ length: 12 }, (_, index) => index + 1).reverse() as lineNumber}
				{@const layerId = `vl-${lineNumber}`}
				{@const lineIndex = lineNumber - 1}
				{#if processedVLData.grouped[lineNumber]}
					<GeoJSONSource id={`vl-${lineNumber}-source`} data={processedVLData.grouped[lineNumber]}>
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
							onmouseenter={handleMouseEnter}
							onmouseleave={handleMouseLeave}
						/>

						<SymbolLayer
							id={`vl-${lineNumber}-labels-low`}
							maxzoom={14}
							filter={['all', ['==', ['get', 'status'], 'done'], ['>=', ['get', 'distance'], 900]]}
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

						<SymbolLayer
							id={`vl-${lineNumber}-labels-med`}
							minzoom={13}
							maxzoom={17}
							filter={['all', ['==', ['get', 'status'], 'done'], ['>=', ['get', 'distance'], 300]]}
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

	<div class="hidden h-full w-80 border-l bg-white shadow-xl md:flex md:flex-col">
		<div class="border-b p-4">
			<h2 class="flex items-center gap-2 text-lg font-bold">
				<Filter size={20} />
				Filtres
			</h2>
		</div>
		<div class="flex-1 overflow-y-auto p-4">
			<FilterPanel
				{layersByCategory}
				{isCategoryVisible}
				{isCategoryCollapsed}
				{toggleCategory}
				{toggleCategoryCollapse}
				{toggleLayer}
				{isLayerVisible}
			/>
		</div>
	</div>

	<div class="md:hidden">
		<MobileDrawer bind:open={showMobileFilters} snapPoints={[0.4, 0.9]} initialSnapPoint={0}>
			<div class="p-4">
				<h2 class="mb-4 text-lg font-bold">Filtres</h2>
				<FilterPanel
					{layersByCategory}
					{isCategoryVisible}
					{isCategoryCollapsed}
					{isLayerVisible}
					{toggleCategory}
					{toggleCategoryCollapse}
					{toggleLayer}
				/>
			</div>
		</MobileDrawer>

		<!-- Mobile Feature Info Drawer -->
		{#if selectedFeatures.length > 0}
			<MobileDrawer
				open={true}
				snapPoints={[0.4, 0.8]}
				initialSnapPoint={0}
				onClose={() => (selectedFeatures = [])}
			>
				<div class="p-0">
					<FeatureInfo
						features={selectedFeatures}
						coordinates={selectedLngLat}
						onOpenPanoramax={() => (showPanoramax = true)}
						onClose={() => (selectedFeatures = [])}
					/>
				</div>
			</MobileDrawer>
		{/if}
	</div>

	<MapContextMenu
		visible={contextMenuVisible}
		x={contextMenuX}
		y={contextMenuY}
		lngLat={contextMenuLngLat}
		onClose={closeContextMenu}
	/>
</div>

{#if showPanoramax && selectedLngLat}
	<PanoramaxViewer
		coordinates={[selectedLngLat.lng, selectedLngLat.lat]}
		onClose={() => (showPanoramax = false)}
	/>
{/if}

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

	:global(html),
	:global(body) {
		overflow: hidden;
		height: 100%;
		width: 100%;
	}
</style>
