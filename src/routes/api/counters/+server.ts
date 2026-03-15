import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCachedCountersData } from '$lib/server/cache';

export const GET: RequestHandler = async () => {
	try {
		const data = await getCachedCountersData();
		return json(data, {
			headers: {
				'Cache-Control': 'public, max-age=300, stale-while-revalidate=300',
			},
		});
	} catch (error) {
		console.error('Error fetching counters data:', error);
		return json({ error: 'Failed to fetch counters data' }, { status: 500 });
	}
};
