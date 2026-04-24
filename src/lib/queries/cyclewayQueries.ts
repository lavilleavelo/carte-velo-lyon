import { queryOptions } from '@tanstack/svelte-query';
import type { FeatureCollection } from 'geojson';
import { overpassToGeoJSON } from '$lib/utils/osmCycleway';

export function osmCyclewaysQueryOptions(enabled = true) {
	return queryOptions({
		queryKey: ['overpass-cycleways'],
		queryFn: async (): Promise<FeatureCollection> => {
			const response = await fetch('/api/overpass-cycleways');
			if (!response.ok) throw new Error('Failed to fetch Overpass cycleways data');
			return overpassToGeoJSON(await response.json());
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		enabled,
		meta: { loadingLabel: 'Aménagements cyclables' },
	});
}

export function voirieQueryOptions() {
	return queryOptions({
		queryKey: ['voirie-data'],
		queryFn: async (): Promise<FeatureCollection> => {
			const response = await fetch('/api/grandlyon/voirie');
			if (!response.ok) throw new Error('Failed to fetch voirie data');
			return response.json();
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		meta: { loadingLabel: 'Aménagements cyclables (Grand Lyon)' },
	});
}

export function speedLimitsQueryOptions(enabled = true) {
	return queryOptions({
		queryKey: ['speed-limits'],
		queryFn: async (): Promise<FeatureCollection> => {
			const response = await fetch('/api/grandlyon/speedLimits');
			if (!response.ok) throw new Error('Failed to fetch speed limits data');
			return response.json();
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		enabled,
		meta: { loadingLabel: 'Limitations de vitesse' },
	});
}
