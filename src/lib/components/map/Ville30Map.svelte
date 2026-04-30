<script lang="ts">
	import { goto } from '$app/navigation';
	import { buildCommuneHref } from '$lib/utils/communeNavigation';
	import {
		MapLibre,
		AttributionControl,
		NavigationControl,
		GeoJSONSource,
		FillLayer,
		LineLayer,
		SymbolLayer,
	} from 'svelte-maplibre-gl';
	import communesLimitUrl from '$lib/data/communes_limit_arrondissements.json?url';
	import { createMapStyleState, MAP_STYLE_IDS } from '$lib/utils/mapStyleToggle.svelte';
	import MapStyleToggle from '$lib/components/map/MapStyleToggle.svelte';
	import SpeedLimitsLayer from '$lib/components/map/layers/SpeedLimitsLayer.svelte';
	import {
		SPEED_BUCKETS,
		SPEED_BUCKET_COLORS,
		SPEED_BUCKET_LABELS,
		type SpeedBucket,
	} from '$lib/utils/speedLimits';
	import type maplibregl from 'maplibre-gl';

	const SPEED_LEGEND_BUCKETS = SPEED_BUCKETS.filter((b) => b !== 'unknown');

	type CommuneSummary = { slug: string | null; insee: string; name: string; partial?: boolean };
	type CommuneLink = { insee: string; slug: string; name: string };

	let {
		ville30Communes,
		fullInsees,
		partialInsees = [],
		allCommuneLinks = [],
	}: {
		ville30Communes: CommuneSummary[];
		fullInsees: string[];
		partialInsees?: string[];
		allCommuneLinks?: CommuneLink[];
	} = $props();

	const bounds: [[number, number], [number, number]] = [
		[4.65, 45.62],
		[5.0, 45.9],
	];

	const slugByInsee = $derived.by(() => {
		const m = new Map<string, { slug: string | null; name: string }>();
		for (const c of allCommuneLinks) m.set(c.insee, { slug: c.slug, name: c.name });
		// Ville 30 entries take precedence (their `name` may already be the canonical display name)
		for (const c of ville30Communes) m.set(c.insee, { slug: c.slug, name: c.name });
		return m;
	});

	const fullFilter = $derived<any>(['in', ['get', 'insee'], ['literal', fullInsees]]);
	const partialFilter = $derived<any>(['in', ['get', 'insee'], ['literal', partialInsees]]);
	const ville30Filter = $derived<any>([
		'in',
		['get', 'insee'],
		['literal', [...fullInsees, ...partialInsees]],
	]);

	let map: maplibregl.Map | undefined = $state();
	let hoveredInsee: string | null = $state(null);
	let cursor: string | undefined = $state();
	let speedLimitsVisible = $state(false);
	let selectedSpeedBuckets = $state<SpeedBucket[]>([]);

	function toggleSpeedBucket(bucket: SpeedBucket) {
		const set = new Set(selectedSpeedBuckets);
		if (set.has(bucket)) set.delete(bucket);
		else set.add(bucket);
		selectedSpeedBuckets = [...set];
	}

	function resetSpeedBuckets() {
		selectedSpeedBuckets = [];
	}

	$effect(() => {
		if (!speedLimitsVisible) selectedSpeedBuckets = [];
	});

	const mapStyleState = createMapStyleState(MAP_STYLE_IDS[0], () => {});

	const hoverFilter = $derived<any>(
		hoveredInsee ? ['==', ['get', 'insee'], hoveredInsee] : ['==', ['get', 'insee'], '__none__'],
	);

	const isSpeedLimitsLayer = (id: string) => id === 'speed-limits' && speedLimitsVisible;

	function handleMouseMove(e: any) {
		if (!map) return;
		const features = map.queryRenderedFeatures(e.point, {
			layers: ['ville30-fill-base'],
		});
		if (features.length > 0) {
			const insee = features[0].properties?.insee as string | undefined;
			if (insee) {
				hoveredInsee = insee;
				cursor = slugByInsee.has(insee) ? 'pointer' : 'default';
				return;
			}
		}
		hoveredInsee = null;
		cursor = undefined;
	}

	function handleMouseLeave() {
		hoveredInsee = null;
		cursor = undefined;
	}

	function handleClick(e: any) {
		if (!map) return;
		const features = map.queryRenderedFeatures(e.point, {
			layers: ['ville30-fill-base'],
		});
		if (features.length === 0) return;
		const insee = features[0].properties?.insee as string | undefined;
		if (!insee) return;
		const target = slugByInsee.get(insee);
		if (target?.slug) goto(buildCommuneHref(target.slug));
	}
</script>

