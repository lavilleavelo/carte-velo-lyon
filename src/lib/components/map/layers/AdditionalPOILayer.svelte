<script lang="ts">
	import { GeoJSONSource, SymbolLayer, CircleLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import type { GeoJSON } from 'geojson';

	let { isLayerVisible, handleMouseEnter, handleMouseLeave, map } = $props();

	type POIType =
		| 'veloecole'
		| 'atelier'
		| 'revendeur'
		| 'loueur'
		| 'bench'
		| 'picnic-table'
		| 'pharmacy'
		| 'defibrillator'
;

	function classifyPOI(tags: Record<string, string>): POIType | null {
		// Local bike services — order matters for specificity
		if (tags.club === 'bicycle') return 'veloecole';
		if (tags.amenity === 'bicycle_repair_station') return 'atelier';
		if (tags.amenity === 'bicycle_rental') {
			const op = (tags.operator || '').toLowerCase();
			const net = (tags.network || '').toLowerCase();
			const name = (tags.name || '').toLowerCase();
			if (op.includes('jcdecaux') || net.includes("vélo'v") || name.includes("vélo'v"))
				return null;
			return 'loueur';
		}
		if (tags.shop === 'bicycle') return 'revendeur';

		// Comfort
		if (tags.amenity === 'bench') return 'bench';
		if (tags.leisure === 'picnic_table') return 'picnic-table';
		// Safety
		if (tags.amenity === 'pharmacy') return 'pharmacy';
		if (tags.emergency === 'defibrillator') return 'defibrillator';
		return null;
	}

	function overpassToGeoJSON(data: any): GeoJSON.Feature[] {
		return (data.elements || [])
			.filter((el: any) => {
				if (el.type === 'node') return el.lat && el.lon;
				return el.center?.lat && el.center?.lon;
			})
			.map((el: any) => {
				const lat = el.type === 'node' ? el.lat : el.center.lat;
				const lon = el.type === 'node' ? el.lon : el.center.lon;
				const tags = el.tags || {};
				const poiType = classifyPOI(tags);
				if (!poiType) return null;
				return {
					type: 'Feature' as const,
					geometry: {
						type: 'Point' as const,
						coordinates: [lon, lat],
					},
					properties: {
						osmId: el.id,
						poiType,
						name: tags.name || null,
						operator: tags.operator || null,
						opening_hours: tags.opening_hours || null,
						access: tags.access || null,
						fee: tags.fee === 'yes',
						indoor: tags.indoor || null,
						shelter_type: tags.shelter_type || null,
					},
				};
			})
			.filter(Boolean);
	}

	const allLayerIds: string[] = [
		'local-veloecole',
		'local-atelier',
		'local-revendeur',
		'local-loueur',
		'poi-bench',
		'poi-picnic-table',
		'poi-pharmacy',
		'poi-defibrillator',
	];

	const anyVisible = $derived(allLayerIds.some((id) => isLayerVisible(id)));

	const poisQuery = createQuery(() => ({
		queryKey: ['overpass-pois'],
		queryFn: async () => {
			const response = await fetch('/api/overpass-pois');
			if (!response.ok) {
				throw new Error('Failed to fetch POI data');
			}
			const data = await response.json();
			return overpassToGeoJSON(data);
		},
		staleTime: Infinity,
		enabled: anyVisible,
	}));

	const features = $derived(poisQuery.data || []);

	const LOCAL_COLOR = '#1e5a8a';

	interface POITypeDef {
		type: POIType;
		layerId: string;
		color: string;
		label: string;
		shape: 'square' | 'circle';
		minzoom?: number;
		iconScale?: number;
	}

	const poiTypes: POITypeDef[] = [
		// Local (blue squares)
		{ type: 'veloecole', layerId: 'local-veloecole', color: LOCAL_COLOR, label: 'VÉ', shape: 'square' },
		{ type: 'atelier', layerId: 'local-atelier', color: LOCAL_COLOR, label: 'At', shape: 'square' },
		{ type: 'revendeur', layerId: 'local-revendeur', color: LOCAL_COLOR, label: 'Re', shape: 'square' },
		{ type: 'loueur', layerId: 'local-loueur', color: LOCAL_COLOR, label: 'Lo', shape: 'square' },
		// Comfort (circles)
		{ type: 'bench', layerId: 'poi-bench', color: '#78716c', label: '', shape: 'circle', minzoom: 13, iconScale: 0.5 },
		{ type: 'picnic-table', layerId: 'poi-picnic-table', color: '#65a30d', label: 'P', shape: 'circle' },
		// Safety (circles)
		{ type: 'pharmacy', layerId: 'poi-pharmacy', color: '#16a34a', label: '+', shape: 'circle' },
		{ type: 'defibrillator', layerId: 'poi-defibrillator', color: '#dc2626', label: 'D', shape: 'circle' },
	];

	function createSquareIcon(bgColor: string, text: string): HTMLCanvasElement {
		const size = 40;
		const r = 6;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d')!;

		ctx.beginPath();
		ctx.roundRect(2, 2, size - 4, size - 4, r);
		ctx.fillStyle = bgColor;
		ctx.fill();
		ctx.strokeStyle = '#ffffff';
		ctx.lineWidth = 2;
		ctx.stroke();

		if (text) {
			ctx.fillStyle = '#ffffff';
			ctx.font = 'bold 13px sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(text, size / 2, size / 2);
		}

		return canvas;
	}

	function createCircleIcon(bgColor: string, text: string): HTMLCanvasElement {
		const size = 40;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d')!;

		ctx.beginPath();
		ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
		ctx.fillStyle = bgColor;
		ctx.fill();
		ctx.strokeStyle = '#ffffff';
		ctx.lineWidth = 2;
		ctx.stroke();

		if (text) {
			ctx.fillStyle = '#ffffff';
			ctx.font = 'bold 16px sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(text, size / 2, size / 2);
		}

		return canvas;
	}

	function addIcon(name: string, pt: POITypeDef) {
		if (map && !map.hasImage(name)) {
			const canvas =
				pt.shape === 'square'
					? createSquareIcon(pt.color, pt.label)
					: createCircleIcon(pt.color, pt.label);
			const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
			if (imageData) {
				map.addImage(name, imageData);
			}
		}
	}

	$effect(() => {
		for (const pt of poiTypes) {
			addIcon(`poi-${pt.type}`, pt);
		}
	});
</script>

<GeoJSONSource
	id="additional-pois-source"
	data={{
		type: 'FeatureCollection',
		features: features,
	}}
>
	{#each poiTypes as pt}
		<SymbolLayer
			id={`poi-${pt.type}-layer`}
			filter={['==', ['get', 'poiType'], pt.type]}
			minzoom={pt.minzoom ?? 0}
			layout={{
				visibility: isLayerVisible(pt.layerId) ? 'visible' : 'none',
				'icon-image': `poi-${pt.type}`,
				'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.4 * (pt.iconScale ?? 1), 17, 0.8 * (pt.iconScale ?? 1)],
				'icon-allow-overlap': true,
			}}
		/>

		<CircleLayer
			id={`${pt.layerId}-hitarea`}
			filter={['==', ['get', 'poiType'], pt.type]}
			minzoom={pt.minzoom ?? 0}
			layout={{
				visibility: isLayerVisible(pt.layerId) ? 'visible' : 'none',
			}}
			paint={{
				'circle-opacity': 0,
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 12, 15, 18, 18, 24],
				'circle-color': 'transparent',
			}}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
		/>

		<SymbolLayer
			id={`poi-${pt.type}-label`}
			filter={['==', ['get', 'poiType'], pt.type]}
			minzoom={Math.max(pt.minzoom ?? 0, 15)}
			layout={{
				visibility: isLayerVisible(pt.layerId) ? 'visible' : 'none',
				'text-field': ['coalesce', ['get', 'name'], ''],
				'text-font': ['Open Sans Bold'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 15, 11, 18, 13],
				'text-offset': [0, 1.5],
				'text-anchor': 'top',
			}}
			paint={{
				'text-color': pt.color,
				'text-halo-color': '#ffffff',
				'text-halo-width': 2,
			}}
		/>
	{/each}
</GeoJSONSource>
