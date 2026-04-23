import communesIndex from '$lib/data/communes/_index.json';
import { codePostalBySlug } from '$lib/data/codePostalBySlug';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = () => {
	const communes = communesIndex.map((c) => ({
		...c,
		codePostal: codePostalBySlug[c.slug] ?? null,
	}));
	return { communes };
};
