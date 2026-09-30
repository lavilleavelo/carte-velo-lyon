import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCarCounterYearlyStats, parsePointIds } from '$lib/server/counters/carCounters';

export const GET: RequestHandler = async ({ url }) => {
	const pointIds = parsePointIds(url.searchParams.get('ids'));
	if (!pointIds) {
		return json(
			{ error: 'Expected 1 to 10 count point ids, separated by commas' },
			{ status: 400 },
		);
	}

	try {
		const yearly = getCarCounterYearlyStats(pointIds);
		if (!yearly) {
			return json({ error: 'No data for these count points' }, { status: 404 });
		}
		return json(yearly, {
			headers: {
				'Cache-Control': 'public, max-age=3600, stale-while-revalidate=3600',
			},
		});
	} catch (error) {
		console.error(`Error computing yearly stats for car count points ${pointIds}:`, error);
		return json({ error: 'Failed to compute car counter yearly stats' }, { status: 500 });
	}
};
