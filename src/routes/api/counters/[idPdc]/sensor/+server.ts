import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCounterSensor } from '$lib/server/counters/sensor';

export const GET: RequestHandler = async ({ params }) => {
	const idPdc = Number(params.idPdc);
	if (!Number.isInteger(idPdc)) {
		return json({ error: 'Invalid counter id' }, { status: 400 });
	}

	try {
		const sensor = getCounterSensor(idPdc);
		if (!sensor) {
			return json({ error: 'Counter not found' }, { status: 404 });
		}
		return json(sensor, {
			headers: {
				'Cache-Control': 'public, max-age=3600, stale-while-revalidate=3600',
			},
		});
	} catch (error) {
		console.error(`Error computing sensor details for counter ${idPdc}:`, error);
		return json({ error: 'Failed to compute counter sensor details' }, { status: 500 });
	}
};
