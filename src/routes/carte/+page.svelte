<script lang="ts">
	import '../../app.css';
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { type } from 'arktype';
	import { useSearchParams } from 'runed/kit';

	import {
		MapLibre,
		AttributionControl,
		GeolocateControl,
		NavigationControl,
		Marker,
	} from 'svelte-maplibre-gl';
	import maplibregl from 'maplibre-gl';
	import Filter from '@lucide/svelte/icons/filter';
	import MapContextMenu from '$lib/components/map/MapContextMenu.svelte';
	import FilterPanel from '$lib/components/map/FilterPanel.svelte';
	import FeatureInfo from '$lib/components/map/FeatureInfo.svelte';
	import MobileDrawer from '$lib/components/MobileDrawer.svelte';
	import PanoramaxViewer from '$lib/components/PanoramaxViewer.svelte';
	import MapStyleToggle from '$lib/components/map/MapStyleToggle.svelte';
	import { createMapStyleState } from '$lib/utils/mapStyleToggle.svelte';

	import Geocoder from '$lib/components/Geocoder.svelte';
	import GeocoderMarker from '$lib/components/GeocoderMarker.svelte';
	import type { PageData } from './$types';
	import { processVoiesLyonnaisesData, vlColors, loadShieldIcons } from '$lib/utils/mapUtils';
	import parkingCoveredIcon from '$lib/assets/icons/arceau_couvert.png';
	import parkingVelostationIcon from '$lib/assets/icons/parking-velostation.png';
	import parkingSecureIcon from '$lib/assets/icons/box_securisee_velo.png';
	import parkingLpaIcon from '$lib/assets/icons/parking-lpa.png';
	import pumpIcon from '$lib/assets/icons/pump.png';
	import fountainIcon from '$lib/assets/icons/fontaine.png';

	import MetroLayer from '$lib/components/map/layers/MetroLayer.svelte';
	import TramLayer from '$lib/components/map/layers/TramLayer.svelte';
	import BusLayer from '$lib/components/map/layers/BusLayer.svelte';
	import ParkingLayer from '$lib/components/map/layers/ParkingLayer.svelte';
	import VelovLayer from '$lib/components/map/layers/VelovLayer.svelte';
	import CommunesLayer from '$lib/components/map/layers/CommunesLayer.svelte';
	import CyclewayLayer from '$lib/components/map/layers/CyclewayLayer.svelte';
	import VoiesLyonnaisesLayer from '$lib/components/map/layers/VoiesLyonnaisesLayer.svelte';
	import PumpLayer from '$lib/components/map/layers/PumpLayer.svelte';
	import WaterFountainLayer from '$lib/components/map/layers/WaterFountainLayer.svelte';

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
			id: 'parking-arceaux',
			label: 'Arceaux',
			color: '#4ade80',
			category: 'Stationnements',
		},
		{
			id: 'parking-couverts',
			label: 'Arceaux couverts',
			color: '#4ade80',
			icon: parkingCoveredIcon,
			category: 'Stationnements',
		},
		{
			id: 'parking-box',
			label: 'Box sécurisée vélo',
			color: '#4ade80',
			icon: parkingSecureIcon,
			category: 'Stationnements',
		},
		{
			id: 'parking-velostation',
			label: 'Vélostations',
			color: '#10b981',
			icon: parkingVelostationIcon,
			category: 'Stationnements',
		},
		{
			id: 'parking-lpa',
			label: 'Parking LPA / En ouvrage',
			color: '#3b82f6',
			icon: parkingLpaIcon,
			category: 'Stationnements',
		},
		{
			id: 'velov',
			label: 'Stations Velov',
			color: '#EA2127FF',
			icon: '/velov-station.png',
			category: 'Vélov',
		},
		...Array.from({ length: 12 }, (_, i) => ({
			id: `vl-${i + 1}`,
			label: `${i + 1}`,
			color: vlColors[i],
			category: 'Voies Lyonnaises',
		})),

		{
			id: 'metro',
			label: 'Métro',
			color: '#D53032',
			category: 'Transports en commun',
		},
		{
			id: 'tram',
			label: 'Tramway',
			color: '#933591',
			category: 'Transports en commun',
		},
		{
			id: 'bus-tb',
			label: 'Tram-Bus (BHNS)',
			color: '#933591',
			category: 'Transports en commun',
		},
		{
			id: 'bus-std',
			label: 'Bus',
			color: '#a3a3a3',
			category: 'Transports en commun',
		},
		{
			id: 'pumps',
			label: 'Pompe',
			color: '#e11d48',
			icon: pumpIcon,
			category: 'Aires de service',
		},
		{
			id: 'water-fountains',
			label: 'Borne fontaine à eau',
			color: '#3b82f6',
			icon: fountainIcon,
			category: 'Aires de service',
		},
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

	const mapStyleState = createMapStyleState();

	let geocoderHighlight: { lng: number; lat: number } | null = $state(null);
	let geocoderHighlightFading = $state(false);
	let geocoderHighlightTimeout: ReturnType<typeof setTimeout> | null = null;
	let geocoderFadeTimeout: ReturnType<typeof setTimeout> | null = null;

	let contextMenuVisible = $state(false);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);

	let contextMenuLngLat: { lng: number; lat: number } | null = $state(null);
	let contextMenuPhotoLocation: { lng: number; lat: number } | null = $state(null);
	let hoveredPhotoLocation: { lng: number; lat: number } | null = $state(null);
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

		if (isLayerVisible('parking-arceaux')) {
			interactableLayerIds.push('parking-layer-circles');
		}
		if (isLayerVisible('parking-couverts')) {
			interactableLayerIds.push('parking-layer-roof');
		}
		if (isLayerVisible('parking-box')) {
			interactableLayerIds.push('parking-layer-box');
		}
		if (isLayerVisible('parking-lpa')) {
			interactableLayerIds.push('parking-layer-lpa');
		}
		if (isLayerVisible('parking-secure')) {
			interactableLayerIds.push('parking-layer-secure');
		}
		if (isLayerVisible('parking-velostation')) {
			interactableLayerIds.push('parking-layer-velostation');
		}
		if (isLayerVisible('parking-lpa')) {
			interactableLayerIds.push('parking-layer-lpa');
		}

		if (isLayerVisible('velov')) {
			interactableLayerIds.push('velov-stations-layer');
		}

		if (isLayerVisible('metro')) {
			interactableLayerIds.push('metro-layer');
		}
		if (isLayerVisible('tram')) {
			interactableLayerIds.push('tram-layer');
		}
		if (isLayerVisible('bus-tb')) {
			interactableLayerIds.push('bus-layer-tb');
		}
		if (isLayerVisible('bus-std')) {
			interactableLayerIds.push('bus-layer-std');
		}

		Array.from({ length: 12 }, (_, i) => i + 1).forEach((num) => {
			if (isLayerVisible(`vl-${num}`)) {
				interactableLayerIds.push(`vl-${num}-line`, `vl-${num}-line-contour`);
			}
		});

		if (isLayerVisible('pumps')) {
			interactableLayerIds.push('pumps-layer');
		}
		if (isLayerVisible('water-fountains')) {
			interactableLayerIds.push('fountains-layer');
		}

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
					if (f.layer.id === 'cycleways-layer') {
						return { ...f, type: 'cycleway' };
					}
					if (f.layer.id.startsWith('parking-layer')) {
						return { ...f, type: 'parking' };
					}
					if (f.layer.id === 'velov-stations-layer') {
						return { ...f, type: 'velov' };
					}
					if (f.layer.id === 'metro-layer') {
						return { ...f, type: 'metro' };
					}
					if (f.layer.id === 'tram-layer') {
						return { ...f, type: 'tram' };
					}
					if (f.layer.id === 'bus-layer-tb' || f.layer.id === 'bus-layer-std') {
						return { ...f, type: 'bus' };
					}
					if (f.layer.id.startsWith('vl-')) {
						return { ...f, type: f.layer.id.split('-line')[0] };
					}
					if (f.layer.id === 'pumps-layer') {
						return { ...f, type: 'pump' };
					}
					if (f.layer.id === 'fountains-layer') {
						return { ...f, type: 'water-fountain' };
					}
					return { ...f, type: 'default' };
				});
			selectedLngLat = lngLat;
		} else {
			selectedFeatures = [];
			selectedLngLat = null;
			hoveredPhotoLocation = null;
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
		contextMenuPhotoLocation = null;
	}

	function closeContextMenu() {
		contextMenuVisible = false;
		contextMenuLngLat = null;
		contextMenuPhotoLocation = null;
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
					onClose={() => {
						selectedFeatures = [];
						hoveredPhotoLocation = null;
					}}
					onPhotoHover={(loc) => (hoveredPhotoLocation = loc)}
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
			style={mapStyleState.getMapStyleUrl()}
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
			<MapStyleToggle onToggle={mapStyleState.toggleMapStyle} />

			{#if innerWidth >= 768}
				<GeolocateControl position="top-right" />
			{:else}
				<GeolocateControl position="bottom-right" />
			{/if}

			{#if geocoderHighlight}
				<GeocoderMarker lnglat={geocoderHighlight} fading={geocoderHighlightFading} />
			{/if}

			{#if selectedLngLat}
				<Marker lnglat={selectedLngLat} />
			{/if}

			{#if contextMenuPhotoLocation}
				<GeocoderMarker pulse={false} lnglat={contextMenuPhotoLocation} />
			{/if}

			{#if hoveredPhotoLocation}
				<GeocoderMarker lnglat={hoveredPhotoLocation} pulse={false} />
			{/if}

			<CommunesLayer {isLayerVisible} {data} />

			<CyclewayLayer {isLayerVisible} {data} {handleMouseEnter} {handleMouseLeave} />

			<VelovLayer {isLayerVisible} {handleMouseEnter} {handleMouseLeave} />

			<ParkingLayer {isLayerVisible} {handleMouseEnter} {handleMouseLeave} />

			<BusLayer {isLayerVisible} {handleMouseEnter} {handleMouseLeave} {map} />

			<MetroLayer {isLayerVisible} {handleMouseEnter} {handleMouseLeave} {map} />

			<TramLayer {isLayerVisible} {handleMouseEnter} {handleMouseLeave} {map} />

			<VoiesLyonnaisesLayer
				{isLayerVisible}
				{handleMouseEnter}
				{handleMouseLeave}
				{processedVLData}
			/>

			<PumpLayer {isLayerVisible} {handleMouseEnter} {handleMouseLeave} />

			<WaterFountainLayer {isLayerVisible} {handleMouseEnter} {handleMouseLeave} />
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
						onClose={() => {
							selectedFeatures = [];
							hoveredPhotoLocation = null;
						}}
						onPhotoHover={(loc) => (hoveredPhotoLocation = loc)}
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
		onPhotoFound={(loc) => (contextMenuPhotoLocation = loc)}
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
