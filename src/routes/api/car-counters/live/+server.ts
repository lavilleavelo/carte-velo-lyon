import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCarLiveDays, parsePointIds } from '$lib/server/counters/carCounters';

export const GET: RequestHandler = async ({ url }) => {
	const pointIds = parsePointIds(url.searchParams.get('ids'));
	if (!pointIds) {
		return json(
			{ error: 'Expected 1 to 10 count point ids, separated by commas' },
			{ status: 400 },
		);
	}

	return json(getCarLiveDays(pointIds), {
		headers: {
			'Cache-Control': 'public, max-age=300',
		},
	});
};
