<script lang="ts">
	import {
		MapLibre,
		AttributionControl,
		NavigationControl,
		FullScreenControl,
		CustomControl,
		GeoJSONSource,
		LineLayer,
		FillLayer,
		Popup,
		Marker,
		VectorTileSource,
	} from 'svelte-maplibre-gl';
	import { untrack } from 'svelte';
	import { createQuery, useIsFetching } from '@tanstack/svelte-query';
	import { useSearchParams } from 'runed/kit';
	import { type } from 'arktype';
	import { createMapStyleState, MAP_STYLE_IDS } from '$lib/utils/mapStyleToggle.svelte';
	import { ATTRIBUTION_OSM_OMT } from '$lib/config/mapAttribution';
	import MapLabels from '$lib/components/map/labels/MapLabels.svelte';
	import {
		LABEL_CATEGORIES,
		STYLE_LABEL_SUPPORT,
		type LabelCategory,
	} from '$lib/components/map/labels/labelLayers';
	import { type LabelVisibility } from '$lib/utils/mapPreferences.svelte';
	import { registerArrowIconsHandler } from '$lib/utils/mapUtils';
	import MapStyleToggle from '$lib/components/map/MapStyleToggle.svelte';
	import CyclewayLayer from '$lib/components/map/layers/CyclewayLayer.svelte';
	import OsmCyclewayLayer from '$lib/components/map/layers/OsmCyclewayLayer.svelte';
	import SpeedLimitsLayer from '$lib/components/map/layers/SpeedLimitsLayer.svelte';
	import CyclewayLegendControl from '$lib/components/map/CyclewayLegendControl.svelte';
	import SpeedLimitsControl from '$lib/components/map/SpeedLimitsControl.svelte';
	import CommuneMapLayers from '$lib/components/map/CommuneMapLayers.svelte';
	import VoiesLyonnaisesLayer from '$lib/components/map/layers/VoiesLyonnaisesLayer.svelte';
	import OverpassVLLayer from '$lib/components/map/layers/OverpassVLLayer.svelte';
	import CommuneLayerControls from '$lib/components/map/CommuneLayerControls.svelte';
	import YearRangeFilter from '$lib/components/map/YearRangeFilter.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import {
		availableLayers,
		expandLayers,
		compactLayers,
		layerGroups,
		loadVisibleOptionalCategories,
		saveVisibleOptionalCategories,
	} from '$lib/config/mapLayerCatalog';
	import CommuneLayerPills from '$lib/components/map/CommuneLayerPills.svelte';
	import FeatureInfo from '$lib/components/map/FeatureInfo.svelte';
	import MapContextMenu from '$lib/components/map/MapContextMenu.svelte';
	import MobileDrawer from '$lib/components/MobileDrawer.svelte';
	import PanoramaxViewer from '$lib/components/PanoramaxViewer.svelte';
	import GeocoderMarker from '$lib/components/GeocoderMarker.svelte';
	import PanelRightOpen from '@lucide/svelte/icons/panel-right-open';
	import PanelRightClose from '@lucide/svelte/icons/panel-right-close';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Maximize2 from '@lucide/svelte/icons/maximize-2';
	import Minimize2 from '@lucide/svelte/icons/minimize-2';
	import { loadDefaultProvider } from '$lib/config/navigationProviders';
	import {
		getAllLayerConfigs,
		getInteractableLayerIds,
		createLayerToFeatureTypeMap,
	} from '$lib/config/layers';
	import {
		EMPTY_FEATURE_COLLECTION,
		filterFeaturesByYear,
		filterFeaturesInsideBoundary,
	} from '$lib/utils/geoFilter';
	import { featureLineLengthMeters } from '$lib/utils/geoLength';
	import {
		toggleLegendId,
		toggleInclusion,
		soloInclusion,
		voirieFeatureToLegendId,
		osmFeatureToLegendId,
		DEFAULT_LEGEND_IDS,
		type LegendId,
	} from '$lib/utils/cyclewayLegend';
	import {
		osmCyclewaysQueryOptions,
		voirieQueryOptions,
		speedLimitsQueryOptions,
	} from '$lib/queries/cyclewayQueries';
	import { computeSpeedLimitsStats, SPEED_BUCKETS, type SpeedBucket } from '$lib/utils/speedLimits';
	import type { FeatureCollection } from 'geojson';
	import type maplibregl from 'maplibre-gl';

	// 1990 covers the oldest voies vertes in the dataset (e.g. Voie de la Dombes, 1996).
	// Features with no year value are kept regardless (see filterFeaturesByYear).
	const MIN_YEAR = 1990;
	const MAX_YEAR = new Date().getFullYear();

	let {
		boundary,
		bounds,
		communeName,
	}: {
		boundary: FeatureCollection;
		bounds: [[number, number], [number, number]];
		communeName?: string;
	} = $props();

	let map: maplibregl.Map | undefined = $state();
	let innerWidth = $state(0);
	let expanded = $state(false);
	let mapWrapper: HTMLDivElement | undefined = $state();

	const isDesktop = $derived(innerWidth === 0 || innerWidth >= 1024);

	function toggleMapExpand() {
		expanded = !expanded;
		setTimeout(() => {
			mapWrapper?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}, 200);
	}

	$effect(() => {
		expanded;
		sidebarCollapsed;
		if (!map) {
			return;
		}
		const id = setTimeout(() => map?.resize(), 320);
		return () => clearTimeout(id);
	});

	let mapInitialized = false;
	$effect(() => {
		const [sw, ne] = bounds;
		if (!map) {
			return;
		}

		if (!mapInitialized) {
			mapInitialized = true;
			const restoredFromUrl = untrack(() => {
				if (params.zoom > 0 && params.lat !== 0 && params.lng !== 0) {
					map!.jumpTo({ center: [params.lng, params.lat], zoom: params.zoom });
					return true;
				}
				return false;
			});
			if (restoredFromUrl) return;
		}

		map.fitBounds(
			[
				[sw[0], sw[1]],
				[ne[0], ne[1]],
			],
			{ padding: 24, duration: 600 },
		);
	});

	$effect(() => {
		if (!map) {
			return;
		}

		const m = map;
		const onMoveEnd = () => {
			const c = m.getCenter();
			params.lng = Number(c.lng.toFixed(5));
			params.lat = Number(c.lat.toFixed(5));
			params.zoom = Number(m.getZoom().toFixed(2));
		};

		m.on('moveend', onMoveEnd);

		return () => {
			m.off('moveend', onMoveEnd);
		};
	});

	const paramsSchema = type({
		layers: type('string[]').default(() => ['osm-cycleways', 'vl', 'parking']),
		mapStyle: type.enumerated(...MAP_STYLE_IDS).default(() => 'neutrino'),
		yearFrom: type('number').default(() => MIN_YEAR),
		yearTo: type('number').default(() => MAX_YEAR),
		cyclewayTypes: type('string[]').default(() => [...DEFAULT_LEGEND_IDS]),
		cyclewayReseau: type('string[]').default(() => []),
		cyclewayType: type('string[]').default(() => []),
		cyclewayLocalisation: type('string[]').default(() => []),
		targetNetworkHorizons: type('string[]').default(() => ['2030', '2035', '2040']),
		projectVLStatuses: type('string[]').default(() => ['wip', 'planned', 'postponed']),
		speedLimits: type('string[]').default(() => []),
		filterByYear: type('boolean').default(() => false),
		safety: type('boolean').default(() => false),
		safetyFilter: type('string[]').default(() => []),
		labelsOff: type('string[]').default(() => []),
		sidebar: type.enumerated('open', 'closed').default(() => 'closed'),
		zoom: type('number').default(() => 0),
		lat: type('number').default(() => 0),
		lng: type('number').default(() => 0),
	});

	const params = useSearchParams(paramsSchema, { pushHistory: false, noScroll: true });

	const sidebarHidden = $derived(params.sidebar === 'closed');
	const sidebarCollapsed = $derived(sidebarHidden && isDesktop);

	function toggleSidebar() {
		params.sidebar = sidebarHidden ? 'open' : 'closed';
	}

	const safetyMode = $derived(params.safety);

	const SAFETY_KEYS = ['safe', 'unsafe', 'pedestrian'] as const;
	type SafetyKey = (typeof SAFETY_KEYS)[number];

	const safetyFilter = $derived<SafetyKey[]>(
		(params.safetyFilter ?? []).filter((k): k is SafetyKey =>
			(SAFETY_KEYS as readonly string[]).includes(k),
		),
	);
	let hoveredSafety = $state<SafetyKey | null>(null);

	function toggleSafetyFilter(key: SafetyKey) {
		params.safetyFilter = toggleInclusion(safetyFilter, key, SAFETY_KEYS);
	}

	function soloSafetyFilter(key: SafetyKey) {
		params.safetyFilter = soloInclusion(safetyFilter, key);
	}

	$effect(() => {
		if (!safetyMode) {
			if ((params.safetyFilter ?? []).length > 0) {
				params.safetyFilter = [];
			}

			hoveredSafety = null;
		}
	});

	let visibleOptional = $state<Set<string>>(new Set());
	$effect(() => {
		visibleOptional = loadVisibleOptionalCategories();
	});

	const labelVisibility = $derived<LabelVisibility>(
		LABEL_CATEGORIES.reduce((acc, cat) => {
			acc[cat] = !(params.labelsOff ?? []).includes(cat);
			return acc;
		}, {} as LabelVisibility),
	);

	function setLabelVisibility(next: LabelVisibility) {
		params.labelsOff = LABEL_CATEGORIES.filter((cat) => !next[cat]);
	}

	const LABEL_PREFIX = 'label-';
	function labelIdToCategory(id: string): LabelCategory | null {
		if (!id.startsWith(LABEL_PREFIX)) return null;
		const cat = id.slice(LABEL_PREFIX.length);
		return (LABEL_CATEGORIES as readonly string[]).includes(cat) ? (cat as LabelCategory) : null;
	}

	function isLayerAllowed(id: string): boolean {
		const labelCat = labelIdToCategory(id);
		if (!labelCat) return true;
		return supportedLabelCategories.has(labelCat);
	}
	function toggleOptionalCategory(category: string) {
		const next = new Set(visibleOptional);
		if (next.has(category)) next.delete(category);
		else next.add(category);
		visibleOptional = next;
		saveVisibleOptionalCategories(next);
	}

	const yearRange = $derived<[number, number]>([params.yearFrom, params.yearTo]);
	const effectiveYearRange = $derived<[number, number] | undefined>(
		params.filterByYear ? yearRange : undefined,
	);

	const YEAR_COMPATIBLE_FINE_IDS = new Set<string>([
		'cycleways',
		...layerGroups.vl,
		...layerGroups.parking,
	]);

	const visibleSet = $derived(new Set(expandLayers(params.layers)));

	function isFineActive(id: string): boolean {
		const labelCat = labelIdToCategory(id);
		if (labelCat) {
			return labelVisibility[labelCat] && supportedLabelCategories.has(labelCat);
		}
		if (!visibleSet.has(id)) return false;
		if (params.filterByYear && !YEAR_COMPATIBLE_FINE_IDS.has(id)) return false;
		return true;
	}

	function isCategoryActive(category: string): boolean {
		for (const layer of availableLayers) {
			if (layer.category === category && isFineActive(layer.id)) return true;
		}
		return false;
	}

	function isLayerActive(id: string): boolean {
		if (id === 'vl') return isCategoryActive('Voies Lyonnaises');
		if (id === 'osm-vl') return isCategoryActive('Voies Lyonnaises (OSM)');
		if (id === 'parking') return isCategoryActive('Stationnements');
		if (id === 'speed-limits') return isCategoryActive('Limitations de vitesse');
		if (id === 'fountains') return isFineActive('water-fountains');
		return isFineActive(id);
	}

	const effectiveVisibleSet = $derived(new Set([...visibleSet].filter((id) => isFineActive(id))));

	function setLayers(fine: string[]) {
		params.layers = compactLayers(fine);
	}

	function toggleLayer(id: string) {
		const labelCat = labelIdToCategory(id);
		if (labelCat) {
			setLabelVisibility({ ...labelVisibility, [labelCat]: !labelVisibility[labelCat] });
			return;
		}
		const next = new Set(visibleSet);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setLayers([...next]);
	}

	function toggleCategory(category: string) {
		const layerIds = availableLayers.filter((l) => l.category === category).map((l) => l.id);
		const labelCats = layerIds
			.map((id) => labelIdToCategory(id))
			.filter((c): c is LabelCategory => c !== null);

		if (labelCats.length === layerIds.length && labelCats.length > 0) {
			const supportedCats = labelCats.filter((c) => supportedLabelCategories.has(c));
			const allOn = supportedCats.every((c) => labelVisibility[c]);
			const next = { ...labelVisibility };
			for (const c of supportedCats) next[c] = !allOn;
			setLabelVisibility(next);
			return;
		}

		const allOn = layerIds.every((id) => visibleSet.has(id));
		const next = new Set(visibleSet);
		if (allOn) layerIds.forEach((id) => next.delete(id));
		else layerIds.forEach((id) => next.add(id));
		setLayers([...next]);
	}

	function deactivateCategory(category: string) {
		const layerIds = availableLayers.filter((l) => l.category === category).map((l) => l.id);
		const labelCats = layerIds
			.map((id) => labelIdToCategory(id))
			.filter((c): c is LabelCategory => c !== null);

		if (labelCats.length === layerIds.length && labelCats.length > 0) {
			const next = { ...labelVisibility };
			for (const c of labelCats) next[c] = false;
			setLabelVisibility(next);
			return;
		}

		const next = new Set(visibleSet);
		for (const id of layerIds) {
			next.delete(id);
		}

		setLayers([...next]);
	}

	let layersBeforeYearFilter: string[] | null = $state(null);

	function setFilterByYear(on: boolean) {
		if (on === params.filterByYear) return;
		if (on) {
			layersBeforeYearFilter = [...params.layers];
			const next = new Set(visibleSet);
			next.add('cycleways');
			for (const id of layerGroups.parking) next.add(id);
			for (const id of layerGroups.vl) next.add(id);
			setLayers([...next]);
			params.filterByYear = true;
			if (params.safety) {
				params.safety = false;
			}
		} else {
			params.filterByYear = false;
			if (layersBeforeYearFilter) {
				params.layers = layersBeforeYearFilter;
				layersBeforeYearFilter = null;
			}
		}
	}

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

	const supportedLabelCategories = $derived<Set<LabelCategory>>(
		new Set(STYLE_LABEL_SUPPORT[mapStyleState.mapStyle] ?? LABEL_CATEGORIES),
	);

	const effectiveLabelVisibility = $derived<LabelVisibility>(
		LABEL_CATEGORIES.reduce((acc, cat) => {
			acc[cat] = labelVisibility[cat] && supportedLabelCategories.has(cat);
			return acc;
		}, {} as LabelVisibility),
	);

	const voirieQuery = createQuery(() => voirieQueryOptions());

	const osmCyclewaysQuery = createQuery(() =>
		osmCyclewaysQueryOptions(isLayerActive('osm-cycleways')),
	);

	const speedLimitsQuery = createQuery(() =>
		speedLimitsQueryOptions(isLayerActive('speed-limits')),
	);

	const layerQueryKeys: Record<string, unknown[]> = {
		cycleways: ['voirie-data'],
		'osm-cycleways': ['overpass-cycleways'],
		'speed-limits': ['speed-limits'],
		vl: ['voies-lyonnaises'],
		parking: ['parking'],
		velov: ['velov-availability'],
		pumps: ['pumps'],
		fountains: ['fountains'],
	};

	const fetchingCounts = {
		cycleways: useIsFetching({ queryKey: layerQueryKeys.cycleways }),
		'osm-cycleways': useIsFetching({ queryKey: layerQueryKeys['osm-cycleways'] }),
		'speed-limits': useIsFetching({ queryKey: layerQueryKeys['speed-limits'] }),
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

	const voirieBoundary = $derived.by(() => {
		if (!voirieQuery.data) return undefined;
		return filterFeaturesInsideBoundary(voirieQuery.data, boundary);
	});

	// Slider lower bound: oldest realistic delivery year actually present in this commune.
	// Falls back to MIN_YEAR while the data is loading or when the commune has no dated feature.
	const sliderMinYear = $derived.by(() => {
		const fc = voirieBoundary;
		if (!fc || fc.features.length === 0) return MIN_YEAR;
		let oldest: number | null = null;
		for (const f of fc.features) {
			const v = (f.properties as Record<string, unknown> | null)?.anneelivraison;
			if (v == null || v === '') continue;
			const n = typeof v === 'number' ? v : Number(v);
			if (!Number.isFinite(n) || n < 1900) continue;
			if (oldest === null || n < oldest) oldest = n;
		}
		return oldest ?? MIN_YEAR;
	});

	const voirieBoundaryYearFiltered = $derived.by(() => {
		if (!voirieBoundary) return undefined;
		if (!effectiveYearRange) return voirieBoundary;
		return filterFeaturesByYear(voirieBoundary, 'anneelivraison', effectiveYearRange);
	});

	const voirieInside = $derived.by(() => {
		const filtered = voirieBoundaryYearFiltered;
		if (!filtered) return undefined;
		const activeLegendTypes = params.cyclewayTypes ?? [];
		const reseauFilters = params.cyclewayReseau ?? [];
		const typeFilters = params.cyclewayType ?? [];
		const localisationFilters = params.cyclewayLocalisation ?? [];
		const hasLegend = activeLegendTypes.length > 0;
		const hasSubFilters =
			reseauFilters.length > 0 || typeFilters.length > 0 || localisationFilters.length > 0;
		if (!hasLegend && !hasSubFilters) return filtered;
		const allowedLegend = new Set(activeLegendTypes);
		return {
			...filtered,
			features: filtered.features.filter((f: any) => {
				const props = f.properties ?? {};
				if (hasLegend) {
					const id = voirieFeatureToLegendId(props);
					if (!id || !allowedLegend.has(id)) return false;
				}
				if (reseauFilters.length > 0 && !reseauFilters.includes(props.reseau)) return false;
				if (typeFilters.length > 0 && !typeFilters.includes(props.typeamenagement)) return false;
				if (localisationFilters.length > 0 && !localisationFilters.includes(props.localisation)) {
					return false;
				}
				return true;
			}),
		};
	});

	function toggleCyclewayType(id: string) {
		params.cyclewayTypes = toggleLegendId(params.cyclewayTypes ?? [], id);
	}

	function soloCyclewayType(id: string) {
		params.cyclewayTypes = soloInclusion(params.cyclewayTypes ?? [], id);
	}

	function toggleCyclewayReseau(value: string) {
		const current = [...(params.cyclewayReseau ?? [])];
		const i = current.indexOf(value);
		if (i >= 0) current.splice(i, 1);
		else current.push(value);
		params.cyclewayReseau = current;
	}

	function toggleCyclewayTypeFilter(value: string) {
		const current = [...(params.cyclewayType ?? [])];
		const i = current.indexOf(value);
		if (i >= 0) current.splice(i, 1);
		else current.push(value);
		params.cyclewayType = current;
	}

	function toggleCyclewayLocalisation(value: string) {
		const current = [...(params.cyclewayLocalisation ?? [])];
		const i = current.indexOf(value);
		if (i >= 0) current.splice(i, 1);
		else current.push(value);
		params.cyclewayLocalisation = current;
	}

	function isCyclewayReseauSelected(value: string): boolean {
		return (params.cyclewayReseau ?? []).includes(value);
	}
	function isCyclewayTypeSelected(value: string): boolean {
		return (params.cyclewayType ?? []).includes(value);
	}
	function isCyclewayLocalisationSelected(value: string): boolean {
		return (params.cyclewayLocalisation ?? []).includes(value);
	}

	let hoveredLegendId: LegendId | null = $state(null);

	const selectedSpeedBuckets = $derived<SpeedBucket[]>(
		(params.speedLimits ?? []).filter((b): b is SpeedBucket =>
			(SPEED_BUCKETS as string[]).includes(b),
		),
	);

	function toggleSpeedBucket(bucket: SpeedBucket) {
		const set = new Set(selectedSpeedBuckets);
		if (set.has(bucket)) set.delete(bucket);
		else set.add(bucket);
		params.speedLimits = [...set];
	}

	function resetSpeedBuckets() {
		params.speedLimits = [];
	}

	const speedLimitsInsideBoundary = $derived.by(() => {
		if (!speedLimitsQuery.data) return undefined;
		return filterFeaturesInsideBoundary(speedLimitsQuery.data, boundary);
	});

	const speedLimitsStats = $derived(computeSpeedLimitsStats(speedLimitsInsideBoundary?.features));

	const osmInsideBoundary = $derived.by(() => {
		if (!osmCyclewaysQuery.data) return EMPTY_FEATURE_COLLECTION;
		return filterFeaturesInsideBoundary(osmCyclewaysQuery.data, boundary);
	});

	const lengthByLegendId = $derived.by(() => {
		const totals: Partial<Record<LegendId, number>> = {};
		if (isLayerActive('osm-cycleways') && osmCyclewaysQuery.data) {
			const allowed = safetyFilter.length > 0 ? new Set(safetyFilter) : null;
			// dedupe bike lanes/ shared bus bus paths
			const seen = new Set<string>();
			for (const f of osmInsideBoundary.features) {
				const props = f.properties as any;
				if (allowed) {
					const isPedestrian =
						props?.typeamenagement === 'Voie verte' ||
						props?.typeamenagement === 'Voie piétonne (vélos autorisés)';
					const bucket: SafetyKey = isPedestrian ? 'pedestrian' : props?.isSafe ? 'safe' : 'unsafe';
					if (!allowed.has(bucket)) continue;
				}

				const id = osmFeatureToLegendId(props);
				if (!id) {
					continue;
				}

				const key = `${props?.osmId}:${props?.typeamenagement}`;
				if (seen.has(key)) {
					continue;
				}
				seen.add(key);
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

	const safetyLengths = $derived.by(() => {
		let safe = 0;
		let unsafe = 0;
		let pedestrian = 0;
		if (isLayerActive('osm-cycleways') && osmCyclewaysQuery.data) {
			const seen = new Set<string>();
			for (const f of osmInsideBoundary.features) {
				const props = f.properties as any;
				const id = osmFeatureToLegendId(props);
				if (!id) {
					continue;
				}
				const key = `${props?.osmId}:${props?.typeamenagement}`;
				if (seen.has(key)) {
					continue;
				}
				seen.add(key);

				const len = featureLineLengthMeters(f);
				const isPedestrian =
					props?.typeamenagement === 'Voie verte' ||
					props?.typeamenagement === 'Voie piétonne (vélos autorisés)';
				if (isPedestrian) {
					pedestrian += len;
				} else if (props?.isSafe) {
					safe += len;
				} else {
					unsafe += len;
				}
			}
		}
		return { safe, unsafe, pedestrian };
	});

	const outsideMask = $derived.by<FeatureCollection>(() => {
		const worldRing: [number, number][] = [
			[-180, -85],
			[180, -85],
			[180, 85],
			[-180, 85],
			[-180, -85],
		];
		const holes: [number, number][][] = [];
		for (const feature of boundary.features) {
			const geom = feature.geometry;
			if (geom.type === 'Polygon') {
				holes.push(geom.coordinates[0] as [number, number][]);
			} else if (geom.type === 'MultiPolygon') {
				for (const polygon of geom.coordinates) {
					holes.push(polygon[0] as [number, number][]);
				}
			}
		}
		return {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					properties: {},
					geometry: {
						type: 'Polygon',
						coordinates: [worldRing, ...holes],
					},
				},
			],
		};
	});

	const layerToFeatureType = createLayerToFeatureTypeMap();
	const allConfigs = getAllLayerConfigs();

	function isConfigLayerVisible(configId: string): boolean {
		if (configId === 'speed-limits') return isCategoryActive('Limitations de vitesse');
		if (configId === 'project-vl') return isCategoryActive('Voies Lyonnaises');
		return isFineActive(configId);
	}

	let cursor: string | undefined = $state();
	let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
	let hoverPopupFeatures: { features: any[]; lngLat: { lng: number; lat: number } } | null =
		$state(null);
	let hoveredCyclewayId = $state<string | number | null>(null);
	let hoveredOsmCyclewayId = $state<string | number | null>(null);
	let selectedFeatures: any[] = $state([]);
	let selectedLngLat: { lng: number; lat: number } | null = $state(null);
	let showPanoramax = $state(false);
	let hoveredPhotoLocation: { lng: number; lat: number } | null = $state(null);
	let isMapMoving = false;
	let pendingMouseMove: { point: any; lngLat: any } | null = null;
	let mouseMoveRaf: number | null = null;

	$effect(() => {
		if (!map) {
			return;
		}

		const m = map;

		const onStart = () => {
			isMapMoving = true;
			if (hoverTimeout) {
				clearTimeout(hoverTimeout);
				hoverTimeout = null;
			}
			if (mouseMoveRaf !== null) {
				cancelAnimationFrame(mouseMoveRaf);
				mouseMoveRaf = null;
				pendingMouseMove = null;
			}
			hoverPopupFeatures = null;
			hoveredCyclewayId = null;
			hoveredOsmCyclewayId = null;
			cursor = undefined;
		};

		const onEnd = () => {
			isMapMoving = false;
		};

		m.on('movestart', onStart);
		m.on('zoomstart', onStart);
		m.on('moveend', onEnd);
		m.on('zoomend', onEnd);

		return () => {
			m.off('movestart', onStart);
			m.off('zoomstart', onStart);
			m.off('moveend', onEnd);
			m.off('zoomend', onEnd);
		};
	});

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

	const interactableLayerIds = $derived(getInteractableLayerIds(isConfigLayerVisible));

	function getInteractables(): string[] {
		if (!map) return [];
		const m = map;
		return interactableLayerIds.filter((id) => m.getLayer(id));
	}

	function processMouseMove(point: any, lngLat: any) {
		if (!map) return;
		const interactableLayers = getInteractables();
		if (interactableLayers.length === 0) {
			hoverPopupFeatures = null;
			hoveredCyclewayId = null;
			hoveredOsmCyclewayId = null;
			cursor = undefined;
			return;
		}
		const features = map.queryRenderedFeatures(point, { layers: interactableLayers });

		const cyclewayHover = features.find((f: any) => f.layer.id === 'cycleways-layer-hitarea');
		const osmCyclewayHover = features.find(
			(f: any) => f.layer.id === 'osm-cycleways-layer-hitarea',
		);

		const nextCyclewayId = (cyclewayHover?.id as string | number | undefined) ?? null;
		const nextOsmCyclewayId = (osmCyclewayHover?.id as string | number | undefined) ?? null;

		if (nextCyclewayId !== hoveredCyclewayId) {
			hoveredCyclewayId = nextCyclewayId;
		}

		if (nextOsmCyclewayId !== hoveredOsmCyclewayId) {
			hoveredOsmCyclewayId = nextOsmCyclewayId;
		}

		if (features.length > 0) {
			const zoom = map.getZoom();
			const enriched = enrichFeatures(features).filter(
				(f: any) => !(f.config?.minZoomPopup && zoom < f.config.minZoomPopup),
			);
			if (enriched.length > 0) {
				cursor = 'pointer';
				if (hoverPopupFeatures) {
					hoverPopupFeatures = { features: enriched, lngLat };
				} else {
					if (hoverTimeout) clearTimeout(hoverTimeout);
					hoverTimeout = setTimeout(() => {
						hoverPopupFeatures = { features: enriched, lngLat };
					}, 200);
				}
				return;
			}
		}

		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
			hoverTimeout = null;
		}

		hoverPopupFeatures = null;
		cursor = undefined;
	}

	function handleMapMouseMove(e: any) {
		if (!map || isMapMoving) {
			return;
		}

		pendingMouseMove = { point: e.point, lngLat: e.lngLat };

		if (mouseMoveRaf !== null) {
			return;
		}

		mouseMoveRaf = requestAnimationFrame(() => {
			mouseMoveRaf = null;
			const pending = pendingMouseMove;
			pendingMouseMove = null;
			if (pending) processMouseMove(pending.point, pending.lngLat);
		});
	}

	function handleMapMouseLeave() {
		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
			hoverTimeout = null;
		}
		if (mouseMoveRaf !== null) {
			cancelAnimationFrame(mouseMoveRaf);
			mouseMoveRaf = null;
			pendingMouseMove = null;
		}
		hoverPopupFeatures = null;
		hoveredCyclewayId = null;
		hoveredOsmCyclewayId = null;
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

<div class="lg:flex lg:items-stretch lg:gap-4 lg:px-4 xl:px-6">
	<div class="flex flex-col gap-3 lg:min-w-0 lg:flex-1">
		<div
			bind:this={mapWrapper}
			class="relative {expanded
				? 'h-[90vh] min-h-[600px]'
				: 'h-[68vh] min-h-[22rem]'} overflow-hidden rounded-lg shadow transition-[height] duration-300"
		>
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

			<CommuneLayerPills
				{visibleOptional}
				filterByYear={params.filterByYear}
				{isFineActive}
				{isCategoryActive}
				{toggleLayer}
				{toggleCategory}
				{deactivateCategory}
				onOpenSidebar={sidebarHidden ? toggleSidebar : undefined}
			/>

			{#if selectedFeatures.length > 0 && innerWidth >= 768}
				<div class="absolute top-3 left-3 z-20 max-w-sm">
					<FeatureInfo
						features={selectedFeatures}
						coordinates={selectedLngLat}
						onOpenPanoramax={() => (showPanoramax = true)}
						onPhotoHover={(loc: { lng: number; lat: number } | null) =>
							(hoveredPhotoLocation = loc)}
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
				minZoom={9}
				maxZoom={18}
				{cursor}
				onload={() => {
					if (map) {
						registerArrowIconsHandler(map);
						const keepMaskOnTop = () => {
							if (map?.getLayer('commune-outside-mask-fill')) {
								map.moveLayer('commune-outside-mask-fill');
							}
							if (map?.getLayer('commune-outline')) {
								map.moveLayer('commune-outline');
							}
						};
						keepMaskOnTop();
						map.on('styledata', keepMaskOnTop);
					}
				}}
				onclick={handleMapClick}
				oncontextmenu={handleMapContextMenu}
				onmousemove={handleMapMouseMove}
				onmouseleave={handleMapMouseLeave}
			>
				<AttributionControl compact={true} position="top-left" />
				<NavigationControl position="top-right" showCompass={false} />
				<FullScreenControl position="top-right" />
				<MapStyleToggle
					currentStyle={mapStyleState.mapStyle}
					onSelect={mapStyleState.setMapStyle}
					position="top-right"
				/>

				{#if isLayerActive('osm-cycleways')}
					<CustomControl position="top-right">
						<button
							type="button"
							onclick={() => (params.safety = !params.safety)}
							class="rounded-lg pl-1! shadow-md focus:ring-2 focus:ring-blue-500 focus:outline-none {safetyMode
								? 'bg-blue-600! text-white! hover:bg-blue-700!'
								: 'bg-white! text-gray-700! hover:bg-gray-50!'}"
							aria-pressed={safetyMode}
							aria-label={safetyMode ? 'Désactiver le mode sécurité' : 'Activer le mode sécurité'}
							title={safetyMode
								? 'Mode sécurité activé (bleu = sûr, rouge = non sûr)'
								: 'Colorer par sécurité (sûr / non sûr)'}
						>
							<ShieldCheck size={20} />
						</button>
					</CustomControl>
				{/if}

				{#if isDesktop}
					<CustomControl position="top-right">
						<button
							type="button"
							onclick={toggleSidebar}
							class="rounded-lg bg-white pl-1! shadow-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							aria-label={sidebarHidden ? 'Afficher les calques' : 'Masquer les calques'}
							title={sidebarHidden ? 'Afficher les calques' : 'Masquer les calques'}
						>
							{#if sidebarHidden}
								<PanelRightOpen size={20} />
							{:else}
								<PanelRightClose size={20} />
							{/if}
						</button>
					</CustomControl>
				{/if}

				<GeoJSONSource id="commune-outside-mask" data={outsideMask}>
					<FillLayer
						id="commune-outside-mask-fill"
						paint={{ 'fill-color': '#ffffff', 'fill-opacity': 0.5 }}
					/>
				</GeoJSONSource>

				<GeoJSONSource id="commune-boundary" data={boundary}>
					<FillLayer id="commune-fill" paint={{ 'fill-color': '#1e3a5f', 'fill-opacity': 0.02 }} />
					<LineLayer
						id="commune-outline"
						paint={{
							'line-color': '#3a3a3a',
							'line-width': 2,
							'line-opacity': 0.9,
							'line-dasharray': [4, 2, 1, 2],
						}}
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
						<div
							class="flex max-h-64 animate-[fade-in_0.2s_ease-out] flex-col gap-2 overflow-y-auto"
						>
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

				<VoiesLyonnaisesLayer
					isLayerVisible={isLayerActive}
					{map}
					{boundary}
					yearRange={effectiveYearRange}
				/>

				<OverpassVLLayer isLayerVisible={isLayerActive} {map} {boundary} />

				<CyclewayLayer
					isLayerVisible={(id) => id === 'cycleways' && isLayerActive('cycleways')}
					voirieData={voirieInside}
					hoveredFeatureId={hoveredCyclewayId}
				/>

				<OsmCyclewayLayer
					isLayerVisible={(id) => id === 'osm-cycleways' && isLayerActive('osm-cycleways')}
					{boundary}
					activeLegendIds={params.cyclewayTypes}
					{hoveredLegendId}
					{map}
					{safetyMode}
					{safetyFilter}
					{hoveredSafety}
					hoveredFeatureId={hoveredOsmCyclewayId}
				/>

				<SpeedLimitsLayer
					isLayerVisible={(id) => id === 'speed-limits' && isLayerActive('speed-limits')}
					{boundary}
					selectedBuckets={selectedSpeedBuckets}
				/>

				<VectorTileSource
					id="osm-vector"
					url="https://tiles.openfreemap.org/planet"
					attribution={ATTRIBUTION_OSM_OMT}
				/>

				<CommuneMapLayers
					visible={effectiveVisibleSet}
					{boundary}
					{map}
					yearRange={effectiveYearRange}
					targetNetworkHorizons={params.targetNetworkHorizons}
				/>

				<MapLabels show={effectiveLabelVisibility} />

				<CyclewayLegendControl
					activeIds={params.cyclewayTypes}
					onToggle={toggleCyclewayType}
					onSolo={soloCyclewayType}
					onHover={(id) => (hoveredLegendId = id)}
					{lengthByLegendId}
					{safetyMode}
					{safetyLengths}
					activeSafety={safetyFilter}
					onToggleSafety={toggleSafetyFilter}
					onSoloSafety={soloSafetyFilter}
					onHoverSafety={(key) => (hoveredSafety = key)}
					position="bottom-left"
				/>

				{#if isLayerActive('speed-limits')}
					<SpeedLimitsControl
						selected={selectedSpeedBuckets}
						stats={speedLimitsStats}
						onToggle={toggleSpeedBucket}
						onReset={resetSpeedBuckets}
						position="bottom-right"
					/>
				{/if}
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

		<div class="space-y-2 px-4 sm:px-6 lg:px-0">
			<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
				<div class="flex items-center gap-2">
					<Checkbox
						id="filter-by-year-toggle"
						checked={params.filterByYear}
						onCheckedChange={(checked) => setFilterByYear(checked === true)}
					/>
					<Label for="filter-by-year-toggle" class="cursor-pointer text-sm text-gray-700">
						Filtrer par date de réalisation
					</Label>
				</div>
				<button
					type="button"
					onclick={toggleMapExpand}
					title={expanded ? 'Réduire la carte' : 'Agrandir la carte'}
					aria-label={expanded ? 'Réduire la carte' : 'Agrandir la carte'}
					class="ml-auto flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
				>
					{#if expanded}
						<Minimize2 size={13} />
						<span class="hidden sm:inline">Réduire la carte</span>
					{:else}
						<Maximize2 size={13} />
						<span class="hidden sm:inline">Agrandir la carte</span>
					{/if}
				</button>
			</div>
			{#if params.filterByYear}
				<div class="max-w-md">
					{@render yearFilterSlot()}
				</div>
				<p class="text-[11px] text-gray-500">
					Source&nbsp;:&nbsp;<a
						href="https://data.grandlyon.com/portail/fr/jeux-de-donnees/amenagements-cyclables-metropole-lyon/donnees"
						target="_blank"
						rel="noopener"
						class="underline hover:text-brand-navy">data.grandlyon.com</a
					>. Les données peuvent varier légèrement des données OSM affichées par défaut sur la
					carte.
				</p>
			{/if}
		</div>
	</div>

	{#if isDesktop && !sidebarHidden}
		<aside
			class="lg:mt-0 lg:w-80 lg:flex-shrink-0 lg:self-start lg:overflow-y-auto {expanded
				? 'lg:max-h-[90vh]'
				: 'lg:max-h-[68vh]'}"
		>
			<CommuneLayerControls
				{visibleOptional}
				{toggleOptionalCategory}
				{isFineActive}
				{isCategoryActive}
				{toggleLayer}
				{toggleCategory}
				{toggleCyclewayReseau}
				toggleCyclewayType={toggleCyclewayTypeFilter}
				{toggleCyclewayLocalisation}
				{isCyclewayReseauSelected}
				{isCyclewayTypeSelected}
				{isCyclewayLocalisationSelected}
				{isLayerAllowed}
				reactivityKey={mapStyleState.mapStyle}
			/>
		</aside>
	{/if}
</div>

{#if !isDesktop}
	<MobileDrawer
		open={!sidebarHidden}
		snapPoints={[0.5, 0.9]}
		initialSnapPoint={1}
		onClose={() => (params.sidebar = 'closed')}
	>
		<div class="px-2 pb-4">
			<CommuneLayerControls
				{visibleOptional}
				{toggleOptionalCategory}
				{isFineActive}
				{isCategoryActive}
				{toggleLayer}
				{toggleCategory}
				{isLayerAllowed}
				reactivityKey={mapStyleState.mapStyle}
			/>
		</div>
	</MobileDrawer>
{/if}

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
		min={sliderMinYear}
		max={MAX_YEAR}
		plain
		onRangeChange={(next) => {
			params.yearFrom = next[0];
			params.yearTo = next[1];
		}}
	/>
{/snippet}

{#if showPanoramax && selectedLngLat}
	<PanoramaxViewer
		coordinates={[selectedLngLat.lng, selectedLngLat.lat]}
		onClose={() => (showPanoramax = false)}
	/>
{/if}
