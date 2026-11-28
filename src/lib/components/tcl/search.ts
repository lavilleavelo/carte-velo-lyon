function normalize(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase();
}

export function containsFilter(value: string, search: string, keywords?: string[]): number {
	const needle = normalize(search.trim());
	if (!needle) {
		return 1;
	}
	return [value, ...(keywords ?? [])].some((text) => normalize(text).includes(needle)) ? 1 : 0;
}
