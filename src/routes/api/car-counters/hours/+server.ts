import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCarCounterHours, parsePointIds } from '$lib/server/counters/carCounters';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 7;

export const GET: RequestHandler = async ({ url }) => {
	const pointIds = parsePointIds(url.searchParams.get('ids'));
	const days = (url.searchParams.get('days') ?? '').split(',').filter(Boolean);

	if (!pointIds) {
		return json(
			{ error: 'Expected 1 to 10 count point ids, separated by commas' },
			{ status: 400 },
		);
	}
	if (days.length === 0 || days.length > MAX_DAYS || !days.every((day) => DAY_PATTERN.test(day))) {
		return json(
			{ error: `Expected 1 to ${MAX_DAYS} days as YYYY-MM-DD, separated by commas` },
			{ status: 400 },
		);
	}

	return json(getCarCounterHours(pointIds, days), {
		headers: {
			'Cache-Control': 'public, max-age=300',
		},
	});
};
