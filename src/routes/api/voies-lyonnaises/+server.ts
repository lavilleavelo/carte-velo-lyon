import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCachedVoiesLyonnaisesData } from '$lib/server/cache';

export const GET: RequestHandler = async () => {
	try {
		const data = await getCachedVoiesLyonnaisesData();
		return json(data, {
			headers: {
				'Cache-Control': 'public, max-age=300, stale-while-revalidate=300',
			},
		});
	} catch (error) {
		console.error('Error fetching voies lyonnaises data:', error);
		return json({ error: 'Failed to fetch voies lyonnaises data' }, { status: 500 });
	}
};
