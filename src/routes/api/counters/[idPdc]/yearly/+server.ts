import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCounterYearlyStats } from '$lib/server/counters/stats';

export const GET: RequestHandler = async ({ params }) => {
	const idPdc = Number(params.idPdc);
	if (!Number.isInteger(idPdc)) {
		return json({ error: 'Invalid counter id' }, { status: 400 });
	}

	try {
		const yearly = getCounterYearlyStats(idPdc);
		if (!yearly) {
			return json({ error: 'Counter not found' }, { status: 404 });
		}
		return json(yearly, {
			headers: {
				'Cache-Control': 'public, max-age=3600, stale-while-revalidate=3600',
			},
		});
	} catch (error) {
		console.error(`Error computing yearly stats for counter ${idPdc}:`, error);
		return json({ error: 'Failed to compute yearly stats' }, { status: 500 });
	}
};
