import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCachedOverpassPOIsData } from '$lib/server/cache';

export const GET: RequestHandler = async () => {
	try {
		const data = await getCachedOverpassPOIsData();
		return json(data, {
			headers: {
				'Cache-Control': 'public, max-age=300, stale-while-revalidate=300',
			},
		});
	} catch (error) {
		console.error('Error fetching Overpass POIs data:', error);
		return json({ error: 'Failed to fetch Overpass POIs data' }, { status: 500 });
	}
};
