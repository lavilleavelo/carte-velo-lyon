<script lang="ts">
	import { GeoJSONSource, LineLayer, SymbolLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import type { FeatureCollection, Feature } from 'geojson';
	import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
	import { osmFeatureToLegendId } from '$lib/utils/cyclewayLegend';

	let {
		isLayerVisible,
		boundary,
		activeLegendIds,
	}: {
		isLayerVisible: (id: string) => boolean;
		boundary?: FeatureCollection;
		activeLegendIds?: string[];
	} = $props();

	const COLOR = '#0369a1';

	type Side = 'left' | 'right' | 'center';
	type Classification = {
		typeamenagement: string;
		side: Side;
		bidirectional?: boolean;
	};

	function classifyValue(value?: string): string | null {
		if (!value || value === 'no' || value === 'separate' || value === 'shared_lane') return null;
		if (value === 'track' || value === 'opposite_track') return 'Piste Cyclable';
		if (value === 'lane' || value === 'opposite_lane') return 'Bande Cyclable';
		if (value === 'opposite') return 'Double sens cyclable';
		if (value === 'share_busway' || value === 'shared_busway') return 'Couloir bus vélo';
		return null;
	}

	function classifyOsmCycleway(tags: Record<string, any>): Classification[] {
		const results: Classification[] = [];

		if (tags.highway === 'cycleway') {
			const onewayBicycle = tags['oneway:bicycle'];
			const oneway = tags.oneway;
			const bidirectional = onewayBicycle === 'no' || (oneway !== 'yes' && onewayBicycle !== 'yes');
			results.push({ typeamenagement: 'Piste Cyclable', side: 'center', bidirectional });
			return results;
		}

		if (tags.bicycle_road === 'yes' || tags.cyclestreet === 'yes') {
			results.push({ typeamenagement: 'Vélorue', side: 'center', bidirectional: true });
			return results;
		}

		if (tags.highway === 'path' && tags.bicycle === 'designated') {
			results.push({ typeamenagement: 'Voie verte', side: 'center', bidirectional: true });
			return results;
		}

		const hasSideTags = tags['cycleway:left'] || tags['cycleway:right'] || tags['cycleway:both'];

		if (tags['cycleway:both']) {
			const type = classifyValue(tags['cycleway:both']);
			if (type === 'Double sens cyclable') {
				results.push({ typeamenagement: type, side: 'center' });
			} else if (type) {
				results.push({ typeamenagement: type, side: 'left' });
				results.push({ typeamenagement: type, side: 'right' });
			}
		} else {
			if (tags['cycleway:left']) {
				const type = classifyValue(tags['cycleway:left']);
				if (type) {
					results.push({
						typeamenagement: type,
						side: type === 'Double sens cyclable' ? 'center' : 'left',
					});
				}
			}
			if (tags['cycleway:right']) {
				const type = classifyValue(tags['cycleway:right']);
				if (type) {
					results.push({
						typeamenagement: type,
						side: type === 'Double sens cyclable' ? 'center' : 'right',
					});
				}
			}
		}

		if (tags.cycleway && !hasSideTags) {
			const type = classifyValue(tags.cycleway);
			if (type) {
				if (String(tags.cycleway).startsWith('opposite')) {
					results.push({ typeamenagement: type, side: 'center' });
				} else {
					results.push({ typeamenagement: type, side: 'left' });
					results.push({ typeamenagement: type, side: 'right' });
				}
			}
		}

		const alreadyHasDsc = results.some((r) => r.typeamenagement === 'Double sens cyclable');
		if (!alreadyHasDsc) {
			const isOneway = tags.oneway === 'yes';
			const onewayBicycle = tags['oneway:bicycle'];
			const isContresens = isOneway && onewayBicycle === 'no';
			const isLivingStreet = tags.highway === 'living_street';
			if (isContresens) {
				results.push({ typeamenagement: 'Double sens cyclable', side: 'center' });
			} else if (isLivingStreet && isOneway && onewayBicycle !== 'yes') {
				results.push({ typeamenagement: 'Double sens cyclable', side: 'center' });
			}
		}

		return results;
	}

	function sideOffset(side: Side): number {
		if (side === 'left') return -3;
		if (side === 'right') return 3;
		return 0;
	}

	function overpassToGeoJSON(data: any): FeatureCollection {
		const features: Feature[] = [];
		for (const element of data?.elements ?? []) {
			if (element.type !== 'way' || !element.geometry) continue;
			const tags = element.tags ?? {};
			const classifications = classifyOsmCycleway(tags);
			if (classifications.length === 0) continue;

			const coordinates = element.geometry.map((p: { lon: number; lat: number }) => [p.lon, p.lat]);

			for (const c of classifications) {
				features.push({
					type: 'Feature',
					properties: {
						...tags,
						osmId: element.id,
						osmType: element.type,
						typeamenagement: c.typeamenagement,
						side: c.side,
						bidirectional: c.bidirectional ?? false,
						offset: sideOffset(c.side),
					},
					geometry: {
						type: 'LineString',
						coordinates,
					},
				});
			}
		}
		return { type: 'FeatureCollection', features };
	}

	const enabled = $derived(isLayerVisible('osm-cycleways'));

	const query = createQuery(() => ({
		queryKey: ['overpass-cycleways'],
		queryFn: async () => {
			const response = await fetch('/api/overpass-cycleways');
			if (!response.ok) {
				throw new Error('Failed to fetch Overpass cycleways data');
			}
			const data = await response.json();
			return overpassToGeoJSON(data);
		},
		staleTime: Infinity,
		enabled,
		refetchOnWindowFocus: false,
	}));

	const visibility = $derived(enabled ? 'visible' : 'none');

	const displayData = $derived.by(() => {
		const data = query.data;
		if (!data) return undefined;
		let result: FeatureCollection = boundary ? filterFeaturesInsideBoundary(data, boundary) : data;
		const active = activeLegendIds ?? [];
		if (active.length > 0) {
			const allowed = new Set(active);
			result = {
				...result,
				features: result.features.filter((f) => {
					const id = osmFeatureToLegendId(f.properties);
					return id ? allowed.has(id) : false;
				}),
			};
		}
		return result;
	});

	const isBidir: any = ['==', ['get', 'bidirectional'], true];
	const filterPisteBidir: any = [
		'all',
		['==', ['get', 'typeamenagement'], 'Piste Cyclable'],
		isBidir,
	];
	const filterPisteUnidir: any = [
		'all',
		['==', ['get', 'typeamenagement'], 'Piste Cyclable'],
		['!', isBidir],
	];
	const filterVoieVerte: any = ['==', ['get', 'typeamenagement'], 'Voie verte'];
	const filterBande: any = ['==', ['get', 'typeamenagement'], 'Bande Cyclable'];
	const filterBusVelo: any = ['==', ['get', 'typeamenagement'], 'Couloir bus vélo'];
	const filterDsc: any = ['==', ['get', 'typeamenagement'], 'Double sens cyclable'];
	const filterVelorue: any = ['==', ['get', 'typeamenagement'], 'Vélorue'];

	const lineOffset: any = ['get', 'offset'];
	const zoomedOffset: any = ['interpolate', ['linear'], ['zoom'], 12, 0, 15, ['get', 'offset']];
</script>

<GeoJSONSource
	maxzoom={13}
	data={displayData ?? { type: 'FeatureCollection', features: [] }}
	id="osm-cycleways-source"
>
	<LineLayer
		id="osm-cw-piste-bidir"
		filter={filterPisteBidir}
		paint={{
			'line-color': COLOR,
			'line-width': 4,
			'line-opacity': 0.9,
			'line-offset': lineOffset,
		}}
		layout={{ 'line-cap': 'round', 'line-join': 'round', visibility }}
	/>

	<LineLayer
		id="osm-cw-piste-unidir"
		filter={filterPisteUnidir}
		paint={{
			'line-color': COLOR,
			'line-width': 2,
			'line-opacity': 0.9,
			'line-offset': zoomedOffset,
		}}
		layout={{ 'line-cap': 'round', 'line-join': 'round', visibility }}
	/>

	<LineLayer
		id="osm-cw-voie-verte"
		filter={filterVoieVerte}
		paint={{
			'line-color': COLOR,
			'line-width': 1.2,
			'line-gap-width': 2,
			'line-opacity': 0.9,
			'line-offset': lineOffset,
		}}
		layout={{ visibility }}
	/>

	<LineLayer
		id="osm-cw-bande"
		filter={filterBande}
		paint={{
			'line-color': COLOR,
			'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 14, 1.6, 17, 3],
			'line-opacity': 0.9,
			'line-dasharray': [1.5, 1],
			'line-offset': zoomedOffset,
		}}
		layout={{ visibility }}
	/>

	<LineLayer
		id="osm-cw-bus-velo"
		filter={filterBusVelo}
		paint={{
			'line-color': COLOR,
			'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 14, 1.6, 17, 2.5],
			'line-opacity': 0.9,
			'line-dasharray': [0.2, 1.6],
			'line-offset': zoomedOffset,
		}}
		layout={{ 'line-cap': 'round', visibility }}
	/>

	<LineLayer
		id="osm-cw-velorue"
		filter={filterVelorue}
		paint={{
			'line-color': COLOR,
			'line-width': 4,
			'line-opacity': 0.9,
			'line-dasharray': [2, 1],
			'line-offset': lineOffset,
		}}
		layout={{ visibility }}
	/>

	<LineLayer
		id="osm-cw-dsc-base"
		filter={filterDsc}
		paint={{ 'line-color': COLOR, 'line-width': 1.5, 'line-opacity': 0.5 }}
		layout={{ visibility }}
	/>

	<SymbolLayer
		id="osm-cw-dsc-arrows"
		filter={filterDsc}
		layout={{
			'symbol-placement': 'line',
			'symbol-spacing': 40,
			'text-field': '←',
			'text-size': 16,
			'text-keep-upright': false,
			'text-rotation-alignment': 'map',
			'text-pitch-alignment': 'map',
			'text-allow-overlap': true,
			'text-ignore-placement': true,
			visibility,
		}}
		paint={{ 'text-color': COLOR, 'text-halo-color': '#ffffff', 'text-halo-width': 1 }}
	/>

	<LineLayer
		id="osm-cycleways-layer-hitarea"
		paint={{
			'line-color': 'transparent',
			'line-width': 20,
			'line-opacity': 0,
			'line-offset': zoomedOffset,
		}}
		layout={{ visibility }}
	/>
</GeoJSONSource>
