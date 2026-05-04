<script lang="ts">
	import {
		MapLibre,
		AttributionControl,
		NavigationControl,
		GeolocateControl,
		Popup,
		Marker,
	} from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import { useSearchParams } from 'runed/kit';
	import { type } from 'arktype';
	import { untrack } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Search from '@lucide/svelte/icons/search';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Maximize2 from '@lucide/svelte/icons/maximize-2';
	import VelovLayer from '$lib/components/map/layers/VelovLayer.svelte';
	import OsmCyclewayLayer from '$lib/components/map/layers/OsmCyclewayLayer.svelte';
	import VelovDetails from '$lib/components/map/details/VelovDetails.svelte';
	import VelovStationList from '$lib/components/velov/VelovStationList.svelte';
	import VelovStats from '$lib/components/velov/VelovStats.svelte';
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
	import { matchesAllTokens, tokenize } from '$lib/utils/textSearch';
	import { searchPanoramaxPhoto } from '$lib/utils/panoramax';
	import { loadDefaultProvider } from '$lib/config/navigationProviders';
	import velovStaticUrl from '$lib/data/velov-data-grand-lyon.json?url';
	import type { FeatureCollection, Point } from 'geojson';
	import type maplibregl from 'maplibre-gl';

	const REFRESH_INTERVAL_MS = 60_000;

	const paramsSchema = type({
		q: type('string').default(() => ''),
		commune: type('string').default(() => ''),
		status: type.enumerated('all', 'open', 'closed').default(() => 'all'),
		sort: type
			.enumerated('bikes', 'elec', 'mech', 'stands', 'capacity', 'name')
			.default(() => 'bikes'),
		mapStyle: type.enumerated(...MAP_STYLE_IDS).default(() => 'neutrino'),
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
		});

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
				}
			}
			stationRestored = true;
		});
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

	function flyToStation(s: Station) {
		if (!map) {
			return;
		}

		map.flyTo({ center: [s.lng, s.lat], zoom: 17, duration: 800 });
		selectedStation = s;
	}

	function handleMapClick(event: maplibregl.MapMouseEvent) {
		if (!map) {
			return;
		}

		const features = map.queryRenderedFeatures(event.point, {
			layers: ['velov-stations-layer-hitarea'],
		});

		if (features.length === 0) {
			selectedStation = null;
			return;
		}

		const f = features[0];
		const id = Number(f.properties?.idstation);
		const s = stations.find((st) => st.idstation === id);

		if (s) {
			selectedStation = s;
		}
	}

	let mapSearch = $state('');
	let mapSearchOpen = $state(false);
	let mapSearchHighlight = $state(0);
	let infoExpanded = $state(false);

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

	const noopHandler = () => {};
</script>

{#snippet stationDetails(station: Station, panoramaxRoundedTop: boolean)}
	{@const showPanoramax = !isMobile.current || showPanoramaxOnMobile}
	{#if showPanoramax && !stationPanoramaxQuery.data && (stationPanoramaxQuery.isLoading || stationPanoramaxQuery.isFetching)}
		<div
			class="relative -mx-3 -mt-2 h-28 animate-pulse bg-gray-100 {panoramaxRoundedTop
				? 'rounded-t-lg'
				: ''}"
			aria-hidden="true"
		></div>
	{:else if stationPanoramaxQuery.data && showPanoramax}
		<div
			class="relative -mx-3 -mt-2 h-28 overflow-hidden bg-gray-100 {panoramaxRoundedTop
				? 'rounded-t-lg'
				: ''}"
		>
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

	<VelovDetails
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

<div
	class={infoExpanded
		? 'flex flex-col gap-6 pb-6'
		: 'fixed inset-x-0 top-16 bottom-0 flex flex-col overflow-hidden'}
