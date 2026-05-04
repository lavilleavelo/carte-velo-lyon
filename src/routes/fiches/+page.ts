import { getAllFiches } from '$lib/content/fiches';
import { SITE } from '$lib/config/site';
import type { PageLoad } from './$types';

export const prerender = true;

const SITE_DOMAIN = new URL(SITE.url).host;
const SITE_DEFAULT_OG = SITE.ogImagePath;

export const load: PageLoad = () => {
	const fiches = getAllFiches()
		.map((f) => {
			const cover = f.photos?.[0];
			const ogImage = f.ogImage ?? cover?.url ?? SITE_DEFAULT_OG;
			const ogImageAlt = f.ogImageAlt ?? cover?.alt ?? f.title;
			const description = f.summary ?? f.subtitle ?? `${f.title} – ${SITE.name}`;
			const ogTitle = `${f.title} · ${SITE.name}`;

			return {
				slug: f.slug,
				basename: f.basename,
				title: f.title,
				subtitle: f.subtitle,
				type: f.type,
				summary: f.summary,
				address: f.address ?? null,
				lng: f.type === 'parking' ? f.lng : null,
				lat: f.type === 'parking' ? f.lat : null,
				updated: f.updated instanceof Date ? f.updated.toISOString() : f.updated,
				photoCount: f.photos?.length ?? 0,
				hasPanoramax: Boolean(f.panoramax),
				parkingGid: f.type === 'parking' ? f.parkingGid : undefined,
				hasGeometry: f.hasGeometry,
				ogTitle,
				ogDescription: description,
				ogImage,
				ogImageAlt,
				ogImageIsFallback: ogImage === SITE_DEFAULT_OG,
			};
		})
		.sort((a, b) => a.title.localeCompare(b.title, 'fr'));

	return {
		fiches,
		siteDomain: SITE_DOMAIN,
		seo: {
			title: 'Liste des Fiches',
			robots: 'noindex, nofollow',
		},
	};
};
