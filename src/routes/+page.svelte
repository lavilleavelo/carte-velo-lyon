<script lang="ts">
	import '../app.css';
	import { onMount, untrack } from 'svelte';
	import { type } from 'arktype';
	import { useSearchParams } from 'runed/kit';

	import {
		MapLibre,
		AttributionControl,
		GeolocateControl,
		NavigationControl,
		Marker,
		Popup,
	} from 'svelte-maplibre-gl';
	import maplibregl from 'maplibre-gl';
	import Filter from '@lucide/svelte/icons/filter';
	import Settings from '@lucide/svelte/icons/settings';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import MapContextMenu from '$lib/components/map/MapContextMenu.svelte';
	import FilterPanel from '$lib/components/map/FilterPanel.svelte';
	import FeatureInfo from '$lib/components/map/FeatureInfo.svelte';
	import MobileDrawer from '$lib/components/MobileDrawer.svelte';
	import PanoramaxViewer from '$lib/components/PanoramaxViewer.svelte';
	import MapStyleToggle from '$lib/components/map/MapStyleToggle.svelte';
	import { createMapStyleState, type MapStyle } from '$lib/utils/mapStyleToggle.svelte';
	import {
		getAllLayerConfigs,
		getInteractableLayerIds,
		createLayerToFeatureTypeMap,
	} from '$lib/config/layers';

	import { createQuery } from '@tanstack/svelte-query';
	import Geocoder from '$lib/components/Geocoder.svelte';
	import GeocoderMarker from '$lib/components/GeocoderMarker.svelte';
	import { vlColors } from '$lib/utils/mapUtils';

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
	import CyclewayFilters from '$lib/components/map/filters/CyclewayFilters.svelte';
	import TargetNetworkLayer from '$lib/components/map/layers/TargetNetworkLayer.svelte';
	import TargetNetworkFilters from '$lib/components/map/filters/TargetNetworkFilters.svelte';
	import ProjectVLFilters from '$lib/components/map/filters/ProjectVLFilters.svelte';
	import OverpassVLLayer from '$lib/components/map/layers/OverpassVLLayer.svelte';
	import { createQuickFilterState } from '$lib/config/quickFilters.svelte';

	const voirieQuery = createQuery(() => ({
		queryKey: ['voirie-data'],
		queryFn: async () => {
			const response = await fetch('/api/grandlyon/voirie');
			if (!response.ok) {
				throw new Error('Failed to fetch voirie data');
			}
			return response.json();
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
	}));

	const layerToFeatureType = createLayerToFeatureTypeMap();

	const layerGroups: Record<string, string[]> = {
		vl: Array.from({ length: 12 }, (_, i) => `vl-${i + 1}`),
		'osm-vl': Array.from({ length: 12 }, (_, i) => `osm-vl-${i + 1}`),
	};

	function expandLayers(layers: string[]): string[] {
		const expanded: string[] = [];
		for (const id of layers) {
			if (layerGroups[id]) {
				expanded.push(...layerGroups[id]);
			} else {
				expanded.push(id);
			}
		}
		return expanded;
	}

	function compactLayers(layers: string[]): string[] {
		const set = new Set(layers);
		const result: string[] = [];
		const consumed = new Set<string>();

		for (const [group, members] of Object.entries(layerGroups)) {
			if (members.every((m) => set.has(m))) {
				result.push(group);
				members.forEach((m) => consumed.add(m));
			}
		}

		for (const id of layers) {
			if (!consumed.has(id)) {
				result.push(id);
			}
		}

		return result;
	}

	const mapSearchParamsSchema = type({
		layers: type('string[]').default(() => ['cycleways', 'vl']),
		commune: 'string = ""',
		zoom: 'number = 11',
		center: type('number[]').default(() => [4.835659, 45.764043]),
		selected: type('number[]').default(() => []),
		mapStyle: type('"positron" | "osm-bright" | "cyclopolis" | "hybrid" | "cyclosm"').default(
			() => 'cyclopolis' as MapStyle,
		),
		cyclewayReseau: type('string[]').default(() => []),
		cyclewayType: type('string[]').default(() => []),
		cyclewayLocalisation: type('string[]').default(() => []),
		targetNetworkHorizons: type('string[]').default(() => ['2030', '2035', '2040']),
		projectVLStatuses: type('string[]').default(() => ['wip', 'planned', 'postponed']),
	});

	const params = useSearchParams(mapSearchParamsSchema, {
		pushHistory: false,
	});

	const cyclewayFilterOptions = {
		reseau: [
			{ id: 'Réseau structurant et super structurant', label: 'Structurant', color: '#484848' },
			{ id: 'Réseau secondaire', label: 'Secondaire', color: '#a2a2a2' },
			{ id: 'Réseau de desserte', label: 'Desserte', color: '#5e5e5e' },
		],
		typeamenagement: [
			{ id: 'Piste Cyclable', label: 'Piste Cyclable', color: '#22c55e' },
			{ id: 'Voie verte', label: 'Voie verte', color: '#16a34a' },
			{ id: 'Bande Cyclable', label: 'Bande Cyclable', color: '#84cc16' },
			{ id: 'Couloir bus vélo élargi', label: 'Couloir bus vélo élargi', color: '#eab308' },
			{ id: 'Couloir bus vélo non élargi', label: 'Couloir bus vélo non élargi', color: '#f59e0b' },
			{ id: 'Double sens cyclable', label: 'Double sens cyclable', color: '#06b6d4' },
			{
				id: 'Chaussée à voie centrale banalisée (CVCB)',
				label: 'CVCB',
				color: '#8b5cf6',
			},
			{ id: 'Goulotte ou rampe', label: 'Goulotte ou rampe', color: '#ec4899' },
		],
		localisation: [
			{ id: 'Sur chaussée', label: 'Sur chaussée', color: '#64748b' },
			{ id: 'Sur trottoir', label: 'Sur trottoir', color: '#94a3b8' },
			{ id: 'Sans objet', label: 'Sans objet', color: '#cbd5e1' },
		],
	};

	const availableLayers = [
		{
			id: 'cycleways',
			label: 'Aménagements cyclables',
			color: '#19181a',
			category: 'Infrastructures Cyclables',
			hasSubFilters: true,
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
		...Array.from({ length: 12 }, (_, i) => ({
			id: `osm-vl-${i + 1}`,
			label: `${i + 1}`,
			color: vlColors[i],
			category: 'Voies Lyonnaises (OSM)',
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
		{
			id: 'target-network',
			label: 'Réseau Cible LVV 2040',
			color: '#9333ea',
			category: 'Projets',
			hasSubFilters: true,
		},
		{
			id: 'project-vl',
			label: 'Voies Lyonnaises (WIP)',
			color: '#19181a',
			category: 'Projets',
			hasSubFilters: true,
		},
	] as const;

	const projectVLSubLayers = [
		{
			id: 'wip',
			label: 'En travaux',
			statuses: ['wip', 'tested'],
			customStyle: {
				color: '#152B68',
				dashArray: [3, 1],
			},
		},
		{
			id: 'planned',
			label: 'Prévu pour 2026',
			statuses: ['planned', 'variante'],
			customStyle: {
				color: '#8B7FA0',
				dashArray: [2, 2],
			},
		},
	] as const;

	const optionalCategories = ['Voies Lyonnaises (OSM)', 'Projets'] as const;
	const STORAGE_KEY = 'visibleOptionalCategories';

	function loadOptionalCategories(): Set<string> {
		if (typeof globalThis.localStorage === 'undefined') return new Set<string>();
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored) as string[];
				return new Set(parsed.filter((c) => (optionalCategories as readonly string[]).includes(c)));
			}
		} catch {}
		return new Set<string>();
	}

	function saveOptionalCategories(categories: Set<string>) {
		if (typeof globalThis.localStorage === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify([...categories]));
		} catch {}
	}

	let visibleOptionalCategories = $state(loadOptionalCategories());
	let showConfigDialog = $state(false);

	function toggleOptionalCategory(category: string) {
		if (visibleOptionalCategories.has(category)) {
			visibleOptionalCategories.delete(category);
		} else {
			visibleOptionalCategories.add(category);
		}
		visibleOptionalCategories = new Set(visibleOptionalCategories);
		saveOptionalCategories(visibleOptionalCategories);
	}

	function resetLayers() {
		params.layers = ['cycleways', 'vl'];
	}

	const visibleLayers = $derived(new Set(expandLayers(params.layers || [])));

	function setLayers(layers: string[]) {
		params.layers = compactLayers(layers);
	}

	const qf = createQuickFilterState(
		availableLayers,
		() => visibleLayers,
		(layers) => setLayers(layers),
	);

	const hasNonDefaultFilters = $derived.by(() => {
		const defaultSet = new Set(expandLayers(['cycleways', 'vl']));
		if (visibleLayers.size !== defaultSet.size) return true;
		for (const id of visibleLayers) {
			if (!defaultSet.has(id)) return true;
		}
		return false;
	});

	let map: maplibregl.Map | undefined = $state();
	let showMobileFilters = $state(false);
	let showDesktopSidebar = $state(true);
	let cursor: string | undefined = $state();

	const mapStyleState = createMapStyleState(params.mapStyle, (style) => {
		params.mapStyle = style;
	});

	let geocoderHighlight: { lng: number; lat: number } | null = $state(null);
	let geocoderHighlightFading = $state(false);
	let geocoderHighlightTimeout: ReturnType<typeof setTimeout> | null = null;
	let geocoderFadeTimeout: ReturnType<typeof setTimeout> | null = null;
	let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

	let contextMenuVisible = $state(false);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);

	let contextMenuLngLat: { lng: number; lat: number } | null = $state(null);
	let contextMenuPhotoLocation: { lng: number; lat: number } | null = $state(null);
	let hoveredPhotoLocation: { lng: number; lat: number } | null = $state(null);
	let hoverPopupFeatures: { features: any[]; lngLat: { lng: number; lat: number } } | null =
		$state(null);
	let innerWidth = $state(0);
	let bearing = $state(0);
	let pitch = $state(0);

	let touchTimeout: ReturnType<typeof setTimeout> | null = null;
	let touchStartPoint: { x: number; y: number } | null = null;

	let collapsedCategories = $state(
		new Set<string>(
			availableLayers
				.map((layer) => layer.category)
				.filter((category, index, self) => self.indexOf(category) === index),
		),
	);

	let zoom = $state(params.zoom);
	let center = $state<{ lng: number; lat: number }>({
		lng: params.center[0],
		lat: params.center[1],
	});

	let lastMapMoveTime = 0;

	$effect(() => {
		const pZoom = params.zoom;
		const [pLng, pLat] = params.center;

		untrack(() => {
			if (Date.now() - lastMapMoveTime < 500) return;

			if (Math.abs(pZoom - zoom) > 0.001) {
				zoom = pZoom;
			}
			if (Math.abs(pLng - center.lng) > 0.0001 || Math.abs(pLat - center.lat) > 0.0001) {
				center = { lng: pLng, lat: pLat };
			}
		});
	});

	$effect(() => {
		const pMapStyle = params.mapStyle;
		untrack(() => {
			if (pMapStyle !== mapStyleState.mapStyle) {
				mapStyleState.mapStyle = pMapStyle;
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

	const optionalCategoriesSet = new Set<string>(optionalCategories);

	const layerIdToCategory = new Map<string, string>(availableLayers.map((l) => [l.id, l.category]));

	const categoriesNeededByUrl = $derived.by(() => {
		const needed = new Set<string>();
		for (const id of visibleLayers) {
			const category = layerIdToCategory.get(id);
			if (category && optionalCategoriesSet.has(category)) {
				needed.add(category);
			}
		}
		return needed;
	});

	const filteredLayersByCategory = $derived.by(() => {
		const filtered = new Map<string, Array<(typeof availableLayers)[number]>>();
		for (const [category, layers] of layersByCategory) {
			if (
				!optionalCategoriesSet.has(category) ||
				visibleOptionalCategories.has(category) ||
				categoriesNeededByUrl.has(category)
			) {
				filtered.set(category, layers);
			}
		}
		return filtered;
	});

	function toggleLayer(layerId: string) {
		const currentLayers = new Set(visibleLayers);
		if (currentLayers.has(layerId)) {
			currentLayers.delete(layerId);
		} else {
			currentLayers.add(layerId);
		}
		setLayers(Array.from(currentLayers));
	}

	function isLayerVisible(layerId: string): boolean {
		return visibleLayers.has(layerId);
	}

	function toggleCategory(category: string) {
		const categoryLayers = layersByCategory.get(category);
		if (!categoryLayers) return;

		const layerIds = categoryLayers.map((layer) => layer.id);
		const allVisible = layerIds.every((id) => visibleLayers.has(id));

		const currentLayers = new Set(visibleLayers);
		if (allVisible) {
			layerIds.forEach((id) => currentLayers.delete(id));
		} else {
			layerIds.forEach((id) => currentLayers.add(id));
		}
		setLayers(Array.from(currentLayers));
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

	function toggleCyclewayReseau(value: string) {
		const current = [...(params.cyclewayReseau || [])];
		const index = current.indexOf(value);
		if (index >= 0) {
			current.splice(index, 1);
		} else {
			current.push(value);
		}
		params.cyclewayReseau = current;
	}

	function toggleCyclewayType(value: string) {
		const current = [...(params.cyclewayType || [])];
		const index = current.indexOf(value);
		if (index >= 0) {
			current.splice(index, 1);
		} else {
			current.push(value);
		}
		params.cyclewayType = current;
	}

	function toggleCyclewayLocalisation(value: string) {
		const current = [...(params.cyclewayLocalisation || [])];
		const index = current.indexOf(value);
		if (index >= 0) {
			current.splice(index, 1);
		} else {
			current.push(value);
		}
		params.cyclewayLocalisation = current;
	}

	function toggleTargetNetworkHorizon(value: string) {
		const current = [...(params.targetNetworkHorizons || [])];
		const index = current.indexOf(value);
		if (index >= 0) {
			current.splice(index, 1);
		} else {
			current.push(value);
		}
		params.targetNetworkHorizons = current;
	}

	function toggleProjectVLStatus(value: string) {
		const current = [...(params.projectVLStatuses || [])];
		const index = current.indexOf(value);
		if (index >= 0) {
			current.splice(index, 1);
		} else {
			current.push(value);
		}
		params.projectVLStatuses = current;
	}

	function isCyclewayReseauSelected(value: string): boolean {
		return (params.cyclewayReseau || []).includes(value);
	}

	function isCyclewayTypeSelected(value: string): boolean {
		return (params.cyclewayType || []).includes(value);
	}

	function isCyclewayLocalisationSelected(value: string): boolean {
		return (params.cyclewayLocalisation || []).includes(value);
	}

	const filteredVoirieData = $derived.by(() => {
		const voirieData = voirieQuery.data;
		if (!voirieData) {
			return undefined;
		}

		const reseauFilters = params.cyclewayReseau || [];
		const typeFilters = params.cyclewayType || [];
		const localisationFilters = params.cyclewayLocalisation || [];

		if (
			reseauFilters.length === 0 &&
			typeFilters.length === 0 &&
			localisationFilters.length === 0
		) {
			return voirieData;
		}

		const filteredFeatures = voirieData.features.filter((feature: any) => {
			const props = feature.properties;

			if (reseauFilters.length > 0 && !reseauFilters.includes(props.reseau)) {
				return false;
			}

			if (typeFilters.length > 0 && !typeFilters.includes(props.typeamenagement)) {
				return false;
			}

			if (localisationFilters.length > 0 && !localisationFilters.includes(props.localisation)) {
				return false;
			}

			return true;
		});

		return {
			...voirieData,
			features: filteredFeatures,
		};
	});

	let selectedFeatures: any[] = $state([]);
	let selectedLngLat: { lng: number; lat: number } | null = $state(null);
	let showPanoramax = $state(false);

	function selectFeaturesAt(point: { x: number; y: number }, lngLat: { lng: number; lat: number }) {
		if (!map) return;

		const interactableLayers = getInteractableLayerIds(isLayerVisible).filter((id) =>
			map!.getLayer(id),
		);

		if (interactableLayers.length === 0) {
			selectedFeatures = [];
			selectedLngLat = null;
			hoveredPhotoLocation = null;
			return;
		}

		const features = map.queryRenderedFeatures(point, { layers: interactableLayers });

		if (features.length > 0) {
			const filtered = features
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
					const baseLayerId = f.layer.id.replace('-hitarea', '');
					const allConfigs = getAllLayerConfigs();
					const config = allConfigs.find((c) => c.interactableLayerIds.includes(f.layer.id));
					const featureType =
						config?.featureType ||
						layerToFeatureType.get(f.layer.id) ||
						layerToFeatureType.get(baseLayerId) ||
						'default';
					return { ...f, type: featureType, config };
				})
				.filter((f) => {
					if (f.config?.minZoomPopup && zoom < f.config.minZoomPopup) {
						return false;
					}
					return true;
				});

			if (filtered.length > 0) {
				selectedFeatures = filtered;
				selectedLngLat = lngLat;
			} else {
				selectedFeatures = [];
				selectedLngLat = null;
				hoveredPhotoLocation = null;
				params.selected = [];
			}
		} else {
			selectedFeatures = [];
			selectedLngLat = null;
			hoveredPhotoLocation = null;
			params.selected = [];
		}
	}

	function handleMapMouseMove(e: any) {
		if (!map) return;

		// Clear any pending timeout when moving mouse
		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
			hoverTimeout = null;
		}

		const interactableLayers = getInteractableLayerIds(isLayerVisible).filter((id) =>
			map!.getLayer(id),
		);
		if (interactableLayers.length === 0) {
			hoverPopupFeatures = null;
			cursor = undefined;
			return;
		}

		const features = map.queryRenderedFeatures(e.point, { layers: interactableLayers });

		if (features.length > 0) {
			const uniqueFeatures = features
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
					const allConfigs = getAllLayerConfigs();
					const config = allConfigs.find((c) => c.interactableLayerIds.includes(f.layer.id));
					const featureType =
						config?.featureType ||
						layerToFeatureType.get(f.layer.id) ||
						layerToFeatureType.get(baseLayerId) ||
						'default';

					return { ...f, type: featureType, config };
				})
				.filter((f) => {
					if (f.config?.minZoomPopup && zoom < f.config.minZoomPopup) {
						return false;
					}
					return true;
				});

			if (uniqueFeatures.length > 0) {
				cursor = 'pointer';
				if (hoverPopupFeatures) {
					hoverPopupFeatures = {
						features: uniqueFeatures,
						lngLat: e.lngLat,
					};
				} else {
					const targetLngLat = e.lngLat;
					hoverTimeout = setTimeout(() => {
						hoverPopupFeatures = {
							features: uniqueFeatures,
							lngLat: targetLngLat,
						};
					}, 200);
				}
			} else {
				hoverPopupFeatures = null;
				cursor = undefined;
			}
		} else {
			hoverPopupFeatures = null;
			cursor = undefined;
		}
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

	onMount(() => {
		document.body.style.overflow = 'hidden';
		document.documentElement.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = '';
			document.documentElement.style.overflow = '';
		};
	});
</script>

<svelte:window bind:innerWidth />

<div
	class="relative flex h-[100dvh] w-[100vw] flex-row overflow-hidden"
	style="margin-left: calc(50% - 50vw); width: 100vw;"
>
	<div class="relative h-full flex-1">
		<div
			class="absolute top-3 left-1/2 z-20 flex w-full max-w-xs -translate-x-1/2 flex-col gap-2 px-4 sm:max-w-sm md:max-w-md"
		>
			<div class="rounded-lg shadow-md">
				<Geocoder onSelect={handleGeocoderSelect} bbox={LYON_BOUNDS} />
			</div>
			<div class="flex flex-wrap items-center justify-center gap-1.5">
				{#each qf.activeFilters as qfItem}
					<button
						onclick={() => qf.toggle(qfItem)}
						class="rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-sm transition-all active:scale-95"
						style="
							background-color: {qf.isActive(qfItem) ? qfItem.color : 'white'};
							color: {qf.isActive(qfItem) ? 'white' : qfItem.color};
							border: 1.5px solid {qfItem.color};
						"
					>
						{qfItem.label}
					</button>
				{/each}
				<button
					onclick={() => {
						if (innerWidth >= 768) {
							showDesktopSidebar = !showDesktopSidebar;
						} else {
							showMobileFilters = true;
						}
					}}
					class="relative rounded-full bg-white p-1.5 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
					style="border: 1.5px solid #9ca3af;"
					title="Plus de filtres"
				>
					<Ellipsis size={14} class="text-gray-500" />
					{#if hasNonDefaultFilters}
						<span
							class="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white"
						></span>
					{/if}
				</button>
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
			onmousemove={handleMapMouseMove}
			onmouseleave={handleMapMouseLeave}
			ontouchstart={handleTouchStart}
			ontouchmove={handleTouchMove}
			ontouchend={handleTouchEnd}
			onmovestart={handleMapMoveStart}
			onzoomstart={handleMapMoveStart}
			onmoveend={() => {
				lastMapMoveTime = Date.now();
				params.zoom = zoom;
				params.center = [center.lng, center.lat];
			}}
		>
			<AttributionControl compact={true} position="bottom-left" />

			{#if innerWidth >= 768}
				<GeolocateControl position="top-right" />
				<MapStyleToggle
					currentStyle={mapStyleState.mapStyle}
					onSelect={mapStyleState.setMapStyle}
					position="top-right"
				/>
			{:else}
				<GeolocateControl position="bottom-right" />
				<MapStyleToggle
					currentStyle={mapStyleState.mapStyle}
					onSelect={mapStyleState.setMapStyle}
					position="bottom-right"
				/>
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

			{#if hoverPopupFeatures && hoverPopupFeatures.features.length > 0}
				<Popup lnglat={hoverPopupFeatures.lngLat} closeButton={false} closeOnClick={false}>
					<div class="flex max-h-64 animate-[fade-in_0.2s_ease-out] flex-col gap-2 overflow-y-auto">
						{#each hoverPopupFeatures.features as feature, i}
							{#if i > 0}
								<hr class="border-gray-200" />
							{/if}
							<div class="flex flex-col gap-1">
								{#if feature.config?.formatPopup}
									{@html feature.config.formatPopup(feature.properties)}
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

			{#if hoveredPhotoLocation}
				<GeocoderMarker lnglat={hoveredPhotoLocation} pulse={false} />
			{/if}

			<CommunesLayer {isLayerVisible} {handleMouseEnter} {handleMouseLeave} />

			<CyclewayLayer
				{isLayerVisible}
				voirieData={filteredVoirieData}
				mapStyle={mapStyleState.mapStyle}
			/>

			<TargetNetworkLayer {isLayerVisible} targetNetworkHorizons={params.targetNetworkHorizons} />

			<VelovLayer {isLayerVisible} {handleMouseEnter} {handleMouseLeave} />

			<ParkingLayer {isLayerVisible} {handleMouseEnter} {handleMouseLeave} />

			<BusLayer {isLayerVisible} {handleMouseEnter} {handleMouseLeave} {map} />

			<MetroLayer {isLayerVisible} {handleMouseEnter} {handleMouseLeave} {map} />

			<TramLayer {isLayerVisible} {handleMouseEnter} {handleMouseLeave} {map} />

			<VoiesLyonnaisesLayer
				{isLayerVisible}
				{map}
				projectVLStatuses={params.projectVLStatuses}
				{projectVLSubLayers}
			/>

			<OverpassVLLayer {isLayerVisible} />

			<PumpLayer {isLayerVisible} {handleMouseEnter} {handleMouseLeave} />

			<WaterFountainLayer {isLayerVisible} {handleMouseEnter} {handleMouseLeave} />
		</MapLibre>

		<a
			href="/a-propos"
			class="absolute right-0 bottom-0 z-10 hidden transition-opacity hover:opacity-80 md:block"
			title="À propos - La Ville à Vélo"
		>
			<img
				src="https://cyclopolis.lavilleavelo.org/logo-lvv-carte.png"
				alt="La Ville à Vélo"
				class="h-16 w-auto drop-shadow-md"
			/>
		</a>
	</div>

	{#if showDesktopSidebar}
		<div class="hidden h-full w-80 border-l bg-white shadow-xl md:flex md:flex-col">
			<div class="flex items-center justify-between border-b p-4">
				<h2 class="flex items-center gap-2 text-lg font-bold">
					<Filter size={20} />
					Filtres
				</h2>
				<div class="flex items-center gap-1">
					<button
						onclick={resetLayers}
						class="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
						title="Réinitialiser les filtres"
					>
						<RotateCcw size={18} />
					</button>
					<button
						onclick={() => (showConfigDialog = true)}
						class="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
						title="Configurer les couches"
					>
						<Settings size={18} />
					</button>
				</div>
			</div>
			<div class="flex-1 overflow-y-auto p-4">
				<FilterPanel
					layersByCategory={filteredLayersByCategory}
					{isCategoryVisible}
					{isCategoryCollapsed}
					{toggleCategory}
					{toggleCategoryCollapse}
					{toggleLayer}
					{isLayerVisible}
				>
					{#snippet layerSubFilters(layerId: string)}
						{#if layerId === 'cycleways'}
							<CyclewayFilters
								filterOptions={cyclewayFilterOptions}
								toggleReseau={toggleCyclewayReseau}
								toggleType={toggleCyclewayType}
								toggleLocalisation={toggleCyclewayLocalisation}
								isReseauSelected={isCyclewayReseauSelected}
								isTypeSelected={isCyclewayTypeSelected}
								isLocalisationSelected={isCyclewayLocalisationSelected}
							/>
						{:else if layerId === 'target-network'}
							<TargetNetworkFilters
								targetNetworkHorizons={params.targetNetworkHorizons}
								toggleHorizon={toggleTargetNetworkHorizon}
							/>
						{:else if layerId === 'project-vl'}
							<ProjectVLFilters
								subLayers={projectVLSubLayers}
								selectedStatuses={params.projectVLStatuses || []}
								toggleStatus={toggleProjectVLStatus}
							/>
						{/if}
					{/snippet}
				</FilterPanel>
			</div>
		</div>
	{/if}

	<div class="md:hidden">
		<MobileDrawer bind:open={showMobileFilters} snapPoints={[0.4, 0.9]} initialSnapPoint={0}>
			<div class="px-2 py-2">
				<div class="mb-2 flex items-center justify-between">
					<h2 class="text-base font-bold">Filtres</h2>
					<div class="flex items-center gap-1">
						<button
							onclick={resetLayers}
							class="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
							title="Réinitialiser les filtres"
						>
							<RotateCcw size={18} />
						</button>
						<button
							onclick={() => (showConfigDialog = true)}
							class="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
							title="Configurer les couches"
						>
							<Settings size={18} />
						</button>
					</div>
				</div>
				<FilterPanel
					layersByCategory={filteredLayersByCategory}
					{isCategoryVisible}
					{isCategoryCollapsed}
					{isLayerVisible}
					{toggleCategory}
					{toggleCategoryCollapse}
					{toggleLayer}
					compact
				>
					{#snippet layerSubFilters(layerId: string)}
						{#if layerId === 'cycleways'}
							<CyclewayFilters
								filterOptions={cyclewayFilterOptions}
								toggleReseau={toggleCyclewayReseau}
								toggleType={toggleCyclewayType}
								toggleLocalisation={toggleCyclewayLocalisation}
								isReseauSelected={isCyclewayReseauSelected}
								isTypeSelected={isCyclewayTypeSelected}
								isLocalisationSelected={isCyclewayLocalisationSelected}
							/>
						{:else if layerId === 'target-network'}
							<TargetNetworkFilters
								targetNetworkHorizons={params.targetNetworkHorizons}
								toggleHorizon={toggleTargetNetworkHorizon}
							/>
						{:else if layerId === 'project-vl'}
							<ProjectVLFilters
								subLayers={projectVLSubLayers}
								selectedStatuses={params.projectVLStatuses || []}
								toggleStatus={toggleProjectVLStatus}
							/>
						{/if}
					{/snippet}
				</FilterPanel>
				<div class="mt-4 border-t pt-3">
					<a
						href="/a-propos"
						class="text-sm text-gray-500 transition-colors hover:text-brand-navy hover:underline"
					>
						À propos
					</a>
				</div>
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

<Dialog.Root bind:open={showConfigDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Configuration</Dialog.Title>
			<Dialog.Description>Personnalisez l'affichage de la carte.</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-5 py-2">
			<div>
				<h3 class="mb-2 text-sm font-semibold text-gray-900">Raccourcis rapides</h3>
				<p class="mb-3 text-xs text-gray-500">
					Choisissez les filtres affichés sous la barre de recherche.
				</p>
				<div class="flex flex-wrap gap-2">
					{#each qf.presets as preset}
						<button
							onclick={() => qf.toggleVisibility(preset.id)}
							class="rounded-full px-2.5 py-1 text-xs font-semibold transition-all active:scale-95"
							style="
								background-color: {qf.activeIds.includes(preset.id) ? preset.color : 'white'};
								color: {qf.activeIds.includes(preset.id) ? 'white' : preset.color};
								border: 1.5px solid {preset.color};
							"
						>
							{preset.label}
						</button>
					{/each}
					{#each qf.activeIds.filter((id) => id.startsWith('qf-layer-')) as customId}
						{@const customQf = qf.allQuickFilterMap.get(customId)}
						{#if customQf}
							<button
								onclick={() => qf.remove(customId)}
								class="group flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all active:scale-95"
								style="
									background-color: {customQf.color};
									color: white;
									border: 1.5px solid {customQf.color};
								"
								title="Retirer"
							>
								{customQf.label}
								<X size={12} class="opacity-60 group-hover:opacity-100" />
							</button>
						{/if}
					{/each}
				</div>
				{#if qf.availableExtras.length > 0}
					<div class="mt-3">
						<Select.Root
							type="single"
							onValueChange={(value) => {
								if (value) qf.addCustom(value);
							}}
						>
							<Select.Trigger size="sm" class="text-xs text-gray-500">
								<Plus size={14} />
								<span>Ajouter un raccourci...</span>
							</Select.Trigger>
							<Select.Content>
								{#each qf.availableExtras as extra}
									<Select.Item value={extra.id} label={extra.label}>
										<span class="flex items-center gap-2">
											<span
												class="inline-block h-2.5 w-2.5 rounded-full"
												style="background-color: {extra.color}"
											></span>
											{extra.label}
										</span>
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				{/if}
			</div>

			<hr class="border-gray-100" />

			<div>
				<h3 class="mb-2 text-sm font-semibold text-gray-900">Couches supplémentaires</h3>
				<p class="mb-3 text-xs text-gray-500">
					Affichez des catégories avancées dans le panneau de filtres.
				</p>
				<div class="flex flex-col gap-2">
					{#each optionalCategories as category}
						<div class="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50">
							<Checkbox
								id={`config-${category}`}
								checked={visibleOptionalCategories.has(category)}
								onCheckedChange={() => toggleOptionalCategory(category)}
								class="border-gray-300 data-[state=checked]:border-brand-navy data-[state=checked]:bg-brand-navy"
							/>
							<Label
								for={`config-${category}`}
								class="cursor-pointer text-sm font-medium text-gray-700"
							>
								{category}
							</Label>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

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

	:global(.maplibregl-ctrl-bottom-left),
	:global(.maplibregl-ctrl-bottom-right) {
		bottom: max(16px, env(safe-area-inset-bottom));
	}
</style>
