import type { VelovChanceLevel } from './velovForecast';

export const VELOV_PALETTE_IDS = ['classique', 'daltonien'] as const;

export type VelovPaletteId = (typeof VELOV_PALETTE_IDS)[number];

export const VELOV_DEFAULT_PALETTE: VelovPaletteId = 'classique';

export type VelovBikeColors = {
	fill: string;
	text: string;
	tint: string;
	border: string;
};

export type VelovPalette = {
	mech: VelovBikeColors;
	elec: VelovBikeColors;
	mapLabel: { bikes: string; stands: string };
	chance: Record<VelovChanceLevel, string>;
};

export const VELOV_PALETTES: Record<VelovPaletteId, VelovPalette> = {
	classique: {
		mech: { fill: '#dc2626', text: '#b91c1c', tint: '#fef2f2', border: '#fee2e2' },
		elec: { fill: '#00a676', text: '#047857', tint: '#ecfdf5', border: '#d1fae5' },
		mapLabel: { bikes: '#b91c1c', stands: '#1d4ed8' },
		chance: {
			'near-certain': '#15803d',
			likely: '#4ade80',
			uncertain: '#f59e0b',
			unlikely: '#ffffff',
		},
	},
	daltonien: {
		mech: { fill: '#ea580c', text: '#c2410c', tint: '#fff7ed', border: '#ffedd5' },
		elec: { fill: '#1d4ed8', text: '#1d4ed8', tint: '#eff6ff', border: '#dbeafe' },
		mapLabel: { bikes: '#4b5563', stands: '#4b5563' },
		chance: {
			'near-certain': '#1d4ed8',
			likely: '#60a5fa',
			uncertain: '#f59e0b',
			unlikely: '#ffffff',
		},
	},
};

export function isVelovPaletteId(value: unknown): value is VelovPaletteId {
	return VELOV_PALETTE_IDS.includes(value as VelovPaletteId);
}
