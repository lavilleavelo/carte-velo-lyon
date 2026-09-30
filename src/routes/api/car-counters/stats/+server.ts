import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCarCounterStats, parsePointIds } from '$lib/server/counters/carCounters';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const GET: RequestHandler = async ({ url }) => {
	const pointIds = parsePointIds(url.searchParams.get('ids'));
	const from = url.searchParams.get('from') ?? undefined;
	const to = url.searchParams.get('to') ?? undefined;

	if (!pointIds) {
		return json(
			{ error: 'Expected 1 to 10 count point ids, separated by commas' },
			{ status: 400 },
		);
	}
	if ((from && !DAY_PATTERN.test(from)) || (to && !DAY_PATTERN.test(to))) {
		return json({ error: 'Invalid date, expected YYYY-MM-DD' }, { status: 400 });
	}

	try {
		const stats = getCarCounterStats(pointIds, { from, to });
		if (!stats) {
			return json({ error: 'No data for these count points' }, { status: 404 });
		}
		return json(stats, {
			headers: {
				'Cache-Control': 'public, max-age=3600, stale-while-revalidate=3600',
			},
		});
	} catch (error) {
		console.error(`Error computing stats for car count points ${pointIds}:`, error);
		return json({ error: 'Failed to compute car counter stats' }, { status: 500 });
	}
};
