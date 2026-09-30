import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCounterPhotos } from '$lib/server/counters/photos';

export const GET: RequestHandler = async ({ params }) => {
	const idPdc = Number(params.idPdc);
	if (!Number.isInteger(idPdc)) {
		return json({ error: 'Invalid counter id' }, { status: 400 });
	}

	return json(
		getCounterPhotos(idPdc).map(({ file, thumbnail }) => ({
			url: `/api/counter-photos/${file}`,
			thumbnail: `/api/counter-photos/${thumbnail ?? file}`,
		})),
		{
			headers: {
				'Cache-Control': 'public, max-age=86400',
			},
		},
	);
};
