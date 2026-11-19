<script lang="ts">
	import 'svelte-maplibre-gl/vite';
	import {
		MapLibre,
		AttributionControl,
		NavigationControl,
		GeolocateControl,
	} from 'svelte-maplibre-gl';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { useSearchParams } from 'runed/kit';
	import { type } from 'arktype';
	import { untrack } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { innerHeight } from 'svelte/reactivity/window';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Search from '@lucide/svelte/icons/search';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Maximize2 from '@lucide/svelte/icons/maximize-2';
	import Clock from '@lucide/svelte/icons/clock';
	import Palette from '@lucide/svelte/icons/palette';
	import X from '@lucide/svelte/icons/x';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import VelovLayer from '$lib/components/map/layers/VelovLayer.svelte';
	import OsmCyclewayLayer from '$lib/components/map/layers/OsmCyclewayLayer.svelte';
	import VelovDetails from '$lib/components/map/details/VelovDetails.svelte';
	import VelovStationList from '$lib/components/velov/VelovStationList.svelte';
	import VelovStats from '$lib/components/velov/VelovStats.svelte';
	import VelovForecast from '$lib/components/velov/VelovForecast.svelte';
	import VelovSimulationControls from '$lib/components/velov/VelovSimulationControls.svelte';
	import VelovSimulationTime from '$lib/components/velov/VelovSimulationTime.svelte';
	import VelovForecastKindToggle from '$lib/components/velov/VelovForecastKindToggle.svelte';
	import VelovLegend from '$lib/components/velov/VelovLegend.svelte';
	import type { Station } from '$lib/components/velov/types';
	import MapStyleToggle from '$lib/components/map/MapStyleToggle.svelte';
	import NavigationButtons from '$lib/components/map/NavigationButtons.svelte';
	import MapContextMenu from '$lib/components/map/MapContextMenu.svelte';
	import MobileDrawer from '$lib/components/MobileDrawer.svelte';
	import PanoramaxViewer from '$lib/components/PanoramaxViewer.svelte';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Image from '@lucide/svelte/icons/image';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import { createMapStyleState, MAP_STYLE_IDS } from '$lib/utils/mapStyleToggle.svelte';
	import { fetchVelovAvailability, velovStationUrl } from '$lib/utils/velovUtils';
	import { createVelovTimeline } from '$lib/utils/velovForecast';
	import { createVelovSimulation } from '$lib/utils/velovSimulation.svelte';
	import { velovForecastView } from '$lib/utils/velovForecastView.svelte';
	import { matchesAllTokens, tokenize } from '$lib/utils/textSearch';
	import { searchPanoramaxPhoto } from '$lib/utils/panoramax';
	import { loadDefaultProvider } from '$lib/config/navigationProviders';
	import { velovPalettePreference } from '$lib/utils/mapPreferences.svelte';
	import velovStaticUrl from '$lib/data/velov-data-grand-lyon.json?url';
	import type { FeatureCollection, Point } from 'geojson';
	import type * as maplibregl from 'maplibre-gl';

	const REFRESH_INTERVAL_MS = 60_000;
	const MOBILE_DRAWER_SNAP = 0.48;
	const MOBILE_DRAWER_MIN_HEIGHT = 372;
	const MOBILE_SHEET_INSET = 96;
	const LABELS_MIN_ZOOM = 15;
	const DESKTOP_PANEL_WIDTH = 392;
	const REVEAL_MARGIN = 56;
	const PIN_TAP_LIFT = 16;

	const paramsSchema = type({
		q: type('string').default(() => ''),
		commune: type('string').default(() => ''),
		status: type.enumerated('all', 'open', 'closed').default(() => 'all'),
		sort: type
			.enumerated('bikes', 'elec', 'mech', 'stands', 'capacity', 'name', 'distance')
			.default(() => 'bikes'),
		mapStyle: type.enumerated(...MAP_STYLE_IDS).default(() => 'cyclopolis'),
		zoom: type('number').default(() => 0),
		lat: type('number').default(() => 0),
		lng: type('number').default(() => 0),
		station: type('number').default(() => 0),
	});

	const params = useSearchParams(paramsSchema, { pushHistory: false, noScroll: true });

	const mapStyleState = createMapStyleState(params.mapStyle, (style) => {
		params.mapStyle = style;
	});

	let map: maplibregl.Map | undefined = $state();
	let stationDrawer: MobileDrawer | undefined = $state();
	let selectedStation: Station | null = $state(null);
	let panoramaxOpenCoords: [number, number] | null = $state(null);
	let defaultNavProvider = $state('cartes');
	const isMobile = new MediaQuery('(max-width: 767px)');

	const PANORAMAX_MOBILE_KEY = 'velov-show-panoramax-mobile';
	function loadShowPanoramaxOnMobile(): boolean {
		if (typeof globalThis.localStorage === 'undefined') {
			return false;
		}
		try {
			return localStorage.getItem(PANORAMAX_MOBILE_KEY) === 'true';
		} catch {
			return false;
		}
	}

	let showPanoramaxOnMobile = $state(loadShowPanoramaxOnMobile());

	function setShowPanoramaxOnMobile(value: boolean) {
		showPanoramaxOnMobile = value;
		if (typeof globalThis.localStorage === 'undefined') {
			return;
		}
		try {
			localStorage.setItem(PANORAMAX_MOBILE_KEY, value ? 'true' : 'false');
		} catch {}
	}

	let contextMenuVisible = $state(false);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);
	let contextMenuLngLat: { lng: number; lat: number } | null = $state(null);
	let touchTimeout: ReturnType<typeof setTimeout> | null = null;
	let touchStartPoint: { x: number; y: number } | null = null;

	function handleMapContextMenu(event: maplibregl.MapMouseEvent) {
		event.preventDefault();
		const e = event.originalEvent as MouseEvent;
		contextMenuVisible = true;
		contextMenuX = e.clientX;
		contextMenuY = e.clientY;
		contextMenuLngLat = { lng: event.lngLat.lng, lat: event.lngLat.lat };
	}

	function closeContextMenu() {
		contextMenuVisible = false;
		contextMenuLngLat = null;
	}

	function handleTouchStart(e: maplibregl.MapTouchEvent) {
		if (e.points.length !== 1) {
			return;
		}

		const point = e.point;
		const lngLat = e.lngLat;
		touchStartPoint = { x: point.x, y: point.y };
		touchTimeout = setTimeout(() => {
			contextMenuVisible = true;
			contextMenuX = e.originalEvent.touches[0].clientX;
			contextMenuY = e.originalEvent.touches[0].clientY;
			contextMenuLngLat = { lng: lngLat.lng, lat: lngLat.lat };
		}, 500);
	}

	function handleTouchMove(e: maplibregl.MapTouchEvent) {
		if (!touchStartPoint) {
			return;
		}

		const point = e.point;
		const dist = Math.sqrt((point.x - touchStartPoint.x) ** 2 + (point.y - touchStartPoint.y) ** 2);
		if (dist > 10) {
			if (touchTimeout) {
				clearTimeout(touchTimeout);
			}
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

	$effect(() => {
		defaultNavProvider = loadDefaultProvider();
	});

	let mapInitialized = false;
	$effect(() => {
		if (!map) {
			return;
		}

		if (mapInitialized) {
			return;
		}
		mapInitialized = true;

		untrack(() => {
			if (params.zoom > 0 && params.lat !== 0 && params.lng !== 0) {
				map!.jumpTo({ center: [params.lng, params.lat], zoom: params.zoom });
			}
			mapZoom = map!.getZoom();
		});

		const m = map;
		const onMoveEnd = () => {
			const c = m.getCenter();
			mapZoom = m.getZoom();
			params.update({
				lng: Number(c.lng.toFixed(5)),
				lat: Number(c.lat.toFixed(5)),
				zoom: Number(m.getZoom().toFixed(2)),
			});
		};

		m.on('moveend', onMoveEnd);

		return () => {
			m.off('moveend', onMoveEnd);
		};
	});

	let stationRestored = $state(false);
	$effect(() => {
		if (untrack(() => stationRestored)) {
			return;
		}

		if (stations.length === 0) {
			return;
		}

		untrack(() => {
			const id = params.station;
			if (id) {
				const s = stations.find((st) => st.idstation === id);
				if (s) {
					selectedStation = s;
					restoredStation = s;
				}
			}
			stationRestored = true;
		});
	});

	let restoredStation: Station | null = $state(null);
	$effect(() => {
		const m = map;
		const s = restoredStation;
		if (!m || !s) {
			return;
		}

		const timer = setTimeout(() => {
			restoredStation = null;
			revealStation(s, m.getZoom() < 14.5 ? 15.5 : undefined);
		}, 0);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		const id = selectedStation?.idstation ?? 0;
		if (!untrack(() => stationRestored)) {
			return;
		}

		if (untrack(() => params.station) === id) {
			return;
		}

		untrack(() => {
			params.station = id;
		});
	});

	const stationPanoramaxQuery = createQuery(() => ({
		queryKey: ['velov-panoramax', selectedStation?.idstation],
		queryFn: async () => {
			if (!selectedStation) {
				return null;
			}

			try {
				return await searchPanoramaxPhoto([selectedStation.lng, selectedStation.lat]);
			} catch {
				return null;
			}
		},
		enabled: !!selectedStation,
		retry: false,
		staleTime: 5 * 60_000,
	}));

	const staticQuery = createQuery(() => ({
		queryKey: ['velov-static'],
		queryFn: async (): Promise<FeatureCollection<Point>> => {
			const r = await fetch(velovStaticUrl);
			if (!r.ok) {
				throw new Error('Failed to load Vélo’v stations');
			}

			return (await r.json()) as FeatureCollection<Point>;
		},
		staleTime: Infinity,
	}));

	const liveQuery = createQuery(() => ({
		queryKey: ['velov-availability-page'],
		queryFn: () => fetchVelovAvailability(),
		refetchInterval: REFRESH_INTERVAL_MS,
		refetchOnWindowFocus: true,
		staleTime: 0,
	}));

	const queryClient = useQueryClient();
	let pinsSyncedAt = 0;
	$effect(() => {
		const updatedAt = liveQuery.dataUpdatedAt;
		if (!updatedAt) {
			return;
		}

		if (pinsSyncedAt && updatedAt !== pinsSyncedAt) {
			queryClient.invalidateQueries({ queryKey: ['velov-availability'] });
		}
		pinsSyncedAt = updatedAt;
	});

	const simulation = createVelovSimulation();

	let infoExpanded = $state(false);
	let mobileBarHeight = $state(0);
	let mapZoom = $state(12.5);

	const mobileBottomInset = $derived(
		!isMobile.current || infoExpanded
			? 0
			: selectedStation || simulation.active
				? MOBILE_SHEET_INSET
				: mobileBarHeight,
	);
	const labelsHint = $derived(mapZoom < LABELS_MIN_ZOOM ? 'Zoomez pour voir les chiffres.' : null);
	const simulationHint = $derived(
		simulation.step === 0 ? 'Choisissez une heure pour voir la prévision.' : labelsHint,
	);

	const simulationTimeline = $derived(
		createVelovTimeline(simulation.origin || liveQuery.dataUpdatedAt || Date.now()),
	);

	const stationSnap = $derived(
		Math.min(
			0.62,
			Math.max(MOBILE_DRAWER_SNAP, MOBILE_DRAWER_MIN_HEIGHT / (innerHeight.current || 800)),
		),
	);

	const stations = $derived.by<Station[]>(() => {
		const fc = staticQuery.data;
		const live = liveQuery.data;
		if (!fc || !live) {
			return [];
		}

		const out: Station[] = [];

		for (const f of fc.features) {
			const p = (f.properties ?? {}) as Record<string, unknown>;
			const id = Number(p.idstation);
			const a = live.get(id);
			if (!a) {
				continue;
			}

			const coords = (f.geometry as Point).coordinates as [number, number];
			out.push({
				idstation: id,
				nom: String(p.nom ?? a.name),
				commune: String(p.commune ?? a.commune ?? ''),
				adresse: String(p.adresse1 ?? a.address ?? ''),
				lng: coords[0],
				lat: coords[1],
				capacity: a.main_stands.capacity,
				bikes: a.main_stands.availabilities.bikes,
				mech: a.main_stands.availabilities.mechanicalBikes,
				elec: a.main_stands.availabilities.electricalBikes,
				stands: a.main_stands.availabilities.stands,
				status: a.status,
			});
		}

		return out;
	});

	const stationsById = $derived(new Map(stations.map((s) => [s.idstation, s])));

	function flyToStation(s: Station) {
		if (!map) {
			return;
		}

		selectedStation = s;
		revealStation(s, 16.5);
		if (infoExpanded) {
			window.scrollTo({ top: 0 });
		}
	}

	function handleMapClick(event: maplibregl.MapMouseEvent) {
		if (!map) {
			return;
		}

		const s = stationAt(event.point);
		if (!s && isMobile.current) {
			return;
		}

		selectedStation = s;
		if (s) {
			revealStation(s);
		}
	}

	function stationAt(point: maplibregl.Point): Station | null {
		if (!map) {
			return null;
		}

		const features = map.queryRenderedFeatures(point, {
			layers: ['velov-stations-layer-hitarea'],
		});
		const lift = simulation.kind !== 'velos' ? 0 : PIN_TAP_LIFT;
		let nearest: Station | null = null;
		let nearestDistance = Infinity;

		for (const feature of features) {
			const s = stationsById.get(Number(feature.properties?.idstation));
			if (!s) {
				continue;
			}

			const at = map.project([s.lng, s.lat]);
			const distance = Math.hypot(at.x - point.x, at.y - lift - point.y);
			if (distance < nearestDistance) {
				nearest = s;
				nearestDistance = distance;
			}
		}

		return nearest;
	}

	function revealStation(s: Station, zoom?: number) {
		if (!map) {
			return;
		}

		const container = map.getContainer();
		const width = container.clientWidth;
		const height = container.clientHeight;
		const left = isMobile.current ? 0 : DESKTOP_PANEL_WIDTH;
		const bottom = isMobile.current ? height - window.innerHeight * stationSnap : height;
		const at = map.project([s.lng, s.lat]);
		const visible =
			at.x > left + REVEAL_MARGIN &&
			at.x < width - REVEAL_MARGIN &&
			at.y > REVEAL_MARGIN + 24 &&
			at.y < bottom - 24;
		if (visible && zoom === undefined) {
			return;
		}

		const camera = {
			center: [s.lng, s.lat] as [number, number],
			offset: [left / 2, (bottom - height) / 2] as [number, number],
		};
		if (zoom === undefined) {
			map.easeTo({ ...camera, duration: 400 });
		} else {
			map.flyTo({ ...camera, zoom, duration: 800 });
		}
	}

	let mapSearch = $state('');
	let mapSearchOpen = $state(false);
	let mapSearchHighlight = $state(0);

	function toggleInfo() {
		infoExpanded = !infoExpanded;
		setTimeout(() => map?.resize(), 50);
	}

	const mapSearchResults = $derived.by<Station[]>(() => {
		const tokens = tokenize(mapSearch);
		if (tokens.length === 0) {
			return [];
		}

		const out: Station[] = [];
		for (const s of stations) {
			const hay = `${s.nom} ${s.adresse} ${s.commune} ${s.idstation}`;
			if (matchesAllTokens(hay, tokens)) {
				out.push(s);
				if (out.length >= 8) {
					break;
				}
			}
		}

		return out;
	});

	function pickMapSearch(s: Station) {
		mapSearch = '';
		mapSearchOpen = false;
		mapSearchHighlight = 0;
		const active = document.activeElement as HTMLElement | null;
		if (active && typeof active.blur === 'function') {
			active.blur();
		}
		flyToStation(s);
	}

	$effect(() => {
		mapSearch;
		mapSearchHighlight = 0;
	});

	function handleMapSearchKeydown(e: KeyboardEvent) {
		if (!mapSearchOpen || mapSearchResults.length === 0) {
			if (e.key === 'ArrowDown' && mapSearchResults.length > 0) {
				mapSearchOpen = true;
				e.preventDefault();
			}
			return;
		}

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			mapSearchHighlight = (mapSearchHighlight + 1) % mapSearchResults.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			mapSearchHighlight =
				(mapSearchHighlight - 1 + mapSearchResults.length) % mapSearchResults.length;
		} else if (e.key === 'Enter') {
			const pick = mapSearchResults[mapSearchHighlight];
			if (pick) {
				e.preventDefault();
				pickMapSearch(pick);
			}
		} else if (e.key === 'Escape') {
			mapSearchOpen = false;
		}
	}

	let cursor = $state('');
	function handleMouseMove(event: maplibregl.MapMouseEvent) {
		if (!map) {
			return;
		}

		const features = map.queryRenderedFeatures(event.point, {
			layers: ['velov-stations-layer-hitarea'],
		});

		cursor = features.length > 0 ? 'pointer' : '';
	}

	function isLayerVisible(id: string) {
		return id === 'velov';
	}

	const lastUpdated = $derived(liveQuery.dataUpdatedAt ? new Date(liveQuery.dataUpdatedAt) : null);
	const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

	function refresh() {
		liveQuery.refetch();
	}

	const colorBlindPalette = $derived(velovPalettePreference.id === 'daltonien');

	function togglePalette() {
		velovPalettePreference.id = colorBlindPalette ? 'classique' : 'daltonien';
	}

	const noopHandler = () => {};
</script>

{#snippet searchField(wrapperClass: string, inputClass: string)}
	<div class="relative {wrapperClass}">
		<Search
			class="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400"
		/>
		<input
			type="search"
			bind:value={mapSearch}
			onfocus={() => (mapSearchOpen = true)}
			onblur={() => setTimeout(() => (mapSearchOpen = false), 150)}
			onkeydown={handleMapSearchKeydown}
			aria-autocomplete="list"
			aria-controls="velov-map-search-results"
			aria-expanded={mapSearchOpen && mapSearchResults.length > 0}
			aria-activedescendant={mapSearchOpen && mapSearchResults.length > 0
				? `velov-search-opt-${mapSearchResults[mapSearchHighlight]?.idstation}`
				: undefined}
			placeholder="Rechercher une station…"
			class="w-full rounded-md bg-white py-2 pr-2 pl-8 text-base focus:outline-none md:py-1.5 md:text-sm {inputClass}"
		/>
		{#if mapSearchOpen && mapSearchResults.length > 0}
			<ul
				id="velov-map-search-results"
				role="listbox"
				class="absolute top-full right-0 left-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"
			>
				{#each mapSearchResults as s, i (s.idstation)}
					<li role="presentation">
						<button
							id={`velov-search-opt-${s.idstation}`}
							type="button"
							role="option"
							aria-selected={i === mapSearchHighlight}
							onmousedown={(e) => {
								e.preventDefault();
								pickMapSearch(s);
							}}
							onmouseenter={() => (mapSearchHighlight = i)}
							class="flex w-full flex-col gap-0.5 px-2 py-1.5 text-left text-xs hover:bg-gray-50 {i ===
							mapSearchHighlight
								? 'bg-gray-100'
								: ''}"
						>
							<span class="block w-full truncate font-medium text-gray-900">{s.nom}</span>
							<span class="block w-full truncate text-[10px] text-gray-500">
								{s.commune} · {s.bikes} vélo{s.bikes > 1 ? 's' : ''} / {s.capacity}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/snippet}

{#snippet toolbarButtons()}
	<button
		type="button"
		onclick={togglePalette}
		aria-pressed={colorBlindPalette}
		title="Couleurs adaptées aux daltoniens (vélos électriques en bleu)"
		aria-label="Couleurs adaptées aux daltoniens"
		class="rounded p-2.5 transition-colors md:p-0.5 {colorBlindPalette
			? 'bg-brand-navy text-white hover:bg-brand-navy/90'
			: 'text-gray-500 hover:bg-gray-100 hover:text-brand-navy'}"
	>
		<Palette class="h-4 w-4 md:h-3 md:w-3" />
	</button>
	<button
		type="button"
		onclick={refresh}
		title="Rafraîchir"
		aria-label="Rafraîchir les données"
		class="rounded p-2.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-navy disabled:opacity-50 md:p-0.5"
		disabled={liveQuery.isFetching}
	>
		<RefreshCw class="h-4 w-4 md:h-3 md:w-3 {liveQuery.isFetching ? 'animate-spin' : ''}" />
	</button>
{/snippet}

{#snippet stationForecast(station: Station)}
	{#if station.status !== 'CLOSED'}
		<VelovForecast
			stationId={station.idstation}
			bind:step={simulation.step}
			bind:kind={simulation.kind}
			simulatedLabel={simulation.active ? simulationTimeline.dayLabel(simulation.step) : null}
			onExpand={() => stationDrawer?.snapTo(2)}
			onCollapse={() => stationDrawer?.snapTo(1)}
		/>
	{/if}
{/snippet}

{#snippet stationPhoto(station: Station, panoramaxClass: string)}
	{@const showPanoramax = !isMobile.current || showPanoramaxOnMobile}
	{#if showPanoramax && !stationPanoramaxQuery.data && (stationPanoramaxQuery.isLoading || stationPanoramaxQuery.isFetching)}
		<div class="relative h-28 animate-pulse bg-gray-100 {panoramaxClass}" aria-hidden="true"></div>
	{:else if stationPanoramaxQuery.data && showPanoramax}
		<div class="relative h-28 overflow-hidden bg-gray-100 {panoramaxClass}">
			<button
				type="button"
				onclick={() => {
					panoramaxOpenCoords = [station.lng, station.lat];
				}}
				class="group block h-full w-full"
				aria-label="Voir la photo Panoramax"
			>
				<img
					src={stationPanoramaxQuery.data.thumbPicture}
					alt="Aperçu Panoramax de la station"
					class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
				/>
				<div
					class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-70"
				></div>
				<div class="absolute bottom-2 left-3 flex items-center gap-1.5 text-white/95">
					<span class="text-[11px] font-bold tracking-wider uppercase">Panoramax</span>
					<ExternalLink size={11} />
				</div>
			</button>
			{#if isMobile.current}
				<button
					type="button"
					onclick={() => setShowPanoramaxOnMobile(false)}
					class="absolute top-2 right-2 inline-flex items-center justify-center rounded-full bg-black/40 p-1.5 text-white shadow ring-1 ring-white/20 hover:bg-black/60 focus:ring-2 focus:ring-white focus:outline-none"
					aria-label="Masquer les photos Panoramax"
					title="Masquer les photos Panoramax"
				>
					<EyeOff size={14} />
				</button>
			{/if}
		</div>
	{:else if stationPanoramaxQuery.data && isMobile.current && !showPanoramaxOnMobile}
		<button
			type="button"
			onclick={() => setShowPanoramaxOnMobile(true)}
			class="inline-flex w-fit items-center gap-1.5 self-start rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		>
			<Image size={12} />
			Afficher la photo Panoramax
		</button>
	{/if}
{/snippet}

{#snippet stationDetails(station: Station)}
	{@render stationPhoto(station, '-mx-3 -mt-2 rounded-t-lg')}

	<VelovDetails
		showForecast={false}
		properties={{
			idstation: station.idstation,
			nom: station.nom,
			commune: station.commune,
			adresse1: station.adresse,
			status: station.status,
			available_bikes: station.bikes,
			available_stands: station.stands,
			mechanical_bikes: station.mech,
			electrical_bikes: station.elec,
			capacity: station.capacity,
		}}
	/>

	{@render stationForecast(station)}

	{@render stationActions(station)}
{/snippet}

{#snippet stationActions(station: Station)}
	<NavigationButtons
		lat={station.lat}
		lng={station.lng}
		defaultProviderId={defaultNavProvider}
		primaryOverride={{
			label: "Vélo'v",
			shortLabel: "Vélo'v",
			url: velovStationUrl(station.idstation),
		}}
	/>
{/snippet}

{#snippet stationSheetHeader(station: Station)}
	{@const isClosed = station.status === 'CLOSED'}
	<div>
		<h3 class="truncate text-base leading-tight font-bold text-gray-900">{station.nom}</h3>
		{#if isClosed}
			<p
				class="mt-1 inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700"
			>
				<CircleX size={12} />
				Station fermée
			</p>
		{:else}
			<p class="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-gray-600">
				<span class="font-semibold text-gray-900 tabular-nums">
					{station.bikes} vélo{station.bikes > 1 ? 's' : ''}
				</span>
				<span class="inline-flex items-center gap-1 text-xs tabular-nums">
					<span
						class="h-2 w-2 rounded-full"
						style:background-color={velovPalettePreference.colors.mech.fill}
						aria-hidden="true"
					></span>
					{station.mech} méca
					<span
						class="ml-1 h-2 w-2 rounded-full"
						style:background-color={velovPalettePreference.colors.elec.fill}
						aria-hidden="true"
					></span>
					{station.elec} élec
				</span>
				<span aria-hidden="true">·</span>
				<span class="font-semibold text-gray-900 tabular-nums">
					{station.stands} place{station.stands > 1 ? 's' : ''}
				</span>
			</p>
		{/if}
	</div>
{/snippet}

{#snippet stationSheetBody(station: Station)}
	{@const isClosed = station.status === 'CLOSED'}
	{@const outOfService = Math.max(0, station.capacity - station.bikes - station.stands)}
	{#if simulation.active && !velovForecastView.expanded && !isClosed}
		<div class="rounded-md border border-brand-navy/15 bg-brand-navy/5 px-3 py-2">
			<VelovSimulationControls {simulation} timeline={simulationTimeline} compact />
		</div>
	{/if}

	{@render stationForecast(station)}

	{@render stationActions(station)}

	<p class="flex items-center gap-1.5 text-xs text-gray-500">
		<MapPin size={12} class="shrink-0" />
		{station.adresse}{station.commune ? `, ${station.commune}` : ''} #{station.idstation}
		{#if outOfService > 0 && !isClosed}
			· {outOfService} borne{outOfService > 1 ? 's' : ''} hors service
		{/if}
	</p>

	{@render stationPhoto(station, 'rounded-lg')}
{/snippet}

<div
	class={infoExpanded
		? 'flex flex-col gap-6 pb-6'
		: 'fixed inset-x-0 top-11 bottom-0 flex flex-col overflow-hidden md:top-16'}
>
	<section>
		<div
			class="relative min-h-[360px] overflow-hidden bg-gray-100 shadow transition-[height] duration-300 ease-out {infoExpanded
				? 'h-[55svh]'
				: 'h-[calc(100svh-2.75rem)] md:h-[calc(100svh-4rem)]'} {!isMobile.current && selectedStation
				? 'velov-panel-open'
				: ''} {isMobile.current && !infoExpanded ? 'velov-mobile-inset' : ''}"
			style:--velov-bottom="{mobileBottomInset}px"
		>
			{#if liveQuery.isLoading || staticQuery.isLoading}
				<div
					class="absolute inset-0 z-10 flex items-center justify-center bg-white/20"
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
				zoom={12.5}
				minZoom={10}
				maxZoom={18}
				fadeDuration={0}
				attributionControl={false}
				{cursor}
				onclick={handleMapClick}
				onmousemove={handleMouseMove}
				oncontextmenu={handleMapContextMenu}
				ontouchstart={handleTouchStart}
				ontouchmove={handleTouchMove}
				ontouchend={handleTouchEnd}
			>
				<AttributionControl compact={true} position="bottom-left" />
				<NavigationControl position="top-right" showCompass={false} />
				{#if isMobile.current}
					<GeolocateControl
						position="bottom-right"
						positionOptions={{ enableHighAccuracy: true }}
						trackUserLocation={true}
						showAccuracyCircle={true}
					/>
				{:else}
					<GeolocateControl
						position="top-right"
						positionOptions={{ enableHighAccuracy: true }}
						trackUserLocation={true}
					/>
				{/if}
				<MapStyleToggle
					currentStyle={mapStyleState.mapStyle}
					onSelect={mapStyleState.setMapStyle}
					position="top-right"
					variant="thumbnail"
				/>

				<OsmCyclewayLayer
					isLayerVisible={(id) => id === 'osm-cycleways'}
					{map}
					opacityScale={0.4}
				/>

				<VelovLayer
					{isLayerVisible}
					handleMouseEnter={noopHandler}
					handleMouseLeave={noopHandler}
					{map}
					simulation={simulation.frame}
					kind={simulation.kind}
					selectedId={selectedStation?.idstation ?? null}
				/>
			</MapLibre>

			<div
				class="pointer-events-none absolute top-3 right-[3.75rem] left-3 z-20 flex flex-col gap-3 md:top-4 md:right-auto md:bottom-4 md:left-4 md:w-[360px]"
			>
				{#if isMobile.current}
					<div
						class="pointer-events-auto relative z-10 flex items-center rounded-xl bg-white/95 p-1 shadow-md ring-1 ring-gray-200 backdrop-blur-sm"
					>
						<h1 class="sr-only">Stations Vélo’v</h1>
						{@render searchField('min-w-0 flex-1', '')}
						<div class="flex shrink-0 items-center text-gray-500">
							{@render toolbarButtons()}
						</div>
					</div>
				{:else}
					<div
						class="pointer-events-auto relative z-10 shrink-0 rounded-lg bg-white/95 px-3 py-2 shadow-md ring-1 ring-gray-200 backdrop-blur-sm"
					>
						<div class="flex items-baseline justify-between gap-2">
							<h1 class="text-lg font-bold text-brand-navy">Stations Vélo’v</h1>
							<div class="flex items-center gap-1.5 text-[10px] text-gray-500">
								{#if lastUpdated}
									<span>{timeFmt.format(lastUpdated)}</span>
								{/if}
								{@render toolbarButtons()}
							</div>
						</div>

						{@render searchField(
							'mt-2',
							'border border-gray-200 shadow-sm focus:border-brand-navy focus:ring-1 focus:ring-brand-navy',
						)}

						<div class="mt-2 flex flex-col gap-1.5">
							<VelovForecastKindToggle bind:kind={simulation.kind} />
							{#if !simulation.active}
								<VelovLegend kind={simulation.kind} live />
								{#if labelsHint}
									<p class="text-[10px] text-gray-400">{labelsHint}</p>
								{/if}
							{/if}
						</div>

						<button
							type="button"
							aria-pressed={simulation.active}
							onclick={() => (simulation.active = !simulation.active)}
							class="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors {simulation.active
								? 'border-brand-navy bg-brand-navy text-white hover:bg-brand-navy/90'
								: 'border-gray-200 bg-white text-brand-navy hover:bg-gray-50'}"
						>
							<Clock class="h-3.5 w-3.5" />
							{simulation.active ? 'Revenir au temps réel' : 'Simuler la disponibilité'}
						</button>

						{#if simulation.active}
							<div class="mt-3">
								<VelovSimulationControls
									{simulation}
									timeline={simulationTimeline}
									showKinds={false}
									hint={simulationHint}
								/>
							</div>
						{/if}
					</div>

					{#if selectedStation}
						<aside
							class="pointer-events-auto relative flex min-h-0 flex-col overflow-y-auto rounded-lg bg-white shadow-md ring-1 ring-gray-200"
							aria-label="Station sélectionnée"
						>
							<button
								type="button"
								onclick={() => (selectedStation = null)}
								aria-label="Fermer"
								class="absolute top-2 right-2 z-10 inline-flex items-center justify-center rounded-full bg-white/90 p-1.5 text-gray-600 shadow ring-1 ring-black/10 hover:bg-white hover:text-gray-900"
							>
								<X size={14} />
							</button>
							<div class="flex flex-col gap-3 px-3 pt-2 pb-3">
								{@render stationDetails(selectedStation)}
							</div>
						</aside>
					{/if}
				{/if}
			</div>

			{#if isMobile.current && !selectedStation && !simulation.active && !infoExpanded}
				<div
					bind:clientHeight={mobileBarHeight}
					class="absolute inset-x-0 bottom-0 z-20 rounded-t-2xl border-t border-gray-200 bg-white px-4 pt-3 pb-3 shadow-[0_-6px_24px_rgba(0,0,0,0.12)]"
				>
					<VelovForecastKindToggle bind:kind={simulation.kind} />
					<div class="mt-2.5 flex items-center justify-between gap-3">
						<div class="min-w-0">
							<VelovLegend kind={simulation.kind} live />
							{#if labelsHint}
								<p class="mt-0.5 text-[10px] text-gray-400">{labelsHint}</p>
							{/if}
						</div>
						<button
							type="button"
							onclick={() => (simulation.active = true)}
							class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:bg-brand-navy/90"
						>
							<Clock class="h-4 w-4" />
							Simuler
						</button>
					</div>
				</div>
			{/if}

			<button
				type="button"
				onclick={toggleInfo}
				aria-label={infoExpanded ? 'Carte plein écran' : "Plus d'informations"}
				title={infoExpanded ? 'Carte plein écran' : "Plus d'informations"}
				style:bottom={isMobile.current ? `${mobileBottomInset + 72}px` : undefined}
				class="absolute right-2.5 z-20 inline-flex h-9 w-9 items-center justify-center rounded-md bg-white text-brand-navy shadow-md ring-1 ring-black/10 transition-colors hover:bg-gray-50 md:right-4 md:bottom-6 md:h-auto md:w-auto md:gap-1.5 md:rounded-lg md:bg-brand-navy md:px-3 md:py-2 md:text-xs md:font-semibold md:text-white md:hover:bg-brand-navy/90"
			>
				{#if infoExpanded}
					<Maximize2 class="h-4 w-4 md:h-3.5 md:w-3.5" />
					<span class="hidden md:inline">Carte plein écran</span>
				{:else}
					<span class="hidden md:inline">Plus d'informations</span>
					<ChevronDown class="h-5 w-5 md:h-3.5 md:w-3.5" />
				{/if}
			</button>
		</div>
	</section>

	{#if infoExpanded}
		<div class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
			<VelovStats {stations} />

			<VelovStationList
				{stations}
				bind:query={params.q}
				bind:commune={params.commune}
				bind:status={params.status}
				bind:sort={params.sort}
				onSelect={flyToStation}
			/>
		</div>
	{/if}
</div>

{#if panoramaxOpenCoords}
	<PanoramaxViewer coordinates={panoramaxOpenCoords} onClose={() => (panoramaxOpenCoords = null)} />
{/if}

{#if isMobile.current && selectedStation}
	{@const station = selectedStation}
	<MobileDrawer
		open={true}
		bind:this={stationDrawer}
		snapPoints={[stationSnap, 0.88]}
		initialSnapPoint={0}
		peek
		fit
		backdrop={false}
		dismissible={false}
		closeButton
		onClose={() => (selectedStation = null)}
	>
		{#snippet header()}
			{@render stationSheetHeader(station)}
		{/snippet}
		<div class="flex flex-col gap-3 px-2">
			{@render stationSheetBody(station)}
		</div>
	</MobileDrawer>
{:else if isMobile.current && simulation.active}
	<MobileDrawer
		open={true}
		snapPoints={[0.7]}
		initialSnapPoint={0}
		peek
		fit
		backdrop={false}
		dismissible={false}
		closeButton
		closeLabel="Revenir au temps réel"
		onClose={() => (simulation.active = false)}
	>
		{#snippet header()}
			<VelovSimulationTime {simulation} timeline={simulationTimeline} />
		{/snippet}
		<div class="px-2">
			<VelovSimulationControls
				{simulation}
				timeline={simulationTimeline}
				showTime={false}
				hint={simulationHint}
			/>
		</div>
	</MobileDrawer>
{/if}

<MapContextMenu
	visible={contextMenuVisible}
	x={contextMenuX}
	y={contextMenuY}
	lngLat={contextMenuLngLat}
	{defaultNavProvider}
	onClose={closeContextMenu}
/>

<style>
	:global(.velov-panel-open .maplibregl-ctrl-bottom-left) {
		left: 376px;
	}

	:global(.velov-mobile-inset .maplibregl-ctrl-bottom-left),
	:global(.velov-mobile-inset .maplibregl-ctrl-bottom-right) {
		bottom: calc(var(--velov-bottom) + 8px) !important;
	}
</style>
