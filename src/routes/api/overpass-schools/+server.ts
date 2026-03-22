import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCachedOverpassSchoolsData } from '$lib/server/cache';

export const GET: RequestHandler = async () => {
	try {
		const data = await getCachedOverpassSchoolsData();
		return json(data, {
			headers: {
				'Cache-Control': 'public, max-age=300, stale-while-revalidate=300',
			},
		});
	} catch (error) {
		console.error('Error fetching Overpass schools data:', error);
		return json({ error: 'Failed to fetch Overpass schools data' }, { status: 500 });
	}
};
