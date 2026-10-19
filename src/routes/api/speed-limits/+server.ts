import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSlimSpeedLimitsJson } from '$lib/server/speedLimits';

export const GET: RequestHandler = async () => {
	try {
		return new Response(await getSlimSpeedLimitsJson(), {
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'public, max-age=300, stale-while-revalidate=300',
			},
		});
	} catch (error) {
		console.error('Error fetching speed limits:', error);
		return json({ error: 'Failed to fetch data' }, { status: 500 });
	}
};
