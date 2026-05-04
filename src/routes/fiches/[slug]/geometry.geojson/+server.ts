import { error } from '@sveltejs/kit';
import { getAllFiches } from '$lib/content/fiches';
import { getFicheGeometryRaw } from '$lib/content/fiches.server';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => {
	return getAllFiches()
		.filter((f) => f.hasGeometry)
		.map((f) => ({ slug: f.slug }));
};

export const GET: RequestHandler = ({ params }) => {
	const slug = params.slug;
	const fiche = getAllFiches().find((f) => f.slug === slug);

	if (!fiche || !fiche.hasGeometry) {
		throw error(404, 'No geometry for this fiche');
	}

	const raw = getFicheGeometryRaw(fiche);
	if (!raw) {
		throw error(404, 'Geometry file missing');
	}

	return new Response(raw, {
		headers: {
			'Content-Type': 'application/geo+json; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
		},
	});
};
