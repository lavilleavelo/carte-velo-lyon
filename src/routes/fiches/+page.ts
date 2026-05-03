import { getAllFiches } from '$lib/content/fiches';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = () => {
	const fiches = getAllFiches()
		.map((f) => ({
			slug: f.slug,
			title: f.title,
			subtitle: f.subtitle,
			type: f.type,
			summary: f.summary,
			address: f.address,
			lng: f.lng,
			lat: f.lat,
			updated: f.updated instanceof Date ? f.updated.toISOString() : f.updated,
			photoCount: f.photos?.length ?? 0,
			cover: f.photos?.[0]?.url,
			hasPanoramax: Boolean(f.panoramax),
			parkingGid: f.parkingGid,
		}))
		.sort((a, b) => a.title.localeCompare(b.title, 'fr'));

	return {
		fiches,
		seo: {
			title: 'Fiches (debug)',
			description: 'Liste interne des fiches personnalisées.',
			robots: 'noindex, nofollow',
		},
	};
};
