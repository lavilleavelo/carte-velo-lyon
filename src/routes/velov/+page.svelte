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
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Search from '@lucide/svelte/icons/search';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Maximize2 from '@lucide/svelte/icons/maximize-2';
	import VelovLayer from '$lib/components/map/layers/VelovLayer.svelte';
	import VelovDetails from '$lib/components/map/details/VelovDetails.svelte';
	import VelovStationList from '$lib/components/velov/VelovStationList.svelte';
	import VelovStats from '$lib/components/velov/VelovStats.svelte';
	import type { Station } from '$lib/components/velov/types';
	import MapStyleToggle from '$lib/components/map/MapStyleToggle.svelte';
	import NavigationButtons from '$lib/components/map/NavigationButtons.svelte';
	import PanoramaxViewer from '$lib/components/PanoramaxViewer.svelte';
	import ExternalLink from '@lucide/svelte/icons/external-link';
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
	});

	const params = useSearchParams(paramsSchema, { pushHistory: false, noScroll: true });

	const mapStyleState = createMapStyleState(params.mapStyle, (style) => {
		params.mapStyle = style;
	});

	let map: maplibregl.Map | undefined = $state();
	let selectedStation: Station | null = $state(null);
	let panoramaxOpenCoords: [number, number] | null = $state(null);
	let defaultNavProvider = $state('cartes');

	$effect(() => {
		defaultNavProvider = loadDefaultProvider();
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
		flyToStation(s);
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

<div
	class={infoExpanded
		? 'flex flex-col gap-6 pb-6'
		: 'fixed inset-x-0 top-16 bottom-0 flex flex-col overflow-hidden'}
>
	<section class={infoExpanded ? '-mx-4 sm:-mx-6 lg:-mx-8' : ''}>
		<div
			class="relative overflow-hidden shadow transition-[height] duration-300 ease-out"
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
			>
				<AttributionControl compact={true} position="bottom-left" />
				<NavigationControl position="top-right" showCompass={false} />
				<GeolocateControl
					position="top-right"
					positionOptions={{ enableHighAccuracy: true }}
					trackUserLocation={true}
				/>
				<MapStyleToggle
					currentStyle={mapStyleState.mapStyle}
					onSelect={mapStyleState.setMapStyle}
					position="top-right"
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
					<Popup
						lnglat={[selectedStation.lng, selectedStation.lat]}
						closeButton={true}
						closeOnClick={false}
						offset={14}
						maxWidth="320px"
						onclose={() => (selectedStation = null)}
					>
						<div class="flex w-[260px] flex-col gap-3 sm:w-[280px]">
							{#if stationPanoramaxQuery.data}
								<button
									type="button"
									onclick={() => {
										if (selectedStation) {
											panoramaxOpenCoords = [selectedStation.lng, selectedStation.lat];
										}
									}}
									class="group relative -mx-3 -mt-2 block h-28 overflow-hidden rounded-t-lg bg-gray-100"
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
										<span class="text-[11px] font-bold tracking-wider uppercase"> Panoramax </span>
										<ExternalLink size={11} />
									</div>
								</button>
							{/if}

							<VelovDetails
								properties={{
									idstation: selectedStation.idstation,
									nom: selectedStation.nom,
									commune: selectedStation.commune,
									adresse1: selectedStation.adresse,
									status: selectedStation.status,
									available_bikes: selectedStation.bikes,
									available_stands: selectedStation.stands,
									mechanical_bikes: selectedStation.mech,
									electrical_bikes: selectedStation.elec,
									capacity: selectedStation.capacity,
								}}
							/>

							<NavigationButtons
								lat={selectedStation.lat}
								lng={selectedStation.lng}
								defaultProviderId={defaultNavProvider}
								primaryOverride={{
									label: "Vélo'v",
									shortLabel: "Vélo'v",
									url: velovStationUrl(selectedStation.idstation),
								}}
							/>
						</div>
					</Popup>
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
							class="rounded p-0.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-navy disabled:opacity-50"
							disabled={liveQuery.isFetching}
						>
							<RefreshCw class="h-3 w-3 {liveQuery.isFetching ? 'animate-spin' : ''}" />
						</button>
					</div>
				</div>

				<div class="relative mt-2">
					<Search
						class="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
					/>
					<input
						type="search"
						bind:value={mapSearch}
						onfocus={() => (mapSearchOpen = true)}
						onblur={() => setTimeout(() => (mapSearchOpen = false), 150)}
						placeholder="Rechercher une station…"
						class="w-full rounded-md border border-gray-200 bg-white py-1 pr-2 pl-7 text-xs shadow-sm focus:border-brand-navy focus:ring-1 focus:ring-brand-navy focus:outline-none"
					/>
					{#if mapSearchOpen && mapSearchResults.length > 0}
						<ul
							class="absolute top-full right-0 left-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"
						>
							{#each mapSearchResults as s (s.idstation)}
								<li>
									<button
										type="button"
										onmousedown={(e) => {
											e.preventDefault();
											pickMapSearch(s);
										}}
										class="flex w-full flex-col gap-0.5 px-2 py-1.5 text-left text-xs hover:bg-gray-50"
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
				class="absolute right-4 bottom-6 z-20 inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white shadow-lg ring-1 ring-black/10 transition-colors hover:bg-brand-navy/90"
			>
				{#if infoExpanded}
					<Maximize2 class="h-3.5 w-3.5" />
					Carte plein écran
				{:else}
					Plus d'informations
					<ChevronDown class="h-3.5 w-3.5" />
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
