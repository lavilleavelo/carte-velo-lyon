import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCachedOverpassOnewaysData } from '$lib/server/cache';
import { findDualCarriagewayWayIds } from '$lib/server/onewayPairs';

type OverpassResponse = { elements?: { id: number; type: string }[] } & Record<string, unknown>;

let memo: { source: OverpassResponse; filtered: OverpassResponse } | null = null;

function filterPaired(raw: OverpassResponse): OverpassResponse {
	const elements = Array.isArray(raw?.elements) ? raw.elements : [];
	const paired = findDualCarriagewayWayIds(elements as never);
	if (paired.size === 0) {
		return raw;
	}

	return { ...raw, elements: elements.filter((el) => !paired.has(el.id)) };
}

export const GET: RequestHandler = async () => {
	try {
		const raw = (await getCachedOverpassOnewaysData()) as OverpassResponse;
		const data = memo && memo.source === raw ? memo.filtered : filterPaired(raw);
		if (!memo || memo.source !== raw) {
			memo = { source: raw, filtered: data };
		}

		return json(data, {
			headers: {
				'Cache-Control': 'public, max-age=300, stale-while-revalidate=300',
			},
		});
	} catch (error) {
		console.error('Error fetching Overpass one-way data:', error);
		return json({ error: 'Failed to fetch Overpass one-way data' }, { status: 500 });
	}
};
