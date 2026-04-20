export function communeNameToSlug(name: string): string {
	const arrMatch = name.match(/^Lyon\s+(\d+)(?:er|e)?\s+Arrondissement$/i);
	if (arrMatch) {
		return `lyon-${parseInt(arrMatch[1], 10)}`;
	}

	return name
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/['’]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function communeUrl(name: string): string {
	return `/communes/${communeNameToSlug(name)}`;
}
