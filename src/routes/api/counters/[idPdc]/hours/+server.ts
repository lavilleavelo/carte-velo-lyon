import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCounterHours } from '$lib/server/counters/hours';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 7;

export const GET: RequestHandler = async ({ params, url }) => {
	const idPdc = Number(params.idPdc);
	const days = (url.searchParams.get('days') ?? '').split(',').filter(Boolean);

	if (!Number.isInteger(idPdc)) {
		return json({ error: 'Invalid counter id' }, { status: 400 });
	}
	if (days.length === 0 || days.length > MAX_DAYS || !days.every((day) => DAY_PATTERN.test(day))) {
		return json(
			{ error: `Expected 1 to ${MAX_DAYS} days as YYYY-MM-DD, separated by commas` },
			{ status: 400 },
		);
	}

	try {
		const hours = await getCounterHours(idPdc, days);
		if (!hours) {
			return json({ error: 'Counter not found' }, { status: 404 });
		}
		return json(hours, {
			headers: {
				'Cache-Control': 'public, max-age=300',
			},
		});
	} catch (error) {
		console.error(`Error fetching hourly counts for counter ${idPdc}:`, error);
		return json({ error: 'Failed to fetch hourly counts' }, { status: 500 });
	}
};
