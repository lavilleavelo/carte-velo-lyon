import communesIndex from '$lib/data/communes/_index.json';
import communeMetadata from '$lib/data/communeMetadata.json';
import type { PageLoad } from './$types';

export const prerender = true;

const metadataByInsee = communeMetadata as Record<string, { codePostal: string | null }>;

export const load: PageLoad = () => {
	const communes = communesIndex.map((c) => ({
		...c,
		codePostal: metadataByInsee[c.insee]?.codePostal ?? null,
	}));
	return { communes };
};
