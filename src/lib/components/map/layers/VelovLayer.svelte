<script lang="ts">
	import { GeoJSONSource, SymbolLayer, CircleLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import velovDataUrl from '$lib/data/velov-data-grand-lyon.json?url';
	import { fetchVelovAvailability } from '$lib/utils/velovUtils';
	import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
	import {
		ensureVelovPinIcon,
		velovPinIconKey,
		VELOV_DEFAULT_PIN_ICON,
	} from '$lib/utils/velovPinIcon';
	import type { FeatureCollection, Point } from 'geojson';
	import type maplibregl from 'maplibre-gl';

	let {
		isLayerVisible,
		handleMouseEnter,
		handleMouseLeave,
		map,
		boundary,
	}: {
		isLayerVisible: (id: string) => boolean;
		handleMouseEnter: () => void;
		handleMouseLeave: () => void;
		map?: maplibregl.Map;
		boundary?: FeatureCollection;
	} = $props();

	const velovQuery = createQuery(() => ({
		queryKey: ['velov-availability'],
		queryFn: async () => {
			const [staticResponse, availabilityMap] = await Promise.all([
				fetch(velovDataUrl),
				fetchVelovAvailability(),
			]);

			const staticData: FeatureCollection<Point> = await staticResponse.json();

			const enrichedFeatures = staticData.features.map((feature) => {
				const id = feature.properties?.idstation;
				if (id && availabilityMap.has(id)) {
					const availability = availabilityMap.get(id)!;
					return {
						...feature,
						properties: {
							...feature.properties,
							available_bikes: availability.main_stands.availabilities.bikes,
							available_stands: availability.main_stands.availabilities.stands,
							mechanical_bikes: availability.main_stands.availabilities.mechanicalBikes,
							electrical_bikes: availability.main_stands.availabilities.electricalBikes,
							status: availability.status,
							capacity: availability.main_stands.capacity,
						},
					};
				}
				return feature;
			});

			return {
				...staticData,
				features: enrichedFeatures,
			} as FeatureCollection<Point>;
		},
		enabled: isLayerVisible('velov'),
		refetchOnWindowFocus: false,
		staleTime: Infinity,
		meta: { loadingLabel: 'Stations Vélo’v' },
	}));

	const EMPTY_FC: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };

	const enrichedData = $derived.by<FeatureCollection<Point> | undefined>(() => {
		const raw = velovQuery.data;
		if (!raw) {
			return undefined;
		}

		const features = raw.features.map((feature) => {
			const p = feature.properties as Record<string, unknown> | null;
			const cap = Number(p?.capacity ?? p?.nbbornettes ?? 0);
			const mech = Number(p?.mechanical_bikes ?? 0);
			const elec = Number(p?.electrical_bikes ?? 0);
			const closed = p?.status === 'CLOSED';
			const key = cap > 0 ? velovPinIconKey(mech, elec, cap, closed) : VELOV_DEFAULT_PIN_ICON;
			return {
				...feature,
				properties: { ...(p ?? {}), icon: key },
			};
		});

		return { ...raw, features } as FeatureCollection<Point>;
	});

	$effect(() => {
		if (!map) {
			return;
		}

		ensureVelovPinIcon(map, VELOV_DEFAULT_PIN_ICON, 0, 0, 15, false);

		const data = enrichedData;
		if (!data) {
			return;
		}

		for (const f of data.features) {
			const p = f.properties as Record<string, unknown>;
			const cap = Number(p.capacity ?? p.nbbornettes ?? 0);
			const mech = Number(p.mechanical_bikes ?? 0);
			const elec = Number(p.electrical_bikes ?? 0);
			const closed = p.status === 'CLOSED';
			const key = (p.icon as string) ?? VELOV_DEFAULT_PIN_ICON;
			ensureVelovPinIcon(map, key, mech, elec, cap || 15, closed);
		}
	});

	const velovSourceData = $derived.by<FeatureCollection<Point> | string>(() => {
		if (boundary) {
			if (!enrichedData) {
				return EMPTY_FC;
			}
			return filterFeaturesInsideBoundary(enrichedData, boundary) as FeatureCollection<Point>;
		}

		return enrichedData ?? velovDataUrl;
	});

	const visibility = $derived(isLayerVisible('velov') ? 'visible' : 'none');
</script>

<GeoJSONSource maxzoom={14} id="velov-stations-source" data={velovSourceData}>
	<SymbolLayer
		id="velov-stations-layer"
		layout={{
			visibility,
			'icon-image': ['coalesce', ['get', 'icon'], VELOV_DEFAULT_PIN_ICON],
			'icon-anchor': 'bottom',
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'text-allow-overlap': false,
			'text-ignore-placement': false,
			'symbol-sort-key': [
				'*',
				-1,
				['to-number', ['coalesce', ['get', 'capacity'], ['get', 'nbbornettes'], 0]],
			],
			'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.32, 14, 0.6, 18, 0.95, 22, 1.1],
			'text-field': [
				'step',
				['zoom'],
				'',
				15,
				[
					'format',
					['to-string', ['coalesce', ['get', 'available_bikes'], '?']],
					{ 'font-scale': 1 },
					'V',
					{ 'font-scale': 0.75, 'text-color': '#b91c1c' },
					' | ',
					{ 'font-scale': 0.7, 'text-color': '#9ca3af' },
					['to-string', ['coalesce', ['get', 'available_stands'], '?']],
					{ 'font-scale': 1 },
					'P',
					{ 'font-scale': 0.75, 'text-color': '#1d4ed8' },
				],
			],
			'text-font': ['Noto Sans Bold'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 15, 11, 18, 13],
			'text-offset': [0, 0.5],
			'text-anchor': 'top',
		}}
		paint={{
			'text-color': '#111827',
			'text-halo-color': '#ffffff',
			'text-halo-width': 1.6,
		}}
	/>

	<CircleLayer
		id="velov-stations-layer-hitarea"
		layout={{ visibility }}
		paint={{
			'circle-opacity': 0,
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 22, 14, 38, 18, 54, 22, 64],
			'circle-translate': [
				'interpolate',
				['linear'],
				['zoom'],
				10,
				['literal', [0, -8]],
				14,
				['literal', [0, -18]],
				18,
				['literal', [0, -28]],
				22,
				['literal', [0, -34]],
			],
			'circle-translate-anchor': 'viewport',
			'circle-color': 'transparent',
		}}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	/>
</GeoJSONSource>
