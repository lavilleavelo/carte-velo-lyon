<script lang="ts">
	import {
		MapLibre,
		AttributionControl,
		NavigationControl,
		FullScreenControl,
		GeoJSONSource,
		CircleLayer,
		CustomControl,
		Marker,
		Popup,
	} from 'svelte-maplibre-gl';
	import { untrack } from 'svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { useSearchParams } from 'runed/kit';
	import { type } from 'arktype';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import YearRangeFilter from '$lib/components/map/YearRangeFilter.svelte';
	import FeatureInfo from '$lib/components/map/FeatureInfo.svelte';
	import MapStyleToggle from '$lib/components/map/MapStyleToggle.svelte';
	import { createMapStyleState, MAP_STYLE_IDS } from '$lib/utils/mapStyleToggle.svelte';
	import OsmCyclewayLayer from '$lib/components/map/layers/OsmCyclewayLayer.svelte';
	import VoiesLyonnaisesLayer from '$lib/components/map/layers/VoiesLyonnaisesLayer.svelte';
	import CountersLayer from '$lib/components/map/layers/CountersLayer.svelte';
	import { getAllLayerConfigs } from '$lib/config/layers';
	import MapContextMenu from '$lib/components/map/MapContextMenu.svelte';
	import PanoramaxViewer from '$lib/components/PanoramaxViewer.svelte';
	import GeocoderMarker from '$lib/components/GeocoderMarker.svelte';
	import { loadDefaultProvider } from '$lib/config/navigationProviders';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Info from '@lucide/svelte/icons/info';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import MobileDrawer from '$lib/components/MobileDrawer.svelte';
	import accidentsUrl from '$lib/data/accidents-velo.json?url';
	import communeIndex from '$lib/data/communes/_index.json';
	import type { Feature, FeatureCollection, Point } from 'geojson';
	import type maplibregl from 'maplibre-gl';
	import {
		GRAVITIES,
		DEFAULT_GRAVITIES,
		VICTIM_VEHICLES,
		COLLISION_TYPES,
		AGE_BUCKETS,
		emptyBreakdown,
		normalizeStreet,
		totalForBreakdown,
		type AccidentProps,
		type Breakdown,
		type GravityKey,
	} from '$lib/components/accidents/types';
	import MethodologyDialog from '$lib/components/accidents/MethodologyDialog.svelte';
	import MapPills from '$lib/components/accidents/MapPills.svelte';
	import YearHistogram from '$lib/components/accidents/YearHistogram.svelte';
	import AgeHistogram from '$lib/components/accidents/AgeHistogram.svelte';
	import CommuneFilter from '$lib/components/accidents/CommuneFilter.svelte';
	import StreetFilter from '$lib/components/accidents/StreetFilter.svelte';
	import AccidentInsights from '$lib/components/accidents/AccidentInsights.svelte';
	import CollapsibleSection from '$lib/components/accidents/CollapsibleSection.svelte';

	const DEFAULT_VICTIM_VEHICLES = VICTIM_VEHICLES.slice() as string[];

	// Default range starts at 2019: there are issues before that for BH
	const MIN_YEAR_DEFAULT = 2019;
	const MAX_YEAR_DEFAULT = new Date().getFullYear();

	const DATA_FLOOR_YEAR = 2017;

	const LABEL_BREAK_YEAR = 2018;

	type CommuneEntry = { slug: string; name: string; insee: string };
	const ALL_COMMUNES: CommuneEntry[] = (communeIndex as CommuneEntry[])
		.slice()
		.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
	const ARRONDISSEMENTS = ALL_COMMUNES.filter((c) => c.slug.startsWith('lyon-'));
	const COMMUNES_OTHER = ALL_COMMUNES.filter((c) => !c.slug.startsWith('lyon-'));

	const paramsSchema = type({
		yearFrom: type('number').default(() => MIN_YEAR_DEFAULT),
		yearTo: type('number').default(() => MAX_YEAR_DEFAULT),
		gravities: type('string[]').default(() => DEFAULT_GRAVITIES),
		vehicles: type('string[]').default(() => DEFAULT_VICTIM_VEHICLES),
		collisions: type('string[]').default(() => COLLISION_TYPES as unknown as string[]),
		communes: type('string[]').default(() => []),
		streets: type('string[]').default(() => []),
		showCycleways: type('boolean').default(() => true),
		showVL: type('boolean').default(() => false),
		showCounters: type('boolean').default(() => false),
		dimOverlay: type('boolean').default(() => true),
		safety: type('boolean').default(() => false),
		mapStyle: type.enumerated(...MAP_STYLE_IDS).default(() => 'positron'),
		zoom: type('number').default(() => 0),
		lng: type('number').default(() => 0),
		lat: type('number').default(() => 0),
	});
	const params = useSearchParams(paramsSchema, { pushHistory: false, noScroll: true });

	let communeSearch = $state('');

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

	let mapInitialized = false;
	$effect(() => {
		if (!map) return;
		if (mapInitialized) return;
		mapInitialized = true;
		untrack(() => {
			if (params.zoom > 0 && params.lat !== 0 && params.lng !== 0) {
				map!.jumpTo({ center: [params.lng, params.lat], zoom: params.zoom });
			}
		});
	});

	$effect(() => {
		if (!map) return;
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

	const accidentsQuery = createQuery(() => ({
		queryKey: ['accidents-velo'],
		queryFn: async (): Promise<FeatureCollection<Point, AccidentProps>> => {
			const r = await fetch(accidentsUrl);
			if (!r.ok) throw new Error('Failed to fetch accidents data');
			return (await r.json()) as FeatureCollection<Point, AccidentProps>;
		},
		staleTime: Infinity,
	}));

	const allFeatures = $derived<Feature<Point, AccidentProps>[]>(
		accidentsQuery.data?.features ?? [],
	);

	const dataMinYear = $derived(
		allFeatures.length ? Math.min(...allFeatures.map((f) => f.properties.an)) : DATA_FLOOR_YEAR,
	);
	const dataMaxYear = $derived(
		allFeatures.length ? Math.max(...allFeatures.map((f) => f.properties.an)) : MAX_YEAR_DEFAULT,
	);

	const COMMUNES_NONE = '__none__';

	const gravitySet = $derived(new Set(params.gravities));
	const collisionSet = $derived(new Set(params.collisions));
	const vehicleSet = $derived(new Set(params.vehicles));
	const communeSet = $derived(new Set(params.communes));
	const communesAll = $derived(communeSet.size === 0);
	const communesNone = $derived(communeSet.size === 1 && communeSet.has(COMMUNES_NONE));

	const streetKeySet = $derived(new Set(params.streets.map((s) => normalizeStreet(s))));
	const streetsActive = $derived(streetKeySet.size > 0);

	const gravityActive = $derived.by(() => {
		const def = new Set(DEFAULT_GRAVITIES);
		if (def.size !== gravitySet.size) {
			return true;
		}

		for (const g of def) {
			if (!gravitySet.has(g)) {
				return true;
			}
		}
		return false;
	});

	const vehicleActive = $derived.by(() => {
		const def = new Set(DEFAULT_VICTIM_VEHICLES);
		if (def.size !== vehicleSet.size) {
			return true;
		}

		for (const v of def) {
			if (!vehicleSet.has(v)) {
				return true;
			}
		}

		return false;
	});

	const collisionActive = $derived.by(() => {
		const total = (COLLISION_TYPES as unknown as string[]).length;
		return collisionSet.size !== total;
	});

	const communeActive = $derived(!communesAll);

	const filtered = $derived<Feature<Point, AccidentProps>[]>(
		allFeatures.filter((f) => {
			const p = f.properties;
			if (p.an < params.yearFrom || p.an > params.yearTo) return false;
			if (!gravitySet.has(p.gravite)) return false;
			if (!vehicleSet.has(p.victim_vehicle)) return false;
			if (!collisionSet.has(p.collision_type)) return false;
			if (communesNone) return false;
			if (!communesAll && !communeSet.has(p.libelle_commune)) return false;
			if (streetsActive && !streetKeySet.has(normalizeStreet(p.adresse))) return false;
			return true;
		}),
	);

	const counts = $derived.by(() => {
		const acc = {
			total: 0,
			tues: 0,
			hospitalises: 0,
			legers: 0,
			uniqueAccidents: new Set<number>(),
		};
		for (const f of filtered) {
			const p = f.properties;
			acc.total += 1;
			acc.uniqueAccidents.add(p.id_accident);
			if (p.gravite === 'Tué') acc.tues += 1;
			else if (p.gravite === 'Blessé hospitalisé') acc.hospitalises += 1;
			else if (p.gravite === 'Blessé léger') acc.legers += 1;
		}
		return {
			total: acc.total,
			unique: acc.uniqueAccidents.size,
			tues: acc.tues,
			hospitalises: acc.hospitalises,
			legers: acc.legers,
		};
	});

	const collisionBreakdown = $derived.by(() => {
		const m = new Map<string, Breakdown>();
		for (const f of allFeatures) {
			const p = f.properties;
			if (p.an < params.yearFrom || p.an > params.yearTo) continue;
			if (!vehicleSet.has(p.victim_vehicle)) continue;
			if (!communesAll && (communesNone || !communeSet.has(p.libelle_commune))) continue;
			if (streetsActive && !streetKeySet.has(normalizeStreet(p.adresse))) continue;
			let b = m.get(p.collision_type);
			if (!b) {
				b = emptyBreakdown();
				m.set(p.collision_type, b);
			}
			b[p.gravite as GravityKey] += 1;
		}
		return m;
	});

	const vehicleBreakdown = $derived.by(() => {
		const m = new Map<string, Breakdown>();
		for (const f of allFeatures) {
			const p = f.properties;
			if (p.an < params.yearFrom || p.an > params.yearTo) continue;
			if (!collisionSet.has(p.collision_type)) continue;
			if (!communesAll && (communesNone || !communeSet.has(p.libelle_commune))) continue;
			if (streetsActive && !streetKeySet.has(normalizeStreet(p.adresse))) continue;
			let b = m.get(p.victim_vehicle);
			if (!b) {
				b = emptyBreakdown();
				m.set(p.victim_vehicle, b);
			}
			b[p.gravite as GravityKey] += 1;
		}
		return m;
	});

	const gravityCounts = $derived.by(() => {
		const m = new Map<string, number>();
		for (const f of allFeatures) {
			const p = f.properties;
			if (p.an < params.yearFrom || p.an > params.yearTo) continue;
			if (!vehicleSet.has(p.victim_vehicle)) continue;
			if (!collisionSet.has(p.collision_type)) continue;
			if (!communesAll && (communesNone || !communeSet.has(p.libelle_commune))) continue;
			if (streetsActive && !streetKeySet.has(normalizeStreet(p.adresse))) continue;
			m.set(p.gravite, (m.get(p.gravite) ?? 0) + 1);
		}
		return m;
	});

	const communeBreakdown = $derived.by(() => {
		const m = new Map<string, Breakdown>();
		for (const f of allFeatures) {
			const p = f.properties;
			if (p.an < params.yearFrom || p.an > params.yearTo) continue;
			if (!vehicleSet.has(p.victim_vehicle)) continue;
			if (!collisionSet.has(p.collision_type)) continue;
			if (streetsActive && !streetKeySet.has(normalizeStreet(p.adresse))) continue;
			let b = m.get(p.libelle_commune);
			if (!b) {
				b = emptyBreakdown();
				m.set(p.libelle_commune, b);
			}
			b[p.gravite as GravityKey] += 1;
		}
		return m;
	});

	const streetEntries = $derived.by(() => {
		type Bucket = {
			key: string;
			variants: Map<string, number>;
			breakdown: Breakdown;
		};
		const m = new Map<string, Bucket>();
		for (const f of allFeatures) {
			const p = f.properties;
			if (p.an < params.yearFrom || p.an > params.yearTo) continue;
			if (!gravitySet.has(p.gravite)) continue;
			if (!vehicleSet.has(p.victim_vehicle)) continue;
			if (!collisionSet.has(p.collision_type)) continue;
			if (communesNone) continue;
			if (!communesAll && !communeSet.has(p.libelle_commune)) continue;
			const adr = (p.adresse || '').trim();
			if (!adr) continue;
			const key = normalizeStreet(adr);
			let b = m.get(key);
			if (!b) {
				b = { key, variants: new Map(), breakdown: emptyBreakdown() };
				m.set(key, b);
			}
			b.variants.set(adr, (b.variants.get(adr) ?? 0) + 1);
			b.breakdown[p.gravite as GravityKey] += 1;
		}
		const out: { canonical: string; key: string; breakdown: Breakdown; total: number }[] = [];
		for (const b of m.values()) {
			const canonical = [...b.variants.entries()].sort((a, b2) => b2[1] - a[1])[0][0];
			const total = totalForBreakdown(b.breakdown, gravitySet);
			if (total === 0) continue;
			out.push({ canonical, key: b.key, breakdown: b.breakdown, total });
		}
		out.sort((a, b) => b.total - a.total);
		return out;
	});

	const yearHistogram = $derived.by(() => {
		const out: { year: number; breakdown: Breakdown; total: number }[] = [];
		const m = new Map<number, Breakdown>();
		for (let y = dataMinYear; y <= dataMaxYear; y++) m.set(y, emptyBreakdown());
		for (const f of allFeatures) {
			const p = f.properties;
			if (!collisionSet.has(p.collision_type)) continue;
			if (!vehicleSet.has(p.victim_vehicle)) continue;
			if (!communesAll && (communesNone || !communeSet.has(p.libelle_commune))) continue;
			if (streetsActive && !streetKeySet.has(normalizeStreet(p.adresse))) continue;
			const b = m.get(p.an);
			if (b) b[p.gravite as GravityKey] += 1;
		}
		for (const [year, breakdown] of [...m.entries()].sort((a, b) => a[0] - b[0])) {
			const total = totalForBreakdown(breakdown, gravitySet);
			out.push({ year, breakdown, total });
		}
		return out;
	});

	const histogramMax = $derived(Math.max(1, ...yearHistogram.map((d) => d.total)));

	const ageHistogram = $derived.by(() => {
		const out = AGE_BUCKETS.map((b) => ({
			key: b.key,
			breakdown: emptyBreakdown(),
			total: 0,
			min: b.min,
			max: b.max,
		}));
		let unknown = 0;
		for (const f of filtered) {
			const a = Number(f.properties.age);
			if (!Number.isFinite(a) || a < 0) {
				unknown += 1;
				continue;
			}
			const bucket = out.find((b) => a >= b.min && a <= b.max);
			if (!bucket) continue;
			bucket.breakdown[f.properties.gravite as GravityKey] += 1;
		}
		for (const b of out) {
			b.total = totalForBreakdown(b.breakdown, gravitySet);
		}
		return { buckets: out, unknown };
	});

	const ageHistogramMax = $derived(Math.max(1, ...ageHistogram.buckets.map((d) => d.total)));

	const sortedCollisionTypes = $derived(
		[...COLLISION_TYPES].sort((a, b) => {
			const ta = totalForBreakdown(collisionBreakdown.get(a), gravitySet);
			const tb = totalForBreakdown(collisionBreakdown.get(b), gravitySet);
			return tb - ta;
		}),
	);

	const filteredFC = $derived<FeatureCollection<Point, AccidentProps>>({
		type: 'FeatureCollection',
		features: filtered,
	});

	let map: maplibregl.Map | undefined = $state();
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

	function handleMapContextMenu(event: any) {
		event.preventDefault();
		const e = event.originalEvent as MouseEvent;
		contextMenuVisible = true;
		contextMenuX = e.clientX;
		contextMenuY = e.clientY;
		contextMenuLngLat = { lng: event.lngLat.lng, lat: event.lngLat.lat };
		contextMenuPhotoLocation = null;
	}
	function closeContextMenu() {
		contextMenuVisible = false;
		contextMenuLngLat = null;
		contextMenuPhotoLocation = null;
	}

	function toggleGravity(id: string) {
		const next = new Set(params.gravities);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		params.gravities = [...next];
	}
	function toggleCollision(id: string) {
		const next = new Set(params.collisions);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		params.collisions = [...next];
	}
	function selectAllGravities() {
		params.gravities = GRAVITIES.map((g) => g.id) as string[];
	}
	function defaultGravities() {
		params.gravities = DEFAULT_GRAVITIES.slice();
	}
	function selectAllCollisions() {
		params.collisions = COLLISION_TYPES as unknown as string[];
	}
	function clearGravities() {
		params.gravities = [];
	}
	function clearCollisions() {
		params.collisions = [];
	}
	function toggleVehicle(v: string) {
		const next = new Set(params.vehicles);
		if (next.has(v)) next.delete(v);
		else next.add(v);
		params.vehicles = [...next];
	}
	function selectAllVehicles() {
		params.vehicles = VICTIM_VEHICLES.slice() as string[];
	}
	function defaultVehicles() {
		params.vehicles = DEFAULT_VICTIM_VEHICLES.slice();
	}
	function clearVehicles() {
		params.vehicles = [];
	}
	function soloVehicle(v: string) {
		params.vehicles = [v];
	}
	function soloCollision(t: string) {
		params.collisions = [t];
	}
	function soloCommune(name: string) {
		params.communes = [name];
	}
	function toggleCommune(name: string) {
		// If we were in "all" or "none" mode, clicking a commune starts a fresh
		// explicit selection containing just that one (more intuitive than
		// inverting from "all" → all-but-one).
		if (communesAll || communesNone) {
			params.communes = [name];
			return;
		}
		const next = new Set(params.communes);
		if (next.has(name)) next.delete(name);
		else next.add(name);
		// Empty back to "all" rather than "none" (matches the All/Aucun buttons).
		params.communes = next.size === 0 ? [] : [...next];
	}
	function selectAllCommunes() {
		params.communes = [];
	}
	function clearCommunes() {
		params.communes = [COMMUNES_NONE];
	}
	function toggleStreet(name: string) {
		const next = new Set(params.streets);
		if (next.has(name)) next.delete(name);
		else next.add(name);
		params.streets = [...next];
	}
	function soloStreet(name: string) {
		params.streets = [name];
	}
	function clearStreets() {
		params.streets = [];
	}
	let streetSearch = $state('');

	function resetAll() {
		params.yearFrom = MIN_YEAR_DEFAULT;
		params.yearTo = dataMaxYear;
		defaultGravities();
		defaultVehicles();
		selectAllCollisions();
		selectAllCommunes();
		clearStreets();
		communeSearch = '';
		streetSearch = '';
	}

	function handleMapClick(event: maplibregl.MapMouseEvent) {
		if (!map) return;
		const accidentLayerIds = GRAVITIES.map((g) => `accidents-${g.slug}-hitarea`);
		const counterLayerIds = params.showCounters ? ['counters-velo-hitarea'] : [];
		const layerIds = [...accidentLayerIds, ...counterLayerIds].filter((id) => map?.getLayer(id));
		if (layerIds.length === 0) return;
		const features = map.queryRenderedFeatures(event.point, { layers: layerIds });
		if (features.length === 0) {
			selectedFeatures = [];
			selectedLngLat = null;
			return;
		}
		const f = features[0];
		const coords =
			f.geometry.type === 'Point' ? (f.geometry.coordinates as [number, number]) : null;
		selectedLngLat = coords ? { lng: coords[0], lat: coords[1] } : null;

		if (f.layer.id === 'counters-velo-hitarea') {
			selectedFeatures = [
				{
					type: 'counter',
					properties: { ...(f.properties ?? {}), counterType: 'velo' },
				},
			];
			return;
		}

		const props = (f.properties ?? {}) as AccidentProps & { other_vehicles?: string };
		// Normalize other_vehicles back to array (it's serialized to string by maplibre)
		let otherVehicles: string[] = [];
		if (Array.isArray(props.other_vehicles)) {
			otherVehicles = props.other_vehicles as string[];
		} else if (typeof props.other_vehicles === 'string') {
			try {
				otherVehicles = JSON.parse(props.other_vehicles);
			} catch {}
		}

		selectedFeatures = [
			{
				type: 'accident',
				properties: { ...props, other_vehicles: otherVehicles },
			},
		];
	}

	const accidentLayerConfigs = $derived.by(() => {
		const all = getAllLayerConfigs();
		const m = new Map<string, ReturnType<typeof getAllLayerConfigs>[number]>();
		for (const c of all) {
			if (c.featureType === 'accident' || c.featureType === 'counter') {
				for (const layerId of c.interactableLayerIds) m.set(layerId, c);
			}
		}
		return m;
	});

	let cursor = $state('');
	let hoverPopup: { html: string; lngLat: { lng: number; lat: number } } | null = $state(null);
	let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleMouseMove(event: maplibregl.MapMouseEvent) {
		if (!map) {
			return;
		}

		const accidentLayerIds = GRAVITIES.map((g) => `accidents-${g.slug}-hitarea`);
		const counterLayerIds = params.showCounters ? ['counters-velo-hitarea'] : [];
		const layerIds = [...accidentLayerIds, ...counterLayerIds].filter((id) => map?.getLayer(id));

		if (layerIds.length === 0) {
			cursor = '';
			hoverPopup = null;
			return;
		}

		const features = map.queryRenderedFeatures(event.point, { layers: layerIds });
		if (features.length === 0) {
			cursor = '';
			if (hoverTimeout) {
				clearTimeout(hoverTimeout);
				hoverTimeout = null;
			}
			hoverPopup = null;
			return;
		}

		cursor = 'pointer';
		const f = features[0];

		const config = accidentLayerConfigs.get(f.layer.id);
		if (!config?.formatPopup) {
			hoverPopup = null;
			return;
		}

		const coords =
			f.geometry.type === 'Point' ? (f.geometry.coordinates as [number, number]) : null;

		const lngLat = coords ? { lng: coords[0], lat: coords[1] } : event.lngLat;
		const html = config.formatPopup(f.properties ?? {});
		const next = { html, lngLat };

		if (hoverPopup) {
			hoverPopup = next;
		} else {
			if (hoverTimeout) clearTimeout(hoverTimeout);
			hoverTimeout = setTimeout(() => {
				hoverPopup = next;
			}, 200);
		}
	}

	function handleMouseLeave() {
		cursor = '';
		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
			hoverTimeout = null;
		}
		hoverPopup = null;
	}

	const numFmt = new Intl.NumberFormat('fr-FR');

	let sourceDialogOpen = $state(false);
	let mobileFiltersOpen = $state(false);

	let collapsed = $state({
		profile: true,
		gravity: false,
		vehicle: false,
		commune: true,
		street: true,
		collision: true,
	});
</script>

<div class="flex flex-col gap-2 py-2 lg:gap-4 lg:py-4">
	<header class="flex flex-wrap items-center gap-3 px-3 lg:px-6">
		<div class="flex flex-1 flex-col gap-0.5 lg:gap-1">
			<h1 class="text-lg font-bold text-brand-navy md:text-2xl lg:text-3xl">Accidents vélo</h1>
			<p class="text-xs text-gray-600 lg:text-sm">
				Accidents impliquant au moins un vélo, VAE ou EDPM, sur la Métropole de Lyon
				<button
					type="button"
					onclick={() => (sourceDialogOpen = true)}
					class="ml-1 inline-flex items-center gap-1 align-baseline text-[10px] text-gray-500 underline hover:text-brand-navy lg:text-xs"
				>
					<Info size={12} />
					Source et méthodologie
				</button>
			</p>
		</div>
	</header>

	<!-- Break out of <main>'s mobile padding so the map is edge-to-edge.
	     On lg+ the layout's px-8 already provides the gutter, so reset margins. -->
	<div class="-mx-4 flex flex-col gap-4 sm:-mx-6 lg:mx-0 lg:flex-row lg:items-stretch">
		<div class="flex-1">
			<div
				class="relative overflow-hidden shadow lg:rounded-lg"
				style="height: calc(100svh - 160px); min-height: 480px;"
			>
				<MapPills
					bind:showCycleways={params.showCycleways}
					bind:showVL={params.showVL}
					bind:showCounters={params.showCounters}
					bind:dimOverlay={params.dimOverlay}
				/>

				{#if accidentsQuery.isLoading}
					<div
						class="absolute inset-0 z-10 flex items-center justify-center bg-white/80"
						role="status"
					>
						<span class="text-sm text-gray-600">Chargement des données…</span>
					</div>
				{/if}
				<MapLibre
					bind:map
					class="h-full w-full"
					style={mapStyleState.getMapStyleUrl()}
					center={[4.835, 45.755]}
					zoom={13.5}
					attributionControl={false}
					{cursor}
					onclick={handleMapClick}
					onmousemove={handleMouseMove}
					onmouseleave={handleMouseLeave}
					oncontextmenu={handleMapContextMenu}
				>
					<AttributionControl compact={true} position="bottom-right" />
					<NavigationControl position="top-right" showCompass={false} />
					<FullScreenControl position="top-right" />
					<MapStyleToggle
						currentStyle={mapStyleState.mapStyle}
						onSelect={mapStyleState.setMapStyle}
						position="top-right"
					/>

					{#if params.showCycleways}
						<CustomControl position="top-right">
							<button
								type="button"
								onclick={() => (params.safety = !params.safety)}
								class="rounded-lg pl-1! shadow-md focus:ring-2 focus:ring-blue-500 focus:outline-none {params.safety
									? 'bg-blue-600! text-white! hover:bg-blue-700!'
									: 'bg-white! text-gray-700! hover:bg-gray-50!'}"
								aria-pressed={params.safety}
								aria-label={params.safety
									? 'Désactiver le mode sécurité'
									: 'Activer le mode sécurité'}
								title={params.safety
									? 'Mode sécurité activé (bleu = sûr, rouge = non sûr)'
									: 'Colorer par sécurité (sûr / non sûr)'}
							>
								<ShieldCheck size={20} />
							</button>
						</CustomControl>
					{/if}

					{@const overlayOpacity = params.dimOverlay ? 0.4 : 1}
					{#if params.showCycleways}
						<OsmCyclewayLayer
							isLayerVisible={(id) => id === 'osm-cycleways'}
							{map}
							opacityScale={overlayOpacity}
							safetyMode={params.safety}
						/>
					{/if}
					{#if params.showVL}
						<VoiesLyonnaisesLayer
							isLayerVisible={(id) => id.startsWith('vl-')}
							{map}
							opacityScale={overlayOpacity}
						/>
					{/if}
					{#if params.showCounters}
						<CountersLayer
							isLayerVisible={(id) => id === 'counters-velo'}
							handleMouseEnter={() => {}}
							handleMouseLeave={() => {}}
						/>
					{/if}

					<!-- Accidents drawn LAST so they sit on top of cycleways/VL lines. -->
					<GeoJSONSource id="accidents-page-source" data={filteredFC}>
						{#each GRAVITIES as g (g.slug)}
							<CircleLayer
								id={`accidents-${g.slug}-layer`}
								filter={['==', ['get', 'gravite'], g.id]}
								paint={{
									'circle-color': g.color,
									'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 14, 4.5, 17, 7],
									'circle-stroke-color': '#ffffff',
									'circle-stroke-width': 1,
									'circle-opacity': 0.9,
								}}
							/>
							<CircleLayer
								id={`accidents-${g.slug}-hitarea`}
								filter={['==', ['get', 'gravite'], g.id]}
								paint={{
									'circle-opacity': 0,
									'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 14, 18, 22],
									'circle-color': 'transparent',
								}}
							/>
						{/each}
					</GeoJSONSource>

					{#if hoverPopup && !selectedFeatures.length}
						<Popup lnglat={hoverPopup.lngLat} closeButton={false} closeOnClick={false} offset={14}>
							<div class="flex max-h-64 flex-col gap-2 overflow-y-auto">
								{@html hoverPopup.html}
							</div>
						</Popup>
					{/if}

					{#if selectedLngLat}
						<Marker lnglat={selectedLngLat} />
					{/if}

					{#if hoveredPhotoLocation}
						<Marker lnglat={hoveredPhotoLocation} />
					{/if}

					{#if contextMenuPhotoLocation}
						<GeocoderMarker pulse={false} lnglat={contextMenuPhotoLocation} />
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

				{#if selectedFeatures.length > 0}
					<div class="absolute top-3 left-3 z-20 max-w-sm">
						<FeatureInfo
							features={selectedFeatures}
							coordinates={selectedLngLat}
							{defaultNavProvider}
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

				<!-- Mobile-only floating trigger to open the filters drawer.
				     Hidden on lg+ where the sidebar is always visible. -->
				<button
					type="button"
					onclick={() => (mobileFiltersOpen = true)}
					class="absolute right-3 bottom-12 z-20 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-semibold text-brand-navy shadow-md ring-1 ring-gray-200 transition-all hover:bg-gray-50 active:scale-95 lg:hidden"
					aria-label="Ouvrir les filtres"
				>
					<SlidersHorizontal size={14} />
					Filtres
					<span
						class="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 tabular-nums"
					>
						{numFmt.format(counts.unique)}
					</span>
				</button>
			</div>
		</div>

		<!-- Filter content extracted into a snippet so we can render it both
		     in the desktop sidebar and inside the mobile drawer. -->
		{#snippet filtersBody()}
			<div class="-mt-1 flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
				<div class="flex items-baseline gap-2">
					<h2 class="text-sm font-bold text-brand-navy uppercase">Filtres</h2>
					<span class="text-xs text-gray-500 tabular-nums">
						{numFmt.format(counts.unique)} acc. · {numFmt.format(counts.total)} victimes
					</span>
				</div>
				<button
					type="button"
					onclick={resetAll}
					title="Réinitialiser les filtres"
					aria-label="Réinitialiser les filtres"
					class="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
				>
					<RotateCcw size={14} />
				</button>
			</div>

			<div>
				<YearRangeFilter
					range={[params.yearFrom, params.yearTo]}
					min={dataMinYear}
					max={dataMaxYear}
					label="Période"
					plain={true}
					onRangeChange={(r) => {
						params.yearFrom = r[0];
						params.yearTo = r[1];
					}}
				/>
				<!-- Per-year stacked histogram with cycling intensity overlay. -->
				<div class="mt-3">
					<YearHistogram
						{yearHistogram}
						{histogramMax}
						{gravitySet}
						yearFrom={params.yearFrom}
						yearTo={params.yearTo}
						{dataMinYear}
						{dataMaxYear}
						labellisationBreakYear={LABEL_BREAK_YEAR}
						onSelectYear={(year) => {
							params.yearFrom = year;
							params.yearTo = year;
						}}
					/>
				</div>

				<AgeHistogram
					buckets={ageHistogram.buckets}
					unknown={ageHistogram.unknown}
					max={ageHistogramMax}
					{gravitySet}
				/>
			</div>

			<CollapsibleSection title="Profil des victimes" bind:collapsed={collapsed.profile}>
				<AccidentInsights features={filtered} />
			</CollapsibleSection>

			<CollapsibleSection title="Gravité" bind:collapsed={collapsed.gravity} active={gravityActive}>
				{#snippet collapsedSummary()}
					<span class="flex items-center gap-1">
						{#each GRAVITIES as g (g.id)}
							{#if gravitySet.has(g.id)}
								<span
									class="inline-block h-2 w-2 rounded-full ring-1 ring-white"
									style="background-color: {g.color}"
									title={g.label}
								></span>
							{/if}
						{/each}
					</span>
				{/snippet}
				{#snippet headerActions()}
					<div class="flex gap-1 text-[10px]">
						<button
							type="button"
							onclick={selectAllGravities}
							class="text-gray-400 hover:text-gray-700">tout</button
						>
						<span class="text-gray-300">·</span>
						<button type="button" onclick={clearGravities} class="text-gray-400 hover:text-gray-700"
							>aucun</button
						>
					</div>
				{/snippet}
				<div class="flex flex-col">
					{#each GRAVITIES as g (g.id)}
						{@const total = gravityCounts.get(g.id) ?? 0}
						<label
							class="group relative flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 hover:bg-gray-50"
						>
							<Checkbox
								checked={gravitySet.has(g.id)}
								onCheckedChange={() => toggleGravity(g.id)}
								class="border-gray-300"
							/>
							<span
								class="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white"
								style="background-color: {g.color}"
							></span>
							<span class="flex-1 text-xs text-gray-700">{g.label}</span>
							<button
								type="button"
								onclick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									params.gravities = [g.id];
								}}
								title="Sélectionner uniquement « {g.label} »"
								class="hidden text-[10px] font-semibold text-brand-navy group-hover:inline hover:underline"
							>
								seul
							</button>
							<span class="text-[10px] text-gray-400 tabular-nums group-hover:hidden"
								>{numFmt.format(total)}</span
							>
						</label>
					{/each}
				</div>
			</CollapsibleSection>

			<CollapsibleSection
				title="Type de victime"
				bind:collapsed={collapsed.vehicle}
				active={vehicleActive}
			>
				{#snippet collapsedSummary()}
					<span class="text-[10px] text-gray-500 tabular-nums">
						{vehicleSet.size}/{VICTIM_VEHICLES.length}
					</span>
				{/snippet}
				{#snippet headerActions()}
					<div class="flex gap-1 text-[10px]">
						<button
							type="button"
							onclick={selectAllVehicles}
							class="text-gray-400 hover:text-gray-700">tout</button
						>
						<span class="text-gray-300">·</span>
						<button type="button" onclick={clearVehicles} class="text-gray-400 hover:text-gray-700"
							>aucun</button
						>
					</div>
				{/snippet}
				<div class="flex flex-col">
					{#each VICTIM_VEHICLES as v (v)}
						{@const breakdown = vehicleBreakdown.get(v)}
						{@const total = totalForBreakdown(breakdown, gravitySet)}
						<label
							class="group relative flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 hover:bg-gray-50"
						>
							<Checkbox
								checked={vehicleSet.has(v)}
								onCheckedChange={() => toggleVehicle(v)}
								class="border-gray-300"
							/>
							<span class="flex-1 text-xs text-gray-700">{v}</span>
							<button
								type="button"
								onclick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									soloVehicle(v);
								}}
								title="Sélectionner uniquement « {v} »"
								class="hidden text-[10px] font-semibold text-brand-navy group-hover:inline hover:underline"
							>
								seul
							</button>
							{#if gravitySet.size > 1 && breakdown}
								<span class="flex items-center gap-1.5 group-hover:hidden">
									{#each GRAVITIES as g (g.id)}
										{#if gravitySet.has(g.id)}
											<span
												class="flex items-center gap-0.5 text-[10px] tabular-nums"
												title={g.label}
											>
												<span
													class="inline-block h-1.5 w-1.5 rounded-full"
													style="background-color: {g.color}"
												></span>
												<span class="text-gray-500">{numFmt.format(breakdown[g.id])}</span>
											</span>
										{/if}
									{/each}
								</span>
							{:else}
								<span class="text-[10px] text-gray-400 tabular-nums group-hover:hidden">
									{numFmt.format(total)}
								</span>
							{/if}
						</label>
					{/each}
				</div>
			</CollapsibleSection>

			<CollapsibleSection title="Rues" bind:collapsed={collapsed.street} active={streetsActive}>
				{#snippet collapsedSummary()}
					{#if streetsActive}
						<span class="text-[10px] text-gray-500 tabular-nums">
							{params.streets.length} sélectionnée{params.streets.length > 1 ? 's' : ''}
						</span>
					{/if}
				{/snippet}
				{#snippet headerActions()}
					<div class="flex items-center gap-2">
						{#if streetsActive}
							<span
								class="rounded bg-brand-navy/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-navy tabular-nums"
								>{params.streets.length}</span
							>
						{/if}
						{#if streetsActive}
							<button
								type="button"
								onclick={clearStreets}
								class="text-[10px] text-gray-400 hover:text-gray-700">aucun</button
							>
						{/if}
					</div>
				{/snippet}
				<StreetFilter
					entries={streetEntries}
					selected={new Set(params.streets)}
					{gravitySet}
					bind:search={streetSearch}
					onToggle={toggleStreet}
					onSolo={soloStreet}
					onClear={clearStreets}
				/>
			</CollapsibleSection>

			<CollapsibleSection
				title="Communes"
				bind:collapsed={collapsed.commune}
				active={communeActive}
			>
				{#snippet collapsedSummary()}
					{#if communesNone}
						<span class="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700"
							>aucune</span
						>
					{:else if !communesAll}
						<span class="text-[10px] text-gray-500 tabular-nums">
							{communeSet.size} sélectionnée{communeSet.size > 1 ? 's' : ''}
						</span>
					{/if}
				{/snippet}
				{#snippet headerActions()}
					<div class="flex items-center gap-2">
						{#if !communesAll && !communesNone}
							<span
								class="rounded bg-brand-navy/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-navy tabular-nums"
								>{communeSet.size}</span
							>
						{:else if communesNone}
							<span class="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700"
								>aucune</span
							>
						{/if}
						<div class="flex gap-1 text-[10px]">
							<button
								type="button"
								onclick={selectAllCommunes}
								class="text-gray-400 hover:text-gray-700">tout</button
							>
							<span class="text-gray-300">·</span>
							<button
								type="button"
								onclick={clearCommunes}
								class="text-gray-400 hover:text-gray-700">aucun</button
							>
						</div>
					</div>
				{/snippet}
				<CommuneFilter
					arrondissements={ARRONDISSEMENTS}
					other={COMMUNES_OTHER}
					{communeSet}
					{communesAll}
					{communesNone}
					{communeBreakdown}
					{gravitySet}
					bind:search={communeSearch}
					onToggle={toggleCommune}
					onSolo={soloCommune}
					onSelectAll={selectAllCommunes}
					onClear={clearCommunes}
				/>
			</CollapsibleSection>

			<CollapsibleSection
				title="Type de collision"
				bind:collapsed={collapsed.collision}
				active={collisionActive}
			>
				{#snippet collapsedSummary()}
					{#if collisionActive}
						<span class="text-[10px] text-gray-500 tabular-nums">
							{collisionSet.size}/{COLLISION_TYPES.length}
						</span>
					{/if}
				{/snippet}
				{#snippet headerActions()}
					<div class="flex gap-1 text-[10px]">
						<button
							type="button"
							onclick={selectAllCollisions}
							class="text-gray-400 hover:text-gray-700">tout</button
						>
						<span class="text-gray-300">·</span>
						<button
							type="button"
							onclick={clearCollisions}
							class="text-gray-400 hover:text-gray-700">aucun</button
						>
					</div>
				{/snippet}
				<div class="flex flex-col">
					{#each sortedCollisionTypes as t (t)}
						{@const breakdown = collisionBreakdown.get(t)}
						{@const total = totalForBreakdown(breakdown, gravitySet)}
						<label
							class="group relative flex cursor-pointer items-center gap-2 rounded-md p-1 hover:bg-gray-50"
						>
							<Checkbox
								checked={collisionSet.has(t)}
								onCheckedChange={() => toggleCollision(t)}
								class="border-gray-300"
							/>
							<span class="flex-1 text-xs text-gray-700">{t}</span>
							<button
								type="button"
								onclick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									soloCollision(t);
								}}
								title="Sélectionner uniquement « {t} »"
								class="hidden text-[10px] font-semibold text-brand-navy group-hover:inline hover:underline"
							>
								seul
							</button>
							{#if gravitySet.size > 1 && breakdown}
								<span class="flex items-center gap-1.5 group-hover:hidden">
									{#each GRAVITIES as g (g.id)}
										{#if gravitySet.has(g.id)}
											<span
												class="flex items-center gap-0.5 text-[10px] tabular-nums"
												title={g.label}
											>
												<span
													class="inline-block h-1.5 w-1.5 rounded-full"
													style="background-color: {g.color}"
												></span>
												<span class="text-gray-500">{numFmt.format(breakdown[g.id])}</span>
											</span>
										{/if}
									{/each}
								</span>
							{:else}
								<span class="text-[10px] text-gray-400 tabular-nums group-hover:hidden">
									{numFmt.format(total)}
								</span>
							{/if}
						</label>
					{/each}
				</div>
			</CollapsibleSection>
		{/snippet}

		<!-- Desktop sidebar: same height as the map, with internal scrolling. -->
		<aside
			class="hidden w-full shrink-0 flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow lg:flex lg:w-80 lg:overflow-y-auto"
			style="max-height: calc(100svh - 160px); min-height: 480px;"
		>
			{@render filtersBody()}
		</aside>

		<!-- Mobile filter drawer: same snippet, opened via the floating
		     "Filtres" button. Lives inside this scope so it can reference
		     the `filtersBody` snippet defined above. -->
		<MobileDrawer bind:open={mobileFiltersOpen} snapPoints={[0.5, 0.92]} initialSnapPoint={1}>
			<div class="flex flex-col gap-4 px-2 py-2">
				{@render filtersBody()}
			</div>
		</MobileDrawer>
	</div>
</div>

{#if showPanoramax && selectedLngLat}
	<PanoramaxViewer
		coordinates={[selectedLngLat.lng, selectedLngLat.lat]}
		onClose={() => (showPanoramax = false)}
	/>
{/if}

<MethodologyDialog bind:open={sourceDialogOpen} {dataMaxYear} />
