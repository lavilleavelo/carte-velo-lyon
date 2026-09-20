import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCachedGrandLyonTreesData } from '$lib/server/cache';

const BBOX_RE = /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/;

const LNG_RANGE: [number, number] = [4.2, 5.4];
const LAT_RANGE: [number, number] = [45.3, 46.1];

export const GET: RequestHandler = async ({ url }) => {
	const bbox = url.searchParams.get('bbox');
	if (!bbox || !BBOX_RE.test(bbox)) {
		return json({ error: 'Invalid bbox' }, { status: 400 });
	}

	const [w, s, e, n] = bbox.split(',').map(Number);
	const inRange =
		w >= LNG_RANGE[0] &&
		e <= LNG_RANGE[1] &&
		w <= e &&
		s >= LAT_RANGE[0] &&
		n <= LAT_RANGE[1] &&
		s <= n;
	if (!inRange) {
		return json({ error: 'Bbox out of range' }, { status: 400 });
	}

	try {
		const data = await getCachedGrandLyonTreesData(bbox);
		return json(data, {
			headers: {
				'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
			},
		});
	} catch (error) {
		console.error('Error fetching arbres data:', error);
		return json({ error: 'Failed to fetch data' }, { status: 500 });
	}
};
