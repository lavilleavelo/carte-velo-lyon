<script lang="ts">
	import {
		MapLibre,
		AttributionControl,
		NavigationControl,
		FullScreenControl,
		GeoJSONSource,
		LineLayer,
		FillLayer,
		Popup,
		Marker,
	} from 'svelte-maplibre-gl';
	import { untrack } from 'svelte';
	import { createQuery, useIsFetching } from '@tanstack/svelte-query';
	import { useSearchParams } from 'runed/kit';
	import { type } from 'arktype';
	import { createMapStyleState, MAP_STYLE_IDS } from '$lib/utils/mapStyleToggle.svelte';
	import MapStyleToggle from '$lib/components/map/MapStyleToggle.svelte';
	import CyclewayLayer from '$lib/components/map/layers/CyclewayLayer.svelte';
	import OsmCyclewayLayer from '$lib/components/map/layers/OsmCyclewayLayer.svelte';
	import CyclewayLegendControl from '$lib/components/map/CyclewayLegendControl.svelte';
	import CommuneMapLayers from '$lib/components/map/CommuneMapLayers.svelte';
	import CommuneLayerToggles from '$lib/components/map/CommuneLayerToggles.svelte';
	import YearRangeFilter from '$lib/components/map/YearRangeFilter.svelte';
	import FeatureInfo from '$lib/components/map/FeatureInfo.svelte';
	import MapContextMenu from '$lib/components/map/MapContextMenu.svelte';
	import MobileDrawer from '$lib/components/MobileDrawer.svelte';
	import PanoramaxViewer from '$lib/components/PanoramaxViewer.svelte';
	import GeocoderMarker from '$lib/components/GeocoderMarker.svelte';
	import { loadDefaultProvider } from '$lib/config/navigationProviders';
	import {
		getAllLayerConfigs,
		getInteractableLayerIds,
		createLayerToFeatureTypeMap,
	} from '$lib/config/layers';
	import { filterFeaturesByYear, filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
	import { featureLineLengthMeters } from '$lib/utils/geoLength';
	import {
		toggleLegendId,
		voirieFeatureToLegendId,
		osmFeatureToLegendId,
		type LegendId,
	} from '$lib/utils/cyclewayLegend';
	import { osmCyclewaysQueryOptions, voirieQueryOptions } from '$lib/queries/cyclewayQueries';
	import type { FeatureCollection } from 'geojson';
	import type maplibregl from 'maplibre-gl';

	const MIN_YEAR = 2000;
	const MAX_YEAR = new Date().getFullYear();

	let {
		boundary,
		bounds,
	}: {
		boundary: FeatureCollection;
		bounds: [[number, number], [number, number]];
	} = $props();

	let map: maplibregl.Map | undefined = $state();
	let innerWidth = $state(0);

	$effect(() => {
		if (!map) return;
		const [sw, ne] = bounds;
		map.fitBounds(
			[
				[sw[0], sw[1]],
				[ne[0], ne[1]],
			],
			{ padding: 24, duration: 600 },
		);
	});

	const paramsSchema = type({
		layers: type('string[]').default(() => ['osm-cycleways']),
		mapStyle: type.enumerated(...MAP_STYLE_IDS).default(() => 'neutrino'),
		yearFrom: type('number').default(() => MIN_YEAR),
		yearTo: type('number').default(() => MAX_YEAR),
		cyclewayTypes: type('string[]').default(() => []),
		filterByYear: type('boolean').default(() => false),
	});

	const params = useSearchParams(paramsSchema, { pushHistory: false, noScroll: true });

	const yearRange = $derived<[number, number]>([params.yearFrom, params.yearTo]);
	const effectiveYearRange = $derived<[number, number] | undefined>(
		params.filterByYear ? yearRange : undefined,
	);

	const YEAR_INCOMPATIBLE_IDS = new Set(['osm-cycleways', 'velov', 'pumps', 'fountains']);

	function isLayerActive(id: string): boolean {
		if (!params.layers.includes(id)) return false;
		if (params.filterByYear && YEAR_INCOMPATIBLE_IDS.has(id)) return false;
		return true;
	}

	const effectiveLayers = $derived(params.layers.filter(isLayerActive));

	const layerToggleGroups = [
		{
			label: 'Aménagements cyclables',
			toggles: [
				{ id: 'cycleways', label: 'Grand Lyon' },
				{ id: 'osm-cycleways', label: 'OpenStreetMap', disableWhenYearFiltered: true },
				{ id: 'vl', label: 'Voies Lyonnaises' },
			],
		},
		{
			label: 'Autres',
			toggles: [
				{ id: 'velov', label: 'Vélo’v', disableWhenYearFiltered: true },
				{ id: 'parking', label: 'Stationnement' },
				{ id: 'pumps', label: 'Pompes', disableWhenYearFiltered: true },
				{ id: 'fountains', label: 'Fontaines', disableWhenYearFiltered: true },
			],
		},
	];

	const mapStyleState = createMapStyleState(params.mapStyle, (style) => {
		params.mapStyle = style;
	});

	$effect(() => {
		const pMapStyle = params.mapStyle;
		untrack(() => {
			if (pMapStyle !== mapStyleState.mapStyle) {
				mapStyleState.mapStyle = pMapStyle;
			}
		});
	});

	const voirieQuery = createQuery(() => voirieQueryOptions());

	const osmCyclewaysQuery = createQuery(() =>
		osmCyclewaysQueryOptions(isLayerActive('osm-cycleways')),
	);

	const layerQueryKeys: Record<string, unknown[]> = {
		cycleways: ['voirie-data'],
		'osm-cycleways': ['overpass-cycleways'],
		vl: ['voies-lyonnaises'],
		parking: ['parking'],
		velov: ['velov-availability'],
		pumps: ['pumps'],
		fountains: ['fountains'],
	};

	const fetchingCounts = {
		cycleways: useIsFetching({ queryKey: layerQueryKeys.cycleways }),
		'osm-cycleways': useIsFetching({ queryKey: layerQueryKeys['osm-cycleways'] }),
		vl: useIsFetching({ queryKey: layerQueryKeys.vl }),
		parking: useIsFetching({ queryKey: layerQueryKeys.parking }),
		velov: useIsFetching({ queryKey: layerQueryKeys.velov }),
		pumps: useIsFetching({ queryKey: layerQueryKeys.pumps }),
		fountains: useIsFetching({ queryKey: layerQueryKeys.fountains }),
	};

	const pendingLayers = $derived(
		(Object.keys(fetchingCounts) as (keyof typeof fetchingCounts)[]).filter(
			(id) => isLayerActive(id) && fetchingCounts[id].current > 0,
		),
	);

	const voirieBoundaryYearFiltered = $derived.by(() => {
		if (!voirieQuery.data) return undefined;
		let filtered = filterFeaturesInsideBoundary(voirieQuery.data, boundary);
		if (effectiveYearRange) {
			filtered = filterFeaturesByYear(filtered, 'anneelivraison', effectiveYearRange);
		}
		return filtered;
	});

	const voirieInside = $derived.by(() => {
		const filtered = voirieBoundaryYearFiltered;
		if (!filtered) return undefined;
		const activeTypes = params.cyclewayTypes ?? [];
		if (activeTypes.length === 0) return filtered;
		const allowed = new Set(activeTypes);
		return {
			...filtered,
			features: filtered.features.filter((f: any) => {
				const id = voirieFeatureToLegendId(f.properties);
				return id ? allowed.has(id) : false;
			}),
		};
	});

	function toggleCyclewayType(id: string) {
		params.cyclewayTypes = toggleLegendId(params.cyclewayTypes ?? [], id);
	}

	let hoveredLegendId: LegendId | null = $state(null);

	const osmInsideBoundary = $derived.by(() => {
		if (!osmCyclewaysQuery.data) return { type: 'FeatureCollection' as const, features: [] };
		return filterFeaturesInsideBoundary(osmCyclewaysQuery.data, boundary);
	});

	const lengthByLegendId = $derived.by(() => {
		const totals: Partial<Record<LegendId, number>> = {};
		if (isLayerActive('osm-cycleways') && osmCyclewaysQuery.data) {
			for (const f of osmInsideBoundary.features) {
				const id = osmFeatureToLegendId(f.properties);
				if (!id) continue;
				totals[id] = (totals[id] ?? 0) + featureLineLengthMeters(f);
			}
			return totals;
		}
		if (isLayerActive('cycleways') && voirieBoundaryYearFiltered) {
			for (const f of voirieBoundaryYearFiltered.features) {
				const id = voirieFeatureToLegendId(f.properties);
				if (!id) continue;
				const length = Number((f.properties as any)?.longueur) || 0;
				totals[id] = (totals[id] ?? 0) + length;
			}
		}
		return totals;
	});

	const layerToFeatureType = createLayerToFeatureTypeMap();
	const allConfigs = getAllLayerConfigs();

	function isConfigLayerVisible(configId: string): boolean {
		if (configId === 'cycleways') return isLayerActive('cycleways');
		if (configId === 'osm-cycleways') return isLayerActive('osm-cycleways');
		if (configId.startsWith('vl-') || configId === 'project-vl') return isLayerActive('vl');
		if (configId === 'velov') return isLayerActive('velov');
		if (configId.startsWith('parking-')) return isLayerActive('parking');
		if (configId === 'pumps') return isLayerActive('pumps');
		if (configId === 'water-fountains') return isLayerActive('fountains');
		return false;
	}

	let cursor: string | undefined = $state();
	let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
	let hoverPopupFeatures: { features: any[]; lngLat: { lng: number; lat: number } } | null =
		$state(null);
	let selectedFeatures: any[] = $state([]);
	let selectedLngLat: { lng: number; lat: number } | null = $state(null);
	let showPanoramax = $state(false);
	let hoveredPhotoLocation: { lng: number; lat: number } | null = $state(null);

	let contextMenuVisible = $state(false);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);
	let contextMenuLngLat: { lng: number; lat: number } | null = $state(null);
	let contextMenuPhotoLocation: { lng: number; lat: number } | null = $state(null);
	let defaultNavProvider = $state('osm');

	$effect(() => {
		defaultNavProvider = loadDefaultProvider();
	});

	function enrichFeatures(features: any[]) {
		return features
			.filter(
				(feature, index, self) =>
					index ===
					self.findIndex(
						(t) =>
							t.properties?.id === feature.properties?.id &&
							t.geometry.type === feature.geometry.type &&
							t.layer.id === feature.layer.id,
					),
			)
			.map((f) => {
				const baseLayerId = f.layer.id.replace('-hitarea', '');
				const config = allConfigs.find((c) => c.interactableLayerIds.includes(f.layer.id));
				const featureType =
					config?.featureType ||
					layerToFeatureType.get(f.layer.id) ||
					layerToFeatureType.get(baseLayerId) ||
					'default';
				return { ...f, type: featureType, config };
			});
	}

	function getInteractables(): string[] {
		if (!map) return [];
		return getInteractableLayerIds(isConfigLayerVisible).filter((id) => map!.getLayer(id));
	}

	function handleMapMouseMove(e: any) {
		if (!map) return;
		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
			hoverTimeout = null;
		}
		const interactableLayers = getInteractables();
		if (interactableLayers.length === 0) {
			hoverPopupFeatures = null;
			cursor = undefined;
			return;
		}
		const features = map.queryRenderedFeatures(e.point, { layers: interactableLayers });
		if (features.length > 0) {
			const enriched = enrichFeatures(features);
			if (enriched.length > 0) {
				cursor = 'pointer';
				const targetLngLat = e.lngLat;
				if (hoverPopupFeatures) {
					hoverPopupFeatures = { features: enriched, lngLat: targetLngLat };
				} else {
					hoverTimeout = setTimeout(() => {
						hoverPopupFeatures = { features: enriched, lngLat: targetLngLat };
					}, 200);
				}
				return;
			}
		}
		hoverPopupFeatures = null;
		cursor = undefined;
	}

	function handleMapMouseLeave() {
		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
			hoverTimeout = null;
		}
		hoverPopupFeatures = null;
		cursor = undefined;
	}

	function handleMapMoveStart() {
		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
			hoverTimeout = null;
		}
		hoverPopupFeatures = null;
		cursor = undefined;
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

	function handleMapClick(e: any) {
		if (!map) return;
		const interactableLayers = getInteractables();
		if (interactableLayers.length === 0) {
			selectedFeatures = [];
			selectedLngLat = null;
			return;
		}
		const features = map.queryRenderedFeatures(e.point, { layers: interactableLayers });
		if (features.length > 0) {
			const enriched = enrichFeatures(features);
			if (enriched.length > 0) {
				selectedFeatures = enriched;
				selectedLngLat = e.lngLat;
				return;
			}
		}
		selectedFeatures = [];
		selectedLngLat = null;
	}
