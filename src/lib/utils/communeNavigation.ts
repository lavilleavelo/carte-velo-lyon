const PRESERVED_PARAMS = [
	'layers',
	'mapStyle',
	'sidebar',
	'filterByYear',
	'yearFrom',
	'yearTo',
	'cyclewayTypes',
	'cyclewayReseau',
	'cyclewayType',
	'cyclewayLocalisation',
	'speedLimits',
	'targetNetworkHorizons',
	'projectVLStatuses',
	'safety',
	'safetyFilter',
] as const;

export function buildCommuneHref(slug: string): string {
	const base = `/communes/${slug}`;
	if (typeof window === 'undefined') return base;
	const current = new URLSearchParams(window.location.search);
	const next = new URLSearchParams();
	for (const key of PRESERVED_PARAMS) {
		const values = current.getAll(key);
		for (const v of values) next.append(key, v);
	}
	const qs = next.toString();
	return qs ? `${base}?${qs}` : base;
}
