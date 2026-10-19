<script lang="ts">
	import 'svelte-maplibre-gl/vite';
	import { untrack } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import {
		MapLibre,
		AttributionControl,
		NavigationControl,
		CustomControl,
		GeoJSONSource,
		FillLayer,
		LineLayer,
		SymbolLayer,
	} from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Maximize2 from '@lucide/svelte/icons/maximize-2';
	import Minimize2 from '@lucide/svelte/icons/minimize-2';
	import X from '@lucide/svelte/icons/x';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import communesLimitUrl from '$lib/data/communes_limit_arrondissements.json?url';
	import { createMapStyleState } from '$lib/utils/mapStyleToggle.svelte';
	import MapStyleToggle from '$lib/components/map/MapStyleToggle.svelte';
	import SpeedLimitsLayer from '$lib/components/map/layers/SpeedLimitsLayer.svelte';
	import Ville30SpeedBar from '$lib/components/ville30/Ville30SpeedBar.svelte';
	import { speedLimitsQueryOptions } from '$lib/queries/cyclewayQueries';
	import { SPEED_BUCKETS, SPEED_BUCKET_COLORS, type SpeedBucket } from '$lib/utils/speedLimits';
	import {
		PCT_RAMP,
		pctColor,
		type Ville30CommuneRow,
		type Ville30SearchParams,
	} from '$lib/utils/ville30';
	import type * as maplibregl from 'maplibre-gl';

	let {
		communes,
		params,
		fitRequest = 0,
		hoveredSlug = $bindable(null),
		onSelect,
	}: {
		communes: Ville30CommuneRow[];
		params: Ville30SearchParams;
		/** Changes whenever the selection is (re)requested, to re-frame even the same commune. */
		fitRequest?: number;
		hoveredSlug?: string | null;
		onSelect: (slug: string | null) => void;
	} = $props();

	const NAVY = '#23356b';
	const TEAL = '#79c2be';
	const METRO_BOUNDS: [[number, number], [number, number]] = [
		[4.6, 45.55],
		[5.05, 45.95],
	];

	const SPEED_LEGEND: { bucket: SpeedBucket; label: string }[] = [
		{ bucket: '5', label: 'Aire piétonne' },
		{ bucket: '30', label: '20 à 30 km/h' },
		{ bucket: '50', label: '50 km/h' },
		{ bucket: '70', label: '70 km/h et +' },
		{ bucket: 'unknown', label: 'Non renseignée' },
	];

	const isDesktop = new MediaQuery('(min-width: 1024px)');

	const pctFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
	const kmFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
	const dateFormatter = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'long' });

	const bySlug = $derived(new Map(communes.map((c) => [c.slug, c])));
	const byFeatureInsee = $derived.by(() => {
		const m = new Map<string, Ville30CommuneRow>();
		for (const c of communes) for (const insee of c.featureInsees) m.set(insee, c);
		return m;
	});

	const selected = $derived(bySlug.get(params.commune) ?? null);
	const hovered = $derived(hoveredSlug ? (bySlug.get(hoveredSlug) ?? null) : null);

	const insees = (pred: (c: Ville30CommuneRow) => boolean) =>
		communes.filter(pred).flatMap((c) => c.featureInsees);
	const fullInsees = $derived(insees((c) => c.status === 'full'));
	const partialInsees = $derived(insees((c) => c.status === 'partial'));

	const inList = (list: string[]): any => ['in', ['get', 'insee'], ['literal', list]];
	const fullFilter = $derived(inList(fullInsees));
	const partialFilter = $derived(inList(partialInsees));
	const hoverFilter = $derived(inList(hovered?.featureInsees ?? []));
	const selectedFilter = $derived(inList(selected?.featureInsees ?? []));

	function matchByInsee(
		value: (c: Ville30CommuneRow) => string | number,
		fallback: string | number,
	) {
		const expr: any[] = ['match', ['get', 'insee']];
		for (const c of communes) expr.push(c.featureInsees, value(c));
		expr.push(fallback);
		return expr;
	}

	const fillColor = $derived<any>(
		params.mode === 'pct'
			? matchByInsee((c) => pctColor(c.pct), '#e5e7eb')
			: matchByInsee((c) => (c.status === 'none' ? NAVY : TEAL), NAVY),
	);
	const baseFillOpacity = $derived<any>(
		params.mode === 'pct'
			? 0.75
			: matchByInsee(
					(c) => (c.status === 'full' ? 0.55 : c.status === 'partial' ? 0.22 : 0.04),
					0.04,
				),
	);
	// Once a commune is selected, fade the fills so that the speed limit lines stay readable.
	const fillOpacity = $derived<any>(
		selected ? ['case', selectedFilter, 0, ['*', baseFillOpacity, 0.45]] : baseFillOpacity,
	);

	const nameExpr: any = ['coalesce', ['get', 'nomreduit'], ['get', 'nom']];
	const labelField = $derived<any>(
		params.mode === 'pct'
			? [
					'concat',
					nameExpr,
					matchByInsee(
						(c) =>
							c.pct === null || c.featureInsees.length > 1
								? ''
								: `\n${pctFormatter.format(c.pct)} %`,
						'',
					),
				]
			: nameExpr,
	);

	const speedVisible = $derived(!!selected || params.allSpeeds);
	const speedQuery = createQuery(() => speedLimitsQueryOptions(speedVisible));
	const selectedBuckets = $derived(
		params.speedLimits.filter((b): b is SpeedBucket => (SPEED_BUCKETS as string[]).includes(b)),
	);

	function toggleBucket(bucket: SpeedBucket) {
		params.speedLimits = selectedBuckets.includes(bucket)
			? selectedBuckets.filter((b) => b !== bucket)
			: [...selectedBuckets, bucket];
	}

	const mapStyleState = createMapStyleState(
		untrack(() => params.mapStyle),
		(style) => {
			params.mapStyle = style;
		},
	);

	$effect(() => {
		const style = params.mapStyle;
		untrack(() => {
			if (style !== mapStyleState.mapStyle) mapStyleState.mapStyle = style;
		});
	});

	let map: maplibregl.Map | undefined = $state();
	let cursor: string | undefined = $state();
	let street: { name: string | null; speed: string | null; x: number; y: number } | null =
		$state(null);
	let pointer: { x: number; y: number } | null = $state(null);

	function fitPadding(): maplibregl.PaddingOptions | number {
		if (!isDesktop.current) return 16;
		return selected ? { top: 40, bottom: 40, left: 360, right: 60 } : 32;
	}

	function fitView(animate: boolean) {
		if (!map) return;
		// The selection panel may have just changed the map's height (mobile fullscreen).
		map.resize();
		const bounds = selected?.bbox
			? ([
					[selected.bbox[0], selected.bbox[1]],
					[selected.bbox[2], selected.bbox[3]],
				] as [[number, number], [number, number]])
			: METRO_BOUNDS;
		map.fitBounds(bounds, { padding: fitPadding(), animate, duration: 800 });
	}

	// Initial view: the saved position if any, otherwise the selected commune. Afterwards,
	// re-fit whenever the selection changes or is requested again.
	let fitted: { slug: string; request: number } | undefined;
	$effect(() => {
		const slug = params.commune;
		const request = fitRequest;
		if (!map) return;
		untrack(() => {
			if (fitted === undefined) {
				fitted = { slug, request };
				if (params.zoom > 0 && params.lat !== 0 && params.lng !== 0) {
					map!.jumpTo({ center: [params.lng, params.lat], zoom: params.zoom });
				} else if (selected) {
					fitView(false);
				}
				return;
			}
			if (slug === fitted.slug && request === fitted.request) return;
			fitted = { slug, request };
			street = null;
			fitView(true);
		});
	});

	// Re-frame after entering/leaving fullscreen unless the user moved the map themself.
	let lastFullscreen: boolean | undefined;
	$effect(() => {
		const fs = params.fullscreen;
		if (!map) return;
		if (lastFullscreen === undefined) {
			lastFullscreen = fs;
			return;
		}
		if (fs === lastFullscreen) return;
		lastFullscreen = fs;
		requestAnimationFrame(() => {
			map?.resize();
			if (untrack(() => params.zoom) === 0) fitView(false);
		});
	});

	// Persist the view in the URL, only for moves made by the user.
	$effect(() => {
		if (!map) return;
		const m = map;
		const onMoveEnd = (e: { originalEvent?: unknown }) => {
			if (!e.originalEvent) return;
			const c = m.getCenter();
			params.update({
				zoom: Number(m.getZoom().toFixed(2)),
				lat: Number(c.lat.toFixed(5)),
				lng: Number(c.lng.toFixed(5)),
			});
		};
		m.on('moveend', onMoveEnd);
		return () => {
			m.off('moveend', onMoveEnd);
		};
	});

	function communeAt(point: maplibregl.PointLike): Ville30CommuneRow | null {
		if (!map) return null;
		const insee = map.queryRenderedFeatures(point, { layers: ['ville30-fill'] })[0]?.properties
			?.insee as string | undefined;
		return insee ? (byFeatureInsee.get(insee) ?? null) : null;
	}

	function streetAt(point: maplibregl.Point) {
		if (!map || !speedVisible) return null;
		const props = map.queryRenderedFeatures(point, { layers: ['speed-limits-hitarea'] })[0]
			?.properties;
		if (!props) return null;
		return {
			name: (props.nomvoie1 as string | null) ?? null,
			speed: props.limitationvitesse != null ? String(props.limitationvitesse) : null,
			x: point.x,
			y: point.y,
		};
	}

	function handleMouseMove(e: maplibregl.MapMouseEvent) {
		const commune = communeAt(e.point);
		hoveredSlug = commune?.slug ?? null;
		street = streetAt(e.point);
		pointer = commune ? { x: e.point.x, y: e.point.y } : null;
		cursor = commune && commune.slug !== params.commune ? 'pointer' : undefined;
	}

	function handleMouseLeave() {
		hoveredSlug = null;
		street = null;
		pointer = null;
		cursor = undefined;
	}

	function handleClick(e: maplibregl.MapMouseEvent) {
		const commune = communeAt(e.point);
		if (commune && commune.slug !== params.commune) {
			onSelect(commune.slug);
			return;
		}
		street = streetAt(e.point);
	}

	function formatDate(date: string | null): string | null {
		if (!date) return null;
		const d = new Date(date);
		return Number.isNaN(d.getTime()) ? null : dateFormatter.format(d);
	}

	const tooltip = $derived.by(() => {
		if (street) {
			return {
				x: street.x,
				y: street.y,
				title: street.name ?? 'Voie sans nom',
				detail: street.speed ? `${street.speed} km/h` : 'Vitesse non renseignée',
			};
		}
		if (pointer && hovered && hovered.slug !== params.commune) {
			return {
				x: pointer.x,
				y: pointer.y,
				title: hovered.name,
				detail:
					hovered.pct === null
						? 'Cliquez pour voir le détail'
						: `${pctFormatter.format(hovered.pct)} % des rues à 30 km/h · cliquez pour zoomer`,
			};
		}
		return null;
	});

	let mapWidth = $state(0);

	// Collapsed by default on small screens, where the legend would hide most of the map.
	let legendOpenOverride: boolean | null = $state(null);
	const legendOpen = $derived(legendOpenOverride ?? isDesktop.current);
