export const PISTE_BIDIR_LINE_WIDTH = [
	'interpolate',
	['exponential', 1.5],
	['zoom'],
	8,
	1.2,
	11,
	2.4,
	14,
	4,
	17,
	6,
] as const;

export const PISTE_UNIDIR_LINE_WIDTH = [
	'interpolate',
	['exponential', 1.5],
	['zoom'],
	8,
	0.8,
	11,
	1.4,
	14,
	2.2,
	17,
	3,
] as const;

export const VOIE_VERTE_LINE_WIDTH = [
	'interpolate',
	['exponential', 1.5],
	['zoom'],
	8,
	1.2,
	11,
	2.4,
	14,
	4,
	17,
	6,
] as const;

export const VOIE_VERTE_DASHARRAY: [number, number] = [0.3, 1.6];
export const BANDE_DASHARRAY: [number, number] = [2.5, 1];
export const BUS_VELO_DASHARRAY: [number, number] = [0.1, 1.5];
export const VELORUE_DASHARRAY: [number, number] = [2.5, 1.2];

export const VOIE_VERTE_LINE_CAP = 'round' as const;
export const BUS_VELO_LINE_CAP = 'round' as const;
export const VELORUE_LINE_CAP = 'butt' as const;

export const DSC_ARROW_SYMBOL_SPACING = 40;
export const DSC_ARROW_TEXT_SIZE = 16;

export const NORMAL_LINE_OPACITY = 0.9;
