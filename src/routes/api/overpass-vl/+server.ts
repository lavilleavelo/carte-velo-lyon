import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCachedOverpassVLData } from '$lib/server/cache';

export const GET: RequestHandler = async () => {
	try {
		const data = await getCachedOverpassVLData();
		return json(data, {
			headers: {
				'Cache-Control': 'public, max-age=300, stale-while-revalidate=300',
			},
		});
	} catch (error) {
		console.error('Error fetching Overpass VL data:', error);
		return json({ error: 'Failed to fetch Overpass VL data' }, { status: 500 });
	}
};
