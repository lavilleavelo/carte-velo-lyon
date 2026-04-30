<script lang="ts">
	import { GeoJSONSource, SymbolLayer, CircleLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import accidentsUrl from '$lib/data/accidents-velo.json?url';
	import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
	import type { FeatureCollection } from 'geojson';

	let {
		isLayerVisible,
		handleMouseEnter,
		handleMouseLeave,
		map,
		boundary,
	}: {
		isLayerVisible: (id: string) => boolean;
		handleMouseEnter?: () => void;
		handleMouseLeave?: () => void;
		map?: import('maplibre-gl').Map;
		boundary?: FeatureCollection;
	} = $props();

	const gravities = [
		{ id: 'accidents-tue', gravite: 'Tué', color: '#111827' },
		{ id: 'accidents-hospitalise', gravite: 'Blessé hospitalisé', color: '#dc2626' },
		{ id: 'accidents-leger', gravite: 'Blessé léger', color: '#ca8a04' },
		{ id: 'accidents-indemne', gravite: 'Indemne', color: '#60a5fa' },
	] as const;

	const anyVisible = $derived(gravities.some((g) => isLayerVisible(g.id)));

	const accidentsQuery = createQuery(() => ({
		queryKey: ['accidents-velo'],
		queryFn: async (): Promise<FeatureCollection> => {
			const r = await fetch(accidentsUrl);
			if (!r.ok) {
				throw new Error('Failed to fetch accidents data');
			}

			return (await r.json()) as FeatureCollection;
		},
		staleTime: Infinity,
		enabled: anyVisible,
		meta: { loadingLabel: 'Accidents vélo' },
	}));

	const data = $derived.by<FeatureCollection>(() => {
		const base: FeatureCollection = accidentsQuery.data ?? {
			type: 'FeatureCollection',
			features: [],
		};
		return boundary ? filterFeaturesInsideBoundary(base, boundary) : base;
	});

	function createBurstIcon(color: string, seed: number): HTMLCanvasElement {
		const size = 56;
		const cx = size / 2;
		const cy = size / 2;
		const points = 13;
		const baseOuter = size / 2 - 5;
		const innerR = baseOuter * 0.28;

		let s = seed || 1;
		const rand = () => {
			s = (s * 9301 + 49297) % 233280;
			return s / 233280;
		};

		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d')!;

		ctx.beginPath();
		for (let i = 0; i < points * 2; i++) {
			const isOuter = i % 2 === 0;
			const r = isOuter ? baseOuter * (0.62 + rand() * 0.38) : innerR * (0.85 + rand() * 0.3);
			const baseA = (i * Math.PI) / points - Math.PI / 2;
			const jitter = (rand() - 0.5) * 0.22;
			const a = baseA + jitter;
			const x = cx + Math.cos(a) * r;
			const y = cy + Math.sin(a) * r;
			if (i === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		}
		ctx.closePath();

		ctx.fillStyle = color;
		ctx.fill();
		ctx.lineJoin = 'miter';
		ctx.miterLimit = 6;
		ctx.strokeStyle = '#ffffff';
		ctx.lineWidth = 1.5;
		ctx.stroke();

		return canvas;
	}

	function addIcon(name: string, color: string, seed: number) {
		if (!map || map.hasImage(name)) {
			return;
		}

		const canvas = createBurstIcon(color, seed);
		const ctx = canvas.getContext('2d');
		const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
		if (imageData) map.addImage(name, imageData);
	}

	$effect(() => {
		if (!map) {
			return;
		}

		gravities.forEach((g, idx) => {
			addIcon(`accident-burst-${g.id}`, g.color, 17 + idx * 53);
		});
	});
</script>

<GeoJSONSource id="accidents-velo-source" {data}>
	{#each gravities as g (g.id)}
		{@const visible = isLayerVisible(g.id)}
		<SymbolLayer
			id={`${g.id}-layer`}
			filter={['==', ['get', 'gravite'], g.gravite]}
			layout={{
				visibility: visible ? 'visible' : 'none',
				'icon-image': `accident-burst-${g.id}`,
				'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 14, 0.5, 17, 0.85],
				'icon-allow-overlap': true,
				'icon-ignore-placement': true,
			}}
		/>
		<CircleLayer
			id={`${g.id}-hitarea`}
			filter={['==', ['get', 'gravite'], g.gravite]}
			layout={{ visibility: visible ? 'visible' : 'none' }}
			paint={{
				'circle-opacity': 0,
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 14, 18, 22],
				'circle-color': 'transparent',
			}}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
		/>
	{/each}
</GeoJSONSource>
