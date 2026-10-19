import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpeedLimitProperties } from '$lib/server/speedLimits';

export const GET: RequestHandler = async ({ params }) => {
	const gid = Number(params.gid);
	if (!Number.isInteger(gid)) {
		return json({ error: 'Invalid gid' }, { status: 400 });
	}

	try {
		const properties = await getSpeedLimitProperties(gid);
		if (!properties) {
			return json({ error: 'Not found' }, { status: 404 });
		}

		return json(properties, {
			headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=300' },
		});
	} catch (error) {
		console.error(`Error fetching speed limit ${gid}:`, error);
		return json({ error: 'Failed to fetch data' }, { status: 500 });
	}
};
