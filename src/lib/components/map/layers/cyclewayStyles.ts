import type { ExpressionSpecification } from 'maplibre-gl';

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
export const TROTTOIR_DASHARRAY: [number, number] = [2, 2];

export const VOIE_VERTE_LINE_CAP = 'round' as const;
export const BUS_VELO_LINE_CAP = 'round' as const;
export const VELORUE_LINE_CAP = 'butt' as const;
export const TROTTOIR_LINE_CAP = 'butt' as const;

export const DSC_ARROW_SYMBOL_SPACING = 40;
export const DSC_ARROW_TEXT_SIZE = 16;

export const NORMAL_LINE_OPACITY = 0.9;

// Below this zoom the map is an overview: both sides of a street collapse into a single line
export const CYCLEWAY_DETAIL_ZOOM = 13.8;

export const GREENWAY_COLOR = '#237a45';
export const GREENWAY_LINE_WIDTH: ExpressionSpecification = [
	'interpolate',
	['exponential', 1.5],
	['zoom'],
	8,
	1,
	11,
	1.9,
	14,
	3,
	17,
	4.5,
];
export const GREENWAY_UNPAVED_DASHARRAY: [number, number] = [2, 1.3];
export const PEDESTRIAN_ZONE_LINE_WIDTH: ExpressionSpecification = [
	'interpolate',
	['linear'],
	['zoom'],
	8,
	0.6,
	11,
	1.2,
	14,
	2.2,
	17,
	3.2,
];
export const PEDESTRIAN_ZONE_DASHARRAY: [number, number] = [0, 2];

export const CHAUCIDOU_COLOR = '#6aa9d8';
export const CHAUCIDOU_DASHARRAY: [number, number] = [2, 1.6];

export const CONTRAFLOW_COLOR = '#73b3e0';