</script>

<svelte:window bind:innerWidth />

<div class="relative h-[60vh] min-h-80 overflow-hidden rounded-lg shadow">
	{#if pendingLayers.length > 0}
		<div
			class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/40 backdrop-blur-[1px]"
			role="status"
			aria-live="polite"
		>
			<div
				class="pointer-events-auto flex items-center gap-3 rounded-full bg-white px-4 py-2 shadow-md"
			>
				<span
					class="block h-4 w-4 animate-spin rounded-full border-2 border-brand-navy border-t-transparent"
					aria-hidden="true"
				></span>
				<span class="text-sm font-medium text-brand-navy">Chargement…</span>
			</div>
		</div>
	{/if}

	{#if selectedFeatures.length > 0 && innerWidth >= 768}
		<div class="absolute top-3 left-3 z-20 max-w-sm">
			<FeatureInfo
				features={selectedFeatures}
				coordinates={selectedLngLat}
				onOpenPanoramax={() => (showPanoramax = true)}
				onPhotoHover={(loc: { lng: number; lat: number } | null) => (hoveredPhotoLocation = loc)}
				onClose={() => {
					selectedFeatures = [];
					selectedLngLat = null;
					hoveredPhotoLocation = null;
				}}
			/>
		</div>
	{/if}

	<MapLibre
		bind:map
		class="h-full w-full"
		style={mapStyleState.getMapStyleUrl()}
		{bounds}
		fitBoundsOptions={{ padding: 24 }}
		attributionControl={false}
		maxZoom={18}
		{cursor}
		onclick={handleMapClick}
		oncontextmenu={handleMapContextMenu}
		onmousemove={handleMapMouseMove}
		onmouseleave={handleMapMouseLeave}
		onmovestart={handleMapMoveStart}
		onzoomstart={handleMapMoveStart}
	>
		<AttributionControl compact={true} position="top-left" />
		<NavigationControl position="top-right" showCompass={false} />
		<FullScreenControl position="top-right" />
		<MapStyleToggle
			currentStyle={mapStyleState.mapStyle}
			onSelect={mapStyleState.setMapStyle}
			position="top-right"
		/>

		<GeoJSONSource id="commune-boundary" data={boundary}>
			<FillLayer id="commune-fill" paint={{ 'fill-color': '#1e3a5f', 'fill-opacity': 0.08 }} />
			<LineLayer
				id="commune-outline"
				paint={{ 'line-color': '#1e3a5f', 'line-width': 3, 'line-opacity': 0.9 }}
			/>
		</GeoJSONSource>

		{#if selectedLngLat}
			<Marker lnglat={selectedLngLat} />
		{/if}

		{#if hoveredPhotoLocation}
			<Marker lnglat={hoveredPhotoLocation} />
		{/if}

		{#if contextMenuPhotoLocation}
			<GeocoderMarker pulse={false} lnglat={contextMenuPhotoLocation} />
		{/if}

		{#if hoverPopupFeatures && hoverPopupFeatures.features.length > 0}
			<Popup lnglat={hoverPopupFeatures.lngLat} closeButton={false} closeOnClick={false}>
				<div class="flex max-h-64 animate-[fade-in_0.2s_ease-out] flex-col gap-2 overflow-y-auto">
					{#each hoverPopupFeatures.features as feature, i}
						{#if i > 0}
							<hr class="border-gray-200" />
						{/if}
						<div class="flex flex-col gap-1">
							{#if feature.config?.formatPopup}
								{@html feature.config.formatPopup(feature.properties, {
									isLayerVisible: isConfigLayerVisible,
								})}
							{:else}
								<span class="text-sm font-bold">
									{feature.properties.name ||
										feature.properties.nom ||
										feature.properties.label ||
										'Inconnu'}
								</span>
							{/if}
						</div>
					{/each}
				</div>
			</Popup>
		{/if}

		<CyclewayLayer
			isLayerVisible={(id) => id === 'cycleways' && isLayerActive('cycleways')}
			voirieData={voirieInside}
		/>

		<OsmCyclewayLayer
			isLayerVisible={(id) => id === 'osm-cycleways' && isLayerActive('osm-cycleways')}
			{boundary}
			activeLegendIds={params.cyclewayTypes}
			{hoveredLegendId}
		/>

		<CommuneMapLayers layers={effectiveLayers} {boundary} {map} yearRange={effectiveYearRange} />

		<CyclewayLegendControl
			activeIds={params.cyclewayTypes}
			onToggle={toggleCyclewayType}
			onHover={(id) => (hoveredLegendId = id)}
			{lengthByLegendId}
			position="bottom-left"
		/>
	</MapLibre>

	<MapContextMenu
		visible={contextMenuVisible}
		x={contextMenuX}
		y={contextMenuY}
		lngLat={contextMenuLngLat}
		{defaultNavProvider}
		onClose={closeContextMenu}
		onPhotoFound={(loc) => (contextMenuPhotoLocation = loc)}
	/>
</div>

{#if innerWidth < 768 && selectedFeatures.length > 0}
	<MobileDrawer
		open={true}
		snapPoints={[0.4, 0.8]}
		initialSnapPoint={0}
		onClose={() => {
			selectedFeatures = [];
			selectedLngLat = null;
		}}
	>
		<div class="p-0">
			<FeatureInfo
				features={selectedFeatures}
				coordinates={selectedLngLat}
				onOpenPanoramax={() => (showPanoramax = true)}
				onPhotoHover={(loc: { lng: number; lat: number } | null) => (hoveredPhotoLocation = loc)}
				onClose={() => {
					selectedFeatures = [];
					selectedLngLat = null;
					hoveredPhotoLocation = null;
				}}
			/>
		</div>
	</MobileDrawer>
{/if}

{#snippet yearFilterSlot()}
	<YearRangeFilter
		range={yearRange}
		min={MIN_YEAR}
		max={MAX_YEAR}
		plain
		onRangeChange={(next) => {
			params.yearFrom = next[0];
			params.yearTo = next[1];
		}}
	/>
{/snippet}

<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
	<CommuneLayerToggles
		bind:layers={params.layers}
		bind:filterByYear={params.filterByYear}
		groups={layerToggleGroups}
		{yearFilterSlot}
	/>
</div>

{#if showPanoramax && selectedLngLat}
	<PanoramaxViewer
		coordinates={[selectedLngLat.lng, selectedLngLat.lat]}
		onClose={() => (showPanoramax = false)}
	/>
{/if}
