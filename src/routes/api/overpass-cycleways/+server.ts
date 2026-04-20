import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCachedOverpassCyclewaysData } from '$lib/server/cache';

export const GET: RequestHandler = async () => {
	try {
		const data = await getCachedOverpassCyclewaysData();
		return json(data, {
			headers: {
				'Cache-Control': 'public, max-age=300, stale-while-revalidate=300',
			},
		});
	} catch (error) {
		console.error('Error fetching Overpass Cycleways data:', error);
		return json({ error: 'Failed to fetch Overpass Cycleways data' }, { status: 500 });
	}
};
