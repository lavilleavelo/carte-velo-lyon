export function normalizeForSearch(s: string): string {
	return s
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/['’`]/g, '');
}

export function tokenize(query: string): string[] {
	return normalizeForSearch(query)
		.split(/\s+/)
		.filter((t) => t.length > 0);
}

export function matchesAllTokens(haystack: string, tokens: string[]): boolean {
	if (tokens.length === 0) {
		return true;
	}

	const normalizedHay = normalizeForSearch(haystack);
	for (const t of tokens) {
		if (!normalizedHay.includes(t)) {
			return false;
		}
	}

	return true;
}
