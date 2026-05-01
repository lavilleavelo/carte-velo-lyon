import { error } from '@sveltejs/kit';
import { getAllFiches, getFiche } from '$lib/content/fiches';
import { SITE } from '$lib/config/site';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => {
	return getAllFiches().map((f) => ({ slug: f.slug }));
};

export const load: PageLoad = ({ params }) => {
	const fiche = getFiche(params.slug);
	if (!fiche) {
		throw error(404, 'Fiche introuvable');
	}

	const description = fiche.summary ?? fiche.subtitle ?? `${fiche.title} – ${SITE.name}`;
	const cover = fiche.photos?.[0];
	const image = fiche.ogImage ?? cover?.url;
	const imageAlt = fiche.ogImageAlt ?? cover?.alt ?? fiche.title;

	return {
		slug: fiche.slug,
		seo: {
			title: `${fiche.title} · ${SITE.name}`,
			description,
			image,
			imageAlt,
		},
	};
};
