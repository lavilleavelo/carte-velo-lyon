import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLiveDays } from '$lib/server/counters/live';

export const GET: RequestHandler = async ({ params }) => {
	const idPdc = Number(params.idPdc);
	if (!Number.isInteger(idPdc)) {
		return json({ error: 'Invalid counter id' }, { status: 400 });
	}

	try {
		const liveDays = await getLiveDays(idPdc);
		if (!liveDays) {
			return json({ error: 'Counter not found' }, { status: 404 });
		}
		return json(liveDays, {
			headers: {
				'Cache-Control': 'public, max-age=300',
			},
		});
	} catch (error) {
		console.error(`Error fetching live data for counter ${idPdc}:`, error);
		return json({ error: 'Eco-Counter is unavailable' }, { status: 502 });
	}
};