>
	<section class={infoExpanded ? '-mx-4 sm:-mx-6 lg:-mx-8' : ''}>
		<div
			class="relative overflow-hidden bg-gray-100 shadow transition-[height] duration-300 ease-out"
			style="height: {infoExpanded ? '55svh' : 'calc(100svh - 64px)'}; min-height: 360px;"
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
				/>

				{#if selectedStation}
					{#snippet selectedHalo()}
						<span class="velov-selected-halo" aria-hidden="true"></span>
					{/snippet}
					<Marker
						lnglat={[selectedStation.lng, selectedStation.lat]}
						offset={[0, -22]}
						content={selectedHalo}
					/>
					{#if !isMobile.current}
						<Popup
							lnglat={[selectedStation.lng, selectedStation.lat]}
							closeButton={true}
							closeOnClick={false}
							offset={14}
							maxWidth="320px"
							onclose={() => (selectedStation = null)}
						>
							<div class="flex w-[260px] flex-col gap-3 sm:w-[280px]">
								{@render stationDetails(selectedStation, true)}
							</div>
						</Popup>
					{/if}
				{/if}
			</MapLibre>

			<div
				class="velov-control absolute top-4 left-4 z-20 w-[260px] rounded-lg bg-white/95 px-3 py-2 shadow-md ring-1 ring-gray-200 backdrop-blur-sm sm:w-[300px]"
			>
				<div class="flex items-baseline justify-between gap-2">
					<h1 class="text-base font-bold text-brand-navy md:text-lg">Stations Vélo’v</h1>
					<div class="flex items-center gap-1.5 text-[10px] text-gray-500">
						{#if lastUpdated}
							<span>{timeFmt.format(lastUpdated)}</span>
						{/if}
						<button
							type="button"
							onclick={refresh}
							title="Rafraîchir"
							aria-label="Rafraîchir les données"
							class="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-navy disabled:opacity-50 md:p-0.5"
							disabled={liveQuery.isFetching}
						>
							<RefreshCw
								class="h-4 w-4 md:h-3 md:w-3 {liveQuery.isFetching ? 'animate-spin' : ''}"
							/>
						</button>
					</div>
				</div>

				<div class="relative mt-2">
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
						class="w-full rounded-md border border-gray-200 bg-white py-1.5 pr-2 pl-8 text-sm shadow-sm focus:border-brand-navy focus:ring-1 focus:ring-brand-navy focus:outline-none"
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
											{s.commune} · {s.bikes} vélos / {s.capacity}
										</span>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>

			<button
				type="button"
				onclick={toggleInfo}
				aria-label={infoExpanded ? 'Carte plein écran' : "Plus d'informations"}
				title={infoExpanded ? 'Carte plein écran' : "Plus d'informations"}
				class="absolute right-2.5 bottom-[80px] z-20 inline-flex h-9 w-9 items-center justify-center rounded-md bg-white text-brand-navy shadow-md ring-1 ring-black/10 transition-colors hover:bg-gray-50 md:right-4 md:bottom-6 md:h-auto md:w-auto md:gap-1.5 md:rounded-lg md:bg-brand-navy md:px-3 md:py-2 md:text-xs md:font-semibold md:text-white md:hover:bg-brand-navy/90"
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
		<VelovStats {stations} />

		<VelovStationList
			{stations}
			bind:query={params.q}
			bind:commune={params.commune}
			bind:status={params.status}
			bind:sort={params.sort}
			onSelect={flyToStation}
		/>
	{/if}
</div>

{#if panoramaxOpenCoords}
	<PanoramaxViewer coordinates={panoramaxOpenCoords} onClose={() => (panoramaxOpenCoords = null)} />
{/if}

{#if isMobile.current && selectedStation}
	<MobileDrawer
		open={true}
		snapPoints={[0.4, 0.85]}
		initialSnapPoint={0}
		class=""
		onClose={() => (selectedStation = null)}
	>
		<div class="flex flex-col gap-3 px-3 pt-1">
			{@render stationDetails(selectedStation, false)}
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
	:global(.velov-selected-halo) {
		display: block;
		width: 64px;
		height: 64px;
		border-radius: 9999px;
		background: transparent;
		border: 3px solid rgba(20, 100, 220, 0.85);
		box-shadow:
			0 0 0 6px rgba(20, 100, 220, 0.18),
			0 0 14px 2px rgba(20, 100, 220, 0.4);
		pointer-events: none;
	}
</style>
