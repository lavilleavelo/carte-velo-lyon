import { queryOptions } from '@tanstack/svelte-query';
import type { FeatureCollection, Point } from 'geojson';
import { processParkingData, type ParkingProperties } from '$lib/utils/parkingUtils';

export function parkingQueryOptions(enabled = true) {
	return queryOptions({
		queryKey: ['parking'],
		queryFn: async (): Promise<FeatureCollection<Point, ParkingProperties>> => {
			const response = await fetch('/api/grandlyon/parking');
			if (!response.ok) {
				throw new Error('Failed to fetch parking data');
			}

			const data = await response.json();
			return processParkingData(data.features);
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		enabled,
		meta: { loadingLabel: 'Stationnements vélo' },
	});
}
