import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCachedGrandLyonData, GRAND_LYON_URLS, type GrandLyonDataType } from '$lib/server/cache';

const validTypes = Object.keys(GRAND_LYON_URLS) as GrandLyonDataType[];

export const GET: RequestHandler = async ({ params }) => {
	const { type } = params;

	if (!validTypes.includes(type as GrandLyonDataType)) {
		return json({ error: 'Invalid data type' }, { status: 400 });
	}

	try {
		const data = await getCachedGrandLyonData(type as GrandLyonDataType);
		return json(data, {
			headers: {
				'Cache-Control': 'public, max-age=60, stale-while-revalidate=60',
			},
		});
	} catch (error) {
		console.error(`Error fetching ${type} data:`, error);
		return json({ error: 'Failed to fetch data' }, { status: 500 });
	}
};
