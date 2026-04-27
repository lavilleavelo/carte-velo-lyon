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
	import type maplibregl from 'maplibre-gl';

	type CommuneSummary = { slug: string; insee: string; name: string };

	let { communes }: { communes: CommuneSummary[] } = $props();

	const bounds: [[number, number], [number, number]] = [
		[4.65, 45.62],
		[5.0, 45.9],
	];

	const slugByInsee = $derived.by(() => {
		const m = new Map<string, { slug: string; name: string }>();
		for (const c of communes) m.set(c.insee, { slug: c.slug, name: c.name });
		return m;
	});

	let map: maplibregl.Map | undefined = $state();
	let hoveredInsee: string | null = $state(null);
	let cursor: string | undefined = $state();

	const mapStyleState = createMapStyleState(MAP_STYLE_IDS[0], () => {});

	const hoverFilter = $derived<any>(
		hoveredInsee ? ['==', ['get', 'insee'], hoveredInsee] : ['==', ['get', 'insee'], '__none__'],
	);

	function handleMouseMove(e: any) {
		if (!map) return;
		const features = map.queryRenderedFeatures(e.point, {
			layers: ['commune-selector-fill'],
		});
		if (features.length > 0) {
			const insee = features[0].properties?.insee as string | undefined;
			if (insee && slugByInsee.has(insee)) {
				hoveredInsee = insee;
				cursor = 'pointer';
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
			layers: ['commune-selector-fill'],
		});
		if (features.length === 0) return;
		const insee = features[0].properties?.insee as string | undefined;
		if (!insee) return;
		const target = slugByInsee.get(insee);
		if (target) goto(buildCommuneHref(target.slug));
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
		maxZoom={12}
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

		<GeoJSONSource id="commune-selector" data={communesLimitUrl}>
			<FillLayer
				id="commune-selector-fill"
				paint={{ 'fill-color': '#1e3a5f', 'fill-opacity': 0.05 }}
			/>
			<FillLayer
				id="commune-selector-fill-hover"
				filter={hoverFilter}
				paint={{ 'fill-color': '#1e3a5f', 'fill-opacity': 0.25 }}
			/>
			<LineLayer
				id="commune-selector-outline"
				paint={{ 'line-color': '#1e3a5f', 'line-width': 1.2, 'line-opacity': 0.6 }}
			/>
			<LineLayer
				id="commune-selector-outline-hover"
				filter={hoverFilter}
				paint={{ 'line-color': '#1e3a5f', 'line-width': 2.5, 'line-opacity': 0.95 }}
			/>
			<SymbolLayer
				id="commune-selector-label"
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
	</MapLibre>

	{#if hoveredInsee && slugByInsee.has(hoveredInsee)}
		<div
			class="pointer-events-none absolute top-3 left-3 rounded-md bg-white/95 px-3 py-1.5 text-sm font-medium text-brand-navy shadow"
		>
			{slugByInsee.get(hoveredInsee)?.name} — cliquez pour ouvrir
		</div>
	{/if}
</div>
