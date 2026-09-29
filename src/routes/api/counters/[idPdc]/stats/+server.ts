import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCounterStats } from '$lib/server/counters/stats';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const GET: RequestHandler = async ({ params, url }) => {
	const idPdc = Number(params.idPdc);
	const from = url.searchParams.get('from') ?? undefined;
	const to = url.searchParams.get('to') ?? undefined;

	if (!Number.isInteger(idPdc)) {
		return json({ error: 'Invalid counter id' }, { status: 400 });
	}
	if ((from && !DAY_PATTERN.test(from)) || (to && !DAY_PATTERN.test(to))) {
		return json({ error: 'Invalid date, expected YYYY-MM-DD' }, { status: 400 });
	}

	try {
		const stats = getCounterStats(idPdc, { from, to });
		if (!stats) {
			return json({ error: 'Counter not found' }, { status: 404 });
		}
		return json(stats, {
			headers: {
				'Cache-Control': 'public, max-age=3600, stale-while-revalidate=3600',
			},
		});
	} catch (error) {
		console.error(`Error computing stats for counter ${idPdc}:`, error);
		return json({ error: 'Failed to compute counter stats' }, { status: 500 });
	}
};
