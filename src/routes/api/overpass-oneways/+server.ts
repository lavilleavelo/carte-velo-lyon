import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCachedOverpassOnewaysData } from '$lib/server/cache';

export const GET: RequestHandler = async () => {
	try {
		const data = await getCachedOverpassOnewaysData();
		return json(data, {
			headers: {
				'Cache-Control': 'public, max-age=300, stale-while-revalidate=300',
			},
		});
	} catch (error) {
		console.error('Error fetching Overpass one-way data:', error);
		return json({ error: 'Failed to fetch Overpass one-way data' }, { status: 500 });
	}
};