</script>

<div class="relative flex h-full min-h-0 flex-col gap-2 lg:gap-0">
	<div
		class="relative overflow-hidden rounded-lg shadow {params.fullscreen
			? 'min-h-0 flex-1'
			: 'h-[60svh] min-h-80 lg:h-auto lg:min-h-0 lg:flex-1'}"
		bind:clientWidth={mapWidth}
	>
		<MapLibre
			bind:map
			class="h-full w-full"
			style={mapStyleState.getMapStyleUrl()}
			bounds={METRO_BOUNDS}
			fitBoundsOptions={{ padding: 32 }}
			attributionControl={false}
			minZoom={9}
			maxZoom={17}
			{cursor}
			onclick={handleClick}
			onmousemove={handleMouseMove}
			onmouseout={handleMouseLeave}
		>
			<AttributionControl compact={true} position="bottom-right" />
			<NavigationControl position="top-right" showCompass={false} />
			<CustomControl position="top-right">
				<button
					type="button"
					onclick={() => (params.fullscreen = !params.fullscreen)}
					class="pl-1!"
					aria-label={params.fullscreen ? 'Quitter le plein écran' : 'Carte en plein écran'}
					title={params.fullscreen ? 'Quitter le plein écran (Échap)' : 'Carte en plein écran'}
				>
					{#if params.fullscreen}
						<Minimize2 size={18} />
					{:else}
						<Maximize2 size={18} />
					{/if}
				</button>
			</CustomControl>
			<MapStyleToggle
				currentStyle={mapStyleState.mapStyle}
				onSelect={mapStyleState.setMapStyle}
				position="top-right"
			/>

			<GeoJSONSource id="ville30-communes" data={communesLimitUrl}>
				<FillLayer
					id="ville30-fill"
					paint={{ 'fill-color': fillColor, 'fill-opacity': fillOpacity }}
				/>
				<FillLayer
					id="ville30-fill-hover"
					filter={hoverFilter}
					paint={{ 'fill-color': NAVY, 'fill-opacity': 0.15 }}
				/>
				<LineLayer
					id="ville30-outline"
					paint={{ 'line-color': '#1e3a5f', 'line-width': 1, 'line-opacity': 0.5 }}
				/>
				<LineLayer
					id="ville30-outline-adopted"
					filter={fullFilter}
					layout={{ visibility: params.mode === 'status' ? 'visible' : 'none' }}
					paint={{ 'line-color': NAVY, 'line-width': 1.5, 'line-opacity': 0.9 }}
				/>
				<LineLayer
					id="ville30-outline-partial"
					filter={partialFilter}
					layout={{ visibility: params.mode === 'status' ? 'visible' : 'none' }}
					paint={{
						'line-color': NAVY,
						'line-width': 1.5,
						'line-opacity': 0.9,
						'line-dasharray': [3, 2],
					}}
				/>
				<LineLayer
					id="ville30-outline-hover"
					filter={hoverFilter}
					paint={{ 'line-color': NAVY, 'line-width': 2.5, 'line-opacity': 1 }}
				/>
				<LineLayer
					id="ville30-outline-selected"
					filter={selectedFilter}
					paint={{ 'line-color': NAVY, 'line-width': 3.5, 'line-opacity': 1 }}
				/>
				<SymbolLayer
					id="ville30-label"
					minzoom={9}
					layout={{
						'text-field': labelField,
						'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 13, 14],
						'text-font': ['Open Sans Semibold'],
						'text-allow-overlap': false,
						'text-ignore-placement': false,
					}}
					paint={{
						'text-color': '#1e3a5f',
						'text-halo-color': '#ffffff',
						'text-halo-width': 1.5,
					}}
				/>
			</GeoJSONSource>

			<SpeedLimitsLayer
				isLayerVisible={(id) => id === 'speed-limits' && speedVisible}
				insees={selected?.streetInsees}
				{selectedBuckets}
			/>
		</MapLibre>

		<div
			class="pointer-events-none absolute top-2.5 left-2.5 flex max-w-[calc(100%-4.5rem)] flex-col gap-2"
		>
			<label class="pointer-events-auto relative block w-72 max-w-full lg:hidden">
				<span class="sr-only">Choisir une commune</span>
				<select
					value={params.commune}
					onchange={(e) => onSelect(e.currentTarget.value || null)}
					class="w-full appearance-none truncate rounded-lg border border-gray-200 bg-white py-2 pr-9 pl-3 text-base font-semibold text-brand-navy shadow-md focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/30 focus:outline-none"
				>
					<option value="">Choisir une commune…</option>
					{#each communes as c (c.slug)}
						<option value={c.slug}>{c.name}</option>
					{/each}
				</select>
				<ChevronDown
					class="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-brand-navy"
					aria-hidden="true"
				/>
			</label>

			{#if !selected}
				<div class="pointer-events-auto w-fit rounded-lg bg-white/95 px-3 py-2 shadow">
					<div class="flex items-center gap-1.5">
						<div
							class="inline-flex rounded-md bg-gray-100 p-0.5 text-[11px] font-semibold"
							role="group"
							aria-label="Couleur des communes"
						>
							<button
								type="button"
								aria-pressed={params.mode === 'status'}
								onclick={() => (params.mode = 'status')}
								class="rounded px-2 py-1 {params.mode === 'status'
									? 'bg-white text-brand-navy shadow-sm'
									: 'text-gray-500 hover:text-brand-navy'}"
							>
								Statut Ville 30
							</button>
							<button
								type="button"
								aria-pressed={params.mode === 'pct'}
								onclick={() => (params.mode = 'pct')}
								class="rounded px-2 py-1 {params.mode === 'pct'
									? 'bg-white text-brand-navy shadow-sm'
									: 'text-gray-500 hover:text-brand-navy'}"
							>
								% de rues à 30
							</button>
						</div>
						<button
							type="button"
							onclick={() => (legendOpenOverride = !legendOpen)}
							aria-expanded={legendOpen}
							aria-label={legendOpen ? 'Masquer la légende' : 'Afficher la légende'}
							class="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-brand-navy"
						>
							<ChevronDown class="h-4 w-4 transition-transform {legendOpen ? 'rotate-180' : ''}" />
						</button>
					</div>

					{#if legendOpen && params.mode === 'status'}
						<ul class="mt-2 space-y-1 text-xs text-gray-700">
							<li class="flex items-center gap-2">
								<span class="inline-block h-3 w-3 rounded-sm bg-brand-teal/60"></span>
								Ville 30 ({communes.filter((c) => c.status === 'full').length})
							</li>
							{#if partialInsees.length > 0}
								<li class="flex items-center gap-2">
									<span class="inline-block h-3 w-3 rounded-sm bg-brand-teal/25"></span>
									Partiellement ({communes.filter((c) => c.status === 'partial').length})
								</li>
							{/if}
							<li class="flex items-center gap-2">
								<span
									class="inline-block h-3 w-3 rounded-sm border border-brand-navy/30 bg-brand-navy/5"
								></span>
								Non adoptée ({communes.filter((c) => c.status === 'none').length})
							</li>
						</ul>
					{:else if legendOpen}
						<div class="mt-2 w-44 text-xs text-gray-700">
							<div
								class="h-2.5 rounded-sm"
								style="background: linear-gradient(to right, {PCT_RAMP.map(
									([stop, color]) => `${color} ${stop}%`,
								).join(', ')})"
							></div>
							<div class="mt-0.5 flex justify-between text-[10px] text-gray-500 tabular-nums">
								<span>0 %</span><span>50 %</span><span>100 %</span>
							</div>
							<p class="mt-1 text-[10px] leading-tight text-gray-500">
								Part des rues limitées à 30 km/h ou moins
							</p>
						</div>
					{/if}

					<label class="mt-2 flex cursor-pointer items-center gap-2 text-xs text-brand-navy">
						<input
							type="checkbox"
							class="h-4 w-4 accent-brand-navy"
							bind:checked={params.allSpeeds}
						/>
						Limitations de vitesse
					</label>
					{#if params.allSpeeds}
						<ul class="mt-1.5 space-y-0.5">
							{#each SPEED_LEGEND.slice(0, 4) as item (item.bucket)}
								{@const active = selectedBuckets.includes(item.bucket)}
								<li>
									<button
										type="button"
										aria-pressed={active}
										onclick={() => toggleBucket(item.bucket)}
										class="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-[11px] text-gray-700 hover:bg-gray-100 {active
											? 'bg-gray-100 font-semibold'
											: ''} {selectedBuckets.length > 0 && !active ? 'opacity-50' : ''}"
									>
										<span
											class="inline-block h-1 w-4 rounded-full"
											style="background-color: {SPEED_BUCKET_COLORS[item.bucket]}"
										></span>
										{item.label}
									</button>
								</li>
							{/each}
						</ul>
						{#if selectedBuckets.length > 0}
							<button
								type="button"
								class="mt-0.5 px-1 text-[11px] text-gray-500 underline hover:text-gray-700"
								onclick={() => (params.speedLimits = [])}
							>
								Tout afficher
							</button>
						{/if}
					{/if}
				</div>
			{/if}
		</div>

		{#if tooltip}
			<div
				class="pointer-events-none absolute z-10 max-w-60 rounded-md bg-white/95 px-2.5 py-1.5 text-xs shadow-md ring-1 ring-black/5"
				style="left: {Math.min(tooltip.x + 12, Math.max(0, mapWidth - 250))}px; top: {tooltip.y +
					12}px"
			>
				<div class="font-semibold text-brand-navy">{tooltip.title}</div>
				<div class="text-gray-600">{tooltip.detail}</div>
			</div>
		{/if}
	</div>

	{#if selected}
		{@const date = formatDate(selected.adoptedAt)}
		<section
			class="overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-sm lg:absolute lg:bottom-3 lg:left-3 lg:z-10 lg:max-h-[calc(100%-1.5rem)] lg:w-80 lg:border-0 lg:shadow-lg {params.fullscreen
				? 'max-h-[45%] shrink-0'
				: ''}"
			aria-label="Commune sélectionnée"
		>
			<div class="flex items-start justify-between gap-2">
				<div class="min-w-0">
					<h2 class="truncate text-base font-bold text-brand-navy">{selected.name}</h2>
					{#if selected.status === 'full'}
						<p class="text-xs font-medium text-brand-navy">
							<span class="mr-1 inline-block h-2 w-2 rounded-full bg-brand-teal"></span>Ville 30{date
								? ` depuis ${date}`
								: ''}
						</p>
					{:else if selected.status === 'partial'}
						<p class="text-xs font-medium text-amber-800">
							<span class="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400"></span>Ville 30
							partielle{date ? ` depuis ${date}` : ''}
						</p>
					{:else}
						<p class="text-xs text-gray-500">
							<span class="mr-1 inline-block h-2 w-2 rounded-full bg-gray-300"></span>N'a pas adopté
							le statut Ville 30
						</p>
					{/if}
				</div>
				<button
					type="button"
					onclick={() => onSelect(null)}
					class="-mt-1 -mr-1 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
					aria-label="Fermer et revenir à la Métropole"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			{#if selected.pct !== null}
				<div class="mt-2 flex items-baseline gap-2">
					<span class="text-2xl font-bold text-brand-navy tabular-nums">
						{pctFormatter.format(selected.pct)}&nbsp;%
					</span>
					<span class="text-xs leading-tight text-gray-600">des rues à 30&nbsp;km/h ou moins</span>
				</div>
				<Ville30SpeedBar pct={selected.pct} class="mt-1.5" />
				<p class="mt-1 text-[11px] leading-snug text-gray-500">
					{kmFormatter.format(selected.eligibleUnder30Km)}&nbsp;km sur {kmFormatter.format(
						selected.eligibleKm,
					)}&nbsp;km, hors voies rapides (≥&nbsp;70&nbsp;km/h) et aires piétonnes
				</p>
			{:else}
				<p class="mt-2 text-xs text-gray-500 italic">Données de vitesse indisponibles.</p>
			{/if}

			{#if selected.status === 'partial' && selected.partialNote}
				<p class="mt-2 text-[11px] leading-snug text-amber-800">{selected.partialNote}</p>
			{/if}

			<div class="mt-3">
				<div class="mb-1 flex items-center justify-between">
					<h3 class="text-[11px] font-bold tracking-wider text-brand-navy uppercase">
						Limitations sur la carte
					</h3>
					{#if speedQuery.isFetching}
						<span class="inline-flex items-center gap-1 text-[11px] text-gray-500">
							<LoaderCircle class="h-3 w-3 animate-spin" /> Chargement…
						</span>
					{:else if selectedBuckets.length > 0}
						<button
							type="button"
							class="text-[11px] text-gray-500 underline hover:text-gray-700"
							onclick={() => (params.speedLimits = [])}
						>
							Tout afficher
						</button>
					{/if}
				</div>
				<ul class="grid grid-cols-2 gap-1">
					{#each SPEED_LEGEND as item (item.bucket)}
						{@const km = selected.kmByBucket[item.bucket] ?? 0}
						{@const active = selectedBuckets.includes(item.bucket)}
						{#if item.bucket !== 'unknown' || km > 0}
							<li>
								<button
									type="button"
									aria-pressed={active}
									onclick={() => toggleBucket(item.bucket)}
									class="flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight transition-colors {active
										? 'border-brand-navy bg-brand-navy/5 font-semibold'
										: 'border-gray-200 hover:bg-gray-50'} {selectedBuckets.length > 0 && !active
										? 'opacity-50'
										: ''}"
								>
									<span
										class="inline-block h-1 w-4 shrink-0 rounded-full"
										style="background-color: {SPEED_BUCKET_COLORS[item.bucket]}"
										aria-hidden="true"
									></span>
									<span class="min-w-0 flex-1 text-gray-700">
										{item.label}
										<span class="block text-gray-500 tabular-nums"
											>{kmFormatter.format(km)}&nbsp;km</span
										>
									</span>
								</button>
							</li>
						{/if}
					{/each}
				</ul>
			</div>

			<a
				href="/communes/{selected.slug}"
				class="mt-3 flex items-center justify-center gap-1.5 rounded-md bg-brand-navy px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-navy/90"
			>
				Voir la page de {selected.name}
				<ArrowRight class="h-4 w-4" />
			</a>
		</section>
	{/if}
</div>
