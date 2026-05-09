export type LegendId =
	| 'piste-bidir'
	| 'piste-unidir'
	| 'voie-verte'
	| 'bande'
	| 'bus-velo'
	| 'velorue'
	| 'dsc'
	| 'trottoir';

export const ALL_LEGEND_IDS: LegendId[] = [
	'piste-bidir',
	'piste-unidir',
	'voie-verte',
	'bande',
	'bus-velo',
	'velorue',
	'dsc',
	'trottoir',
];

export const DEFAULT_LEGEND_IDS: LegendId[] = ALL_LEGEND_IDS.filter((id) => id !== 'trottoir');

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
	if (type === 'Voie piétonne (vélos autorisés)') return 'trottoir';
	return null;
}

/**
 * Compute the next filter state given a click on item `id`.
 * Empty array is the "all shown" sentinel: returned both when no filter is
 * active and when every item would end up selected, to keep state compact.
 */
export function toggleInclusion(
	current: readonly string[],
	id: string,
	allIds: readonly string[],
): string[] {
	let next: string[];
	if (current.length === 0) {
		next = allIds.filter((t) => t !== id);
	} else if (current.includes(id)) {
		next = current.filter((t) => t !== id);
	} else {
		next = [...current, id];
	}
	if (next.length === 0 || next.length === allIds.length) {
		return [];
	}
	return next;
}

export function toggleLegendId(current: readonly string[], id: string): string[] {
	return toggleInclusion(current, id, ALL_LEGEND_IDS);
}

export function soloInclusion(current: readonly string[], id: string): string[] {
	if (current.length === 1 && current[0] === id) {
		return [];
	}

	return [id];
}
