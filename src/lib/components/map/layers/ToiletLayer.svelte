<script lang="ts">
	import { GeoJSONSource, SymbolLayer, CircleLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import type { GeoJSON } from 'geojson';

	let { isLayerVisible, handleMouseEnter, handleMouseLeave, map } = $props();

	function overpassToGeoJSON(data: any): GeoJSON.Feature[] {
		return (data.elements || [])
			.filter((el: any) => {
				if (el.type === 'node') return el.lat && el.lon;
				return el.center?.lat && el.center?.lon;
			})
			.map((el: any) => {
				const lat = el.type === 'node' ? el.lat : el.center.lat;
				const lon = el.type === 'node' ? el.lon : el.center.lon;
				return {
					type: 'Feature' as const,
					geometry: {
						type: 'Point' as const,
						coordinates: [lon, lat],
					},
					properties: {
						osmId: el.id,
						name: el.tags?.name || null,
						fee: el.tags?.fee === 'yes',
						wheelchair: el.tags?.wheelchair === 'yes',
						opening_hours: el.tags?.opening_hours || null,
						access: el.tags?.access || null,
						description: el.tags?.description || null,
						operator: el.tags?.operator || null,
					},
				};
			});
	}

	const toiletsQuery = createQuery(() => ({
		queryKey: ['overpass-toilets'],
		queryFn: async () => {
			const response = await fetch('/api/overpass-toilets');
			if (!response.ok) {
				throw new Error('Failed to fetch toilet data');
			}
			const data = await response.json();
			return overpassToGeoJSON(data);
		},
		staleTime: Infinity,
		enabled: isLayerVisible('toilets'),
		meta: { loadingLabel: 'Toilettes' },
	}));

	const features = $derived(toiletsQuery.data || []);

	function createToiletIcon(bgColor: string): HTMLCanvasElement {
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

		ctx.fillStyle = '#ffffff';
		ctx.font = 'bold 14px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('WC', size / 2, size / 2);

		return canvas;
	}

	function addIcon(name: string, color: string) {
		if (map && !map.hasImage(name)) {
			const canvas = createToiletIcon(color);
			const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
			if (imageData) {
				map.addImage(name, imageData);
			}
		}
	}

	$effect(() => {
		addIcon('toilet-free', '#60a5fa');
		addIcon('toilet-paid', '#1e40af');
	});
</script>

<GeoJSONSource
	id="toilets-source"
	data={{
		type: 'FeatureCollection',
		features: features,
	}}
>
	<SymbolLayer
		id="toilets-layer"
		layout={{
			visibility: isLayerVisible('toilets') ? 'visible' : 'none',
			'icon-image': ['case', ['get', 'fee'], 'toilet-paid', 'toilet-free'],
			'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 17, 0.8],
			'icon-allow-overlap': true,
		}}
	/>

	<CircleLayer
		id="toilets-layer-hitarea"
		layout={{
			visibility: isLayerVisible('toilets') ? 'visible' : 'none',
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
		id="toilets-label"
		minzoom={15}
		layout={{
			visibility: isLayerVisible('toilets') ? 'visible' : 'none',
			'text-field': ['coalesce', ['get', 'name'], 'Toilettes'],
			'text-font': ['Open Sans Bold'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 15, 11, 18, 13],
			'text-offset': [0, 1.5],
			'text-anchor': 'top',
		}}
		paint={{
			'text-color': '#1e40af',
			'text-halo-color': '#ffffff',
			'text-halo-width': 2,
		}}
	/>
</GeoJSONSource>