<div class="relative h-[60vh] min-h-80 overflow-hidden rounded-lg shadow">
	<MapLibre
		bind:map
		class="h-full w-full"
		style={mapStyleState.getMapStyleUrl()}
		{bounds}
		fitBoundsOptions={{ padding: 24 }}
		attributionControl={false}
		maxZoom={14}
		{cursor}
		onclick={handleClick}
		onmousemove={handleMouseMove}
		onmouseleave={handleMouseLeave}
	>
		<AttributionControl compact={true} position="bottom-left" />
		<NavigationControl position="top-right" showCompass={false} />
		<MapStyleToggle
			currentStyle={mapStyleState.mapStyle}
			onSelect={mapStyleState.setMapStyle}
			position="top-right"
		/>

		<GeoJSONSource id="ville30-communes" data={communesLimitUrl}>
			<FillLayer id="ville30-fill-base" paint={{ 'fill-color': '#1e3a5f', 'fill-opacity': 0.04 }} />
			<FillLayer
				id="ville30-fill-adopted"
				filter={fullFilter}
				paint={{ 'fill-color': '#79c2be', 'fill-opacity': 0.55 }}
			/>
			<FillLayer
				id="ville30-fill-partial"
				filter={partialFilter}
				paint={{ 'fill-color': '#79c2be', 'fill-opacity': 0.22 }}
			/>
			<FillLayer
				id="ville30-fill-hover"
				filter={hoverFilter}
				paint={{ 'fill-color': '#23356b', 'fill-opacity': 0.18 }}
			/>
			<LineLayer
				id="ville30-outline"
				paint={{ 'line-color': '#1e3a5f', 'line-width': 1, 'line-opacity': 0.5 }}
			/>
			<LineLayer
				id="ville30-outline-adopted"
				filter={fullFilter}
				paint={{ 'line-color': '#23356b', 'line-width': 1.5, 'line-opacity': 0.9 }}
			/>
			<LineLayer
				id="ville30-outline-partial"
				filter={partialFilter}
				paint={{
					'line-color': '#23356b',
					'line-width': 1.5,
					'line-opacity': 0.9,
					'line-dasharray': [3, 2],
				}}
			/>
			<LineLayer
				id="ville30-outline-hover"
				filter={hoverFilter}
				paint={{ 'line-color': '#23356b', 'line-width': 2.5, 'line-opacity': 1 }}
			/>
			<SymbolLayer
				id="ville30-label"
				minzoom={9}
				layout={{
					'text-field': ['coalesce', ['get', 'nomreduit'], ['get', 'nom']],
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

		<SpeedLimitsLayer isLayerVisible={isSpeedLimitsLayer} selectedBuckets={selectedSpeedBuckets} />
	</MapLibre>

	<div class="absolute top-3 left-3 flex flex-col gap-2">
		<div class="rounded-lg bg-white/95 px-3 py-2 shadow">
			<div class="mb-1 text-[11px] font-bold tracking-wider text-brand-navy uppercase">
				Statut Ville 30
			</div>
			<div class="flex items-center gap-2 text-xs text-gray-700">
				<span class="inline-block h-3 w-3 rounded-sm bg-brand-teal/60"></span>
				<span>Adoptée ({ville30Communes.filter((c) => !c.partial).length})</span>
			</div>
			{#if partialInsees.length > 0}
				<div class="mt-1 flex items-center gap-2 text-xs text-gray-700">
					<span class="inline-block h-3 w-3 rounded-sm bg-brand-teal/25"></span>
					<span>Partiellement ({ville30Communes.filter((c) => c.partial).length})</span>
				</div>
			{/if}
			<div class="mt-1 flex items-center gap-2 text-xs text-gray-700">
				<span class="inline-block h-3 w-3 rounded-sm border border-brand-navy/30 bg-brand-navy/5"
				></span>
				<span>Non adoptée</span>
			</div>
		</div>

		<label
			class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-xs font-medium text-brand-navy shadow"
		>
			<input
				type="checkbox"
				class="h-4 w-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
				bind:checked={speedLimitsVisible}
			/>
			Afficher les limitations de vitesse
		</label>

		{#if speedLimitsVisible}
			<div class="rounded-lg bg-white/95 px-2 py-2 shadow">
				<div class="mb-1 px-1 text-[11px] font-bold tracking-wider text-brand-navy uppercase">
					Limitations de vitesse
				</div>
				<ul class="flex flex-col gap-0.5">
					{#each SPEED_LEGEND_BUCKETS as bucket (bucket)}
						{@const isActive = selectedSpeedBuckets.includes(bucket)}
						{@const dim = selectedSpeedBuckets.length > 0 && !isActive}
						<li>
							<button
								type="button"
								onclick={() => toggleSpeedBucket(bucket)}
								aria-pressed={isActive}
								class="flex w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-xs whitespace-nowrap text-gray-700 transition-colors hover:bg-gray-100"
								class:bg-gray-200={isActive}
								class:font-semibold={isActive}
								class:opacity-40={dim}
							>
								<span
									class="inline-block h-2 w-5 rounded"
									style="background-color: {SPEED_BUCKET_COLORS[bucket]}"
									aria-hidden="true"
								></span>
								<span>{SPEED_BUCKET_LABELS[bucket]}&nbsp;km/h</span>
							</button>
						</li>
					{/each}
				</ul>
				{#if selectedSpeedBuckets.length > 0}
					<button
						type="button"
						class="mt-1 px-1.5 text-[11px] text-gray-500 underline hover:text-gray-700"
						onclick={resetSpeedBuckets}
					>
						Tout afficher
					</button>
				{/if}
			</div>
		{/if}
	</div>

	{#if hoveredInsee && slugByInsee.has(hoveredInsee)}
		{@const hovered = slugByInsee.get(hoveredInsee)}
		<div
			class="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/95 px-3 py-1.5 text-sm font-medium text-brand-navy shadow"
		>
			{hovered?.name}{hovered?.slug ? ' · cliquez pour ouvrir' : ''}
		</div>
	{/if}
</div>
