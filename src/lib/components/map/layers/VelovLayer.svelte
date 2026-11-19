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
		VELOV_PIN_CENTER_LIFT,
		VELOV_PIN_HEAD,
		VELOV_PIN_ICON_OFFSET,
	} from '$lib/utils/velovPinIcon';
	import { velovPalettePreference } from '$lib/utils/mapPreferences.svelte';
	import {
		velovLiveLevel,
		velovMapRange,
		velovShortRange,
		type VelovForecastKind,
	} from '$lib/utils/velovForecast';
	import type { VelovSimulationFrame } from '$lib/utils/velovSimulation.svelte';
	import type { Feature, FeatureCollection, Point } from 'geojson';
	import type * as maplibregl from 'maplibre-gl';

	let {
		isLayerVisible,
		handleMouseEnter,
		handleMouseLeave,
		map,
		boundary,
		simulation = null,
		kind = 'velos',
		selectedId = null,
	}: {
		isLayerVisible: (id: string) => boolean;
		handleMouseEnter: () => void;
		handleMouseLeave: () => void;
		map?: maplibregl.Map;
		boundary?: FeatureCollection;
		simulation?: VelovSimulationFrame | null;
		kind?: VelovForecastKind;
		selectedId?: number | null;
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

	const ICON_SIZE_STOPS = [
		[10, 0.32],
		[14, 0.6],
		[18, 0.95],
		[22, 1.1],
	] as const;

	const DOT_RADIUS_STOPS = [
		[10, 3.5],
		[14, 6.5],
		[18, 10],
	] as const;

	const SELECTED_SCALE = 1.3;
	const SELECTED_COLOR = '#23356b';

	function byZoom(
		stops: readonly (readonly [number, number])[],
		output: (value: number) => unknown,
	): maplibregl.ExpressionSpecification {
		return [
			'interpolate',
			['linear'],
			['zoom'],
			...stops.flatMap(([zoom, value]) => [zoom, output(value)]),
		] as maplibregl.ExpressionSpecification;
	}

	const isSelected = $derived<maplibregl.ExpressionSpecification>([
		'==',
		['to-number', ['get', 'idstation'], -1],
		selectedId ?? -2,
	]);
	const dots = $derived((simulation ? simulation.kind : kind) !== 'velos');

	const iconSize = $derived(
		byZoom(ICON_SIZE_STOPS, (size) => ['case', isSelected, size * SELECTED_SCALE, size]),
	);
	const dotRadius = $derived(
		byZoom(DOT_RADIUS_STOPS, (radius) => ['case', isSelected, radius * SELECTED_SCALE, radius]),
	);
	const SELECTED_GLOW = 10;

	function selectedRadiusPlus(extra: number): maplibregl.ExpressionSpecification {
		return dots
			? byZoom(DOT_RADIUS_STOPS, (radius) => radius * SELECTED_SCALE + 2 + extra)
			: byZoom(ICON_SIZE_STOPS, (size) => VELOV_PIN_HEAD.radius * size * SELECTED_SCALE + extra);
	}

	const selectedRadius = $derived(selectedRadiusPlus(0));
	const selectedGlowRadius = $derived(selectedRadiusPlus(SELECTED_GLOW));
	const selectedTranslate = $derived(
		dots
			? (['literal', [0, 0]] as maplibregl.ExpressionSpecification)
			: byZoom(ICON_SIZE_STOPS, (size) => [
					'literal',
					[0, -VELOV_PIN_HEAD.lift * size * SELECTED_SCALE],
				]),
	);

	const hitAreaTranslate = [
		'interpolate',
		['linear'],
		['zoom'],
		...ICON_SIZE_STOPS.flatMap(([zoom, size]) => [
			zoom,
			['literal', [0, -Math.round(VELOV_PIN_CENTER_LIFT * size)]],
		]),
	] as maplibregl.ExpressionSpecification;

	const palette = $derived(velovPalettePreference.id);
	const mapLabel = $derived(velovPalettePreference.colors.mapLabel);
	const chanceColors = $derived(velovPalettePreference.colors.chance);

	const enrichedData = $derived.by<FeatureCollection<Point> | undefined>(() => {
		const raw = velovQuery.data;
		if (!raw) {
			return undefined;
		}

		const features: Feature<Point>[] = [];
		for (const feature of raw.features) {
			const p = feature.properties as Record<string, unknown> | null;
			const cap = Number(p?.capacity ?? p?.nbbornettes ?? 0);

			if (simulation) {
				const rank = simulation.ranks.get(Number(p?.idstation));
				if (rank === undefined) {
					continue;
				}

				const { values } = simulation;
				const range = velovMapRange(values, rank, simulation.kind);
				const label = {
					sim_label: velovShortRange(range.low, range.high),
					sim_unit: simulation.kind === 'bornes' ? 'P' : 'V',
				};

				if (simulation.kind !== 'velos') {
					features.push({
						...feature,
						properties: {
							...(p ?? {}),
							status: 'OPEN',
							icon: '',
							sim_color: chanceColors[range.chance.level],
							sim_stroke: range.chance.level === 'unlikely' ? '#6b7280' : '#ffffff',
							...label,
						},
					});
					continue;
				}

				const mech = Math.min(cap, velovMapRange(values, rank, 'meca').median);
				const elec = Math.min(cap - mech, velovMapRange(values, rank, 'elec').median);
				features.push({
					...feature,
					properties: {
						...(p ?? {}),
						mechanical_bikes: mech,
						electrical_bikes: elec,
						status: 'OPEN',
						icon:
							cap > 0 ? velovPinIconKey(mech, elec, cap, false, palette) : VELOV_DEFAULT_PIN_ICON,
						...label,
					},
				});
				continue;
			}

			const mech = Number(p?.mechanical_bikes ?? 0);
			const elec = Number(p?.electrical_bikes ?? 0);
			const closed = p?.status === 'CLOSED';

			if (kind !== 'velos') {
				const known = !closed && p?.available_bikes !== undefined;
				const count =
					kind === 'bornes' ? Number(p?.available_stands ?? 0) : kind === 'elec' ? elec : mech;
				const level = velovLiveLevel(count);
				features.push({
					...feature,
					properties: {
						...(p ?? {}),
						icon: '',
						sim_color: known ? chanceColors[level] : '#9ca3af',
						sim_stroke: known && level === 'unlikely' ? '#6b7280' : '#ffffff',
						sim_label: known ? String(count) : '',
						sim_unit: known ? (kind === 'bornes' ? 'P' : 'V') : '',
					},
				});
				continue;
			}

			const key =
				cap > 0 ? velovPinIconKey(mech, elec, cap, closed, palette) : VELOV_DEFAULT_PIN_ICON;
			features.push({
				...feature,
				properties: { ...(p ?? {}), icon: key },
			});
		}

		return { ...raw, features } as FeatureCollection<Point>;
	});

	$effect(() => {
		if (!map) {
			return;
		}

		const keys = new Set<string>([VELOV_DEFAULT_PIN_ICON]);
		for (const f of enrichedData?.features ?? []) {
			const key = f.properties?.icon;
			if (typeof key === 'string' && key) {
				keys.add(key);
			}
		}

		for (const key of keys) {
			ensureVelovPinIcon(map, key);
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
	<CircleLayer
		id="velov-stations-layer-selected-glow"
		filter={isSelected}
		layout={{ visibility }}
		paint={{
			'circle-color': SELECTED_COLOR,
			'circle-opacity': 0.3,
			'circle-blur': 0.7,
			'circle-radius': selectedGlowRadius,
			'circle-translate': selectedTranslate,
			'circle-translate-anchor': 'viewport',
		}}
	/>

	<CircleLayer
		id="velov-stations-layer-selected"
		filter={isSelected}
		layout={{ visibility }}
		paint={{
			'circle-opacity': 0,
			'circle-radius': selectedRadius,
			'circle-stroke-color': SELECTED_COLOR,
			'circle-stroke-width': 3,
			'circle-translate': selectedTranslate,
			'circle-translate-anchor': 'viewport',
		}}
	/>

	<CircleLayer
		id="velov-stations-layer-chance"
		filter={['has', 'sim_color']}
		layout={{ visibility }}
		paint={{
			'circle-color': ['get', 'sim_color'],
			'circle-stroke-color': ['get', 'sim_stroke'],
			'circle-radius': dotRadius,
			'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 1.5, 18, 2],
		}}
	/>

	<SymbolLayer
		id="velov-stations-layer"
		layout={{
			visibility,
			'icon-image': ['coalesce', ['get', 'icon'], VELOV_DEFAULT_PIN_ICON],
			'icon-anchor': 'bottom',
			'icon-offset': VELOV_PIN_ICON_OFFSET,
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'text-allow-overlap': false,
			'text-ignore-placement': false,
			'symbol-sort-key': [
				'case',
				isSelected,
				1,
				['*', -1, ['to-number', ['coalesce', ['get', 'capacity'], ['get', 'nbbornettes'], 0]]],
			],
			'icon-size': iconSize,
			'text-field': [
				'step',
				['zoom'],
				'',
				15,
				[
					'case',
					['has', 'sim_label'],
					[
						'format',
						['get', 'sim_label'],
						{ 'font-scale': 1 },
						['get', 'sim_unit'],
						{
							'font-scale': 0.75,
							'text-color': [
								'case',
								['==', ['get', 'sim_unit'], 'P'],
								mapLabel.stands,
								mapLabel.bikes,
							],
						},
					],
					[
						'format',
						['to-string', ['coalesce', ['get', 'available_bikes'], '?']],
						{ 'font-scale': 1 },
						'V',
						{ 'font-scale': 0.75, 'text-color': mapLabel.bikes },
						' | ',
						{ 'font-scale': 0.7, 'text-color': '#9ca3af' },
						['to-string', ['coalesce', ['get', 'available_stands'], '?']],
						{ 'font-scale': 1 },
						'P',
						{ 'font-scale': 0.75, 'text-color': mapLabel.stands },
					],
				],
			],
			'text-font': ['Noto Sans Bold'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 15, 11, 18, 13],
			'text-offset': ['case', ['has', 'sim_color'], ['literal', [0, 1]], ['literal', [0, 0.5]]],
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
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 16, 14, 30, 18, 48, 22, 60],
			'circle-translate': hitAreaTranslate,
			'circle-translate-anchor': 'viewport',
			'circle-color': 'transparent',
		}}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	/>
</GeoJSONSource>
