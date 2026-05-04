import { error } from '@sveltejs/kit';
import { getAllFiches, type FicheType } from '$lib/content/fiches';
import { getMergedGeojsonForType } from '$lib/content/fiches.server';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

const KNOWN_TYPES: ReadonlySet<FicheType> = new Set<FicheType>(['parking', 'itineraire']);

function isFicheType(value: string): value is FicheType {
	return KNOWN_TYPES.has(value as FicheType);
}

export const entries: EntryGenerator = () => {
	const types = new Set<FicheType>();

	for (const f of getAllFiches()) {
		if (f.hasGeometry) {
			types.add(f.type);
		}
	}

	return [...types].map((type) => ({ type }));
};

export const GET: RequestHandler = ({ params }) => {
	const type = params.type;
	if (!isFicheType(type)) {
		throw error(404, `Unknown fiche type: ${type}`);
	}
	const fc = getMergedGeojsonForType(type);
	return new Response(JSON.stringify(fc), {
		headers: {
			'Content-Type': 'application/geo+json; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
		},
	});
};
