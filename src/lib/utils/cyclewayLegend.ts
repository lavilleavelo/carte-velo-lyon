export type LegendId =
	| 'piste-bidir'
	| 'piste-unidir'
	| 'voie-verte'
	| 'bande'
	| 'bus-velo'
	| 'velorue'
	| 'dsc';

export const ALL_LEGEND_IDS: LegendId[] = [
	'piste-bidir',
	'piste-unidir',
	'voie-verte',
	'bande',
	'bus-velo',
	'velorue',
	'dsc',
];

export function voirieFeatureToLegendId(properties: any): LegendId | null {
	const type = properties?.typeamenagement as string | undefined;
	const sens = properties?.senscirculation as string | undefined;
	if (type === 'Piste Cyclable') return sens === 'Double' ? 'piste-bidir' : 'piste-unidir';
	if (type === 'Voie verte') return 'voie-verte';
	if (type === 'Bande Cyclable') return 'bande';
	if (type === 'Couloir bus vélo élargi' || type === 'Couloir bus vélo non élargi')
		return 'bus-velo';
	if (type === 'Double sens cyclable') return 'dsc';
	return null;
}

export function osmFeatureToLegendId(properties: any): LegendId | null {
	const type = properties?.typeamenagement as string | undefined;
	const bidir = properties?.bidirectional === true;
	if (type === 'Piste Cyclable') return bidir ? 'piste-bidir' : 'piste-unidir';
	if (type === 'Voie verte') return 'voie-verte';
	if (type === 'Bande Cyclable') return 'bande';
	if (type === 'Couloir bus vélo') return 'bus-velo';
	if (type === 'Vélorue') return 'velorue';
	if (type === 'Double sens cyclable') return 'dsc';
	return null;
}

/**
 * Compute the next cyclewayTypes filter state given a click on legend item `id`.
 * Empty array is the "all shown" sentinel — it's returned both when no filter is
 * active and when every item would end up selected, to keep state compact.
 */
export function toggleLegendId(current: readonly string[], id: string): string[] {
	let next: string[];
	if (current.length === 0) {
		next = ALL_LEGEND_IDS.filter((t) => t !== id);
	} else if (current.includes(id)) {
		next = current.filter((t) => t !== id);
	} else {
		next = [...current, id];
	}
	if (next.length === 0 || next.length === ALL_LEGEND_IDS.length) {
		return [];
	}
	return next;
}
