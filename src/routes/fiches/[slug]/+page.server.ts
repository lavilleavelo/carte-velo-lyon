import { error } from '@sveltejs/kit';
import { getAllFiches, getFiche } from '$lib/content/fiches';
import { getFicheGeometry, summarizeFeatureCollection } from '$lib/content/fiches.server';
import { absoluteUrl, SITE } from '$lib/config/site';
import type { EntryGenerator, PageServerLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => {
	return getAllFiches().map((f) => ({ slug: f.slug }));
};

function toAbsolute(url: string | undefined): string | undefined {
	if (!url) {
		return undefined;
	}

	if (url.startsWith('http://') || url.startsWith('https://')) {
		return url;
	}

	return absoluteUrl(url);
}

export const load: PageServerLoad = ({ params }) => {
	const fiche = getFiche(params.slug);
	if (!fiche) {
		throw error(404, 'Fiche introuvable');
	}

	const description = fiche.summary ?? fiche.subtitle ?? `${fiche.title} – ${SITE.name}`;
	const cover = fiche.photos?.[0];
	const image = toAbsolute(fiche.ogImage ?? cover?.url);
	const imageAlt = fiche.ogImageAlt ?? cover?.alt ?? fiche.title;

	let geometry: { bbox: [number, number, number, number]; lengthKm: number } | null = null;

	if (fiche.hasGeometry) {
		const fc = getFicheGeometry(fiche);

		if (fc) {
			const summary = summarizeFeatureCollection(fc);
			if (summary) {
				geometry = summary;
			}
		}
	}

	return {
		slug: fiche.slug,
		geometry,
		geometryUrl: fiche.hasGeometry ? `/fiches/${fiche.slug}/geometry.geojson` : null,
		seo: {
			title: `${fiche.title} · ${SITE.name}`,
			description,
			image,
			imageAlt,
		},
	};
};
