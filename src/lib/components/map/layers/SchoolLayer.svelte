<script lang="ts">
	import { GeoJSONSource, SymbolLayer, CircleLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import type { GeoJSON, FeatureCollection } from 'geojson';
	import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';

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

	type SchoolType = 'maternelle' | 'elementaire' | 'college' | 'lycee';

	function classifySchool(tags: Record<string, string>): SchoolType {
		const amenity = tags.amenity;
		const schoolFR = (tags['school:FR'] || '').toLowerCase();
		const isced = tags['isced:level'] || '';
		const name = (tags.name || '').toLowerCase();

		if (amenity === 'kindergarten' || schoolFR === 'maternelle' || isced === '0') {
			return 'maternelle';
		}
		if (schoolFR === 'collège' || schoolFR === 'college' || isced === '2') {
			return 'college';
		}
		if (schoolFR === 'lycée' || schoolFR === 'lycee' || isced === '3') {
			return 'lycee';
		}

		if (name.includes('collège') || name.includes('college')) return 'college';
		if (name.includes('lycée') || name.includes('lycee')) return 'lycee';
		if (name.includes('maternelle')) return 'maternelle';

		return 'elementaire';
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
				const schoolType = classifySchool(tags);
				return {
					type: 'Feature' as const,
					geometry: {
						type: 'Point' as const,
						coordinates: [lon, lat],
					},
					properties: {
						osmId: el.id,
						name: tags.name || null,
						operator: tags.operator || null,
						schoolType,
					},
				};
			});
	}

	const anySchoolVisible = $derived(
		isLayerVisible('schools-maternelle') ||
			isLayerVisible('schools-elementaire') ||
			isLayerVisible('schools-college') ||
			isLayerVisible('schools-lycee'),
	);

	const schoolsQuery = createQuery(() => ({
		queryKey: ['overpass-schools'],
		queryFn: async () => {
			const response = await fetch('/api/overpass-schools');
			if (!response.ok) {
				throw new Error('Failed to fetch school data');
			}
			const data = await response.json();
			return overpassToGeoJSON(data);
		},
		staleTime: Infinity,
		enabled: anySchoolVisible,
		meta: { loadingLabel: 'Établissements scolaires' },
	}));

	const features = $derived(schoolsQuery.data || []);

	const visibleData = $derived.by<FeatureCollection>(() => {
		const fc: FeatureCollection = { type: 'FeatureCollection', features: features as any };
		return boundary ? filterFeaturesInsideBoundary(fc, boundary) : fc;
	});

	const schoolTypes: { type: SchoolType; layerId: string; color: string; label: string }[] = [
		{ type: 'maternelle', layerId: 'schools-maternelle', color: '#f59e0b', label: 'Mat' },
		{ type: 'elementaire', layerId: 'schools-elementaire', color: '#3b82f6', label: 'Elem' },
		{ type: 'college', layerId: 'schools-college', color: '#8b5cf6', label: 'Col' },
		{ type: 'lycee', layerId: 'schools-lycee', color: '#ef4444', label: 'Lyc' },
	];

	function createSchoolIcon(bgColor: string, text: string): HTMLCanvasElement {
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
		ctx.font = 'bold 12px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(text, size / 2, size / 2);

		return canvas;
	}

	function addIcon(name: string, color: string, text: string) {
		if (map && !map.hasImage(name)) {
			const canvas = createSchoolIcon(color, text);
			const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
			if (imageData) {
				map.addImage(name, imageData);
			}
		}
	}

	$effect(() => {
		for (const st of schoolTypes) {
			addIcon(`school-${st.type}`, st.color, st.label);
		}
	});
</script>

<GeoJSONSource id="schools-source" data={visibleData}>
	{#each schoolTypes as st}
		<SymbolLayer
			id={`schools-${st.type}-layer`}
			filter={['==', ['get', 'schoolType'], st.type]}
			layout={{
				visibility: isLayerVisible(st.layerId) ? 'visible' : 'none',
				'icon-image': `school-${st.type}`,
				'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 17, 0.8],
				'icon-allow-overlap': true,
			}}
		/>

		<CircleLayer
			id={`schools-${st.type}-hitarea`}
			filter={['==', ['get', 'schoolType'], st.type]}
			layout={{
				visibility: isLayerVisible(st.layerId) ? 'visible' : 'none',
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
			id={`schools-${st.type}-label`}
			filter={['==', ['get', 'schoolType'], st.type]}
			minzoom={15}
			layout={{
				visibility: isLayerVisible(st.layerId) ? 'visible' : 'none',
				'text-field': ['coalesce', ['get', 'name'], ''],
				'text-font': ['Open Sans Bold'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 15, 11, 18, 13],
				'text-offset': [0, 1.5],
				'text-anchor': 'top',
			}}
			paint={{
				'text-color': st.color,
				'text-halo-color': '#ffffff',
				'text-halo-width': 2,
			}}
		/>
	{/each}
</GeoJSONSource>
