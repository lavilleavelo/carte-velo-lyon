import { type LabelCategory } from '$lib/components/map/labels/labelLayers';
import {
	VELOV_DEFAULT_PALETTE,
	VELOV_PALETTES,
	isVelovPaletteId,
	type VelovPaletteId,
} from '$lib/utils/velovPalette';

function safeGetItem(key: string): string | null {
	if (typeof globalThis.localStorage === 'undefined') return null;
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function safeSetItem(key: string, value: string) {
	if (typeof globalThis.localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, value);
	} catch {
		// ignore
	}
}

const DESKTOP_SIDEBAR_KEY = 'desktopSidebarOpen';
const DESKTOP_SIDEBAR_DEFAULT = false;

export function loadDesktopSidebarOpen(): boolean {
	const stored = safeGetItem(DESKTOP_SIDEBAR_KEY);
	if (stored === 'true') return true;
	if (stored === 'false') return false;
	return DESKTOP_SIDEBAR_DEFAULT;
}

export function saveDesktopSidebarOpen(open: boolean) {
	safeSetItem(DESKTOP_SIDEBAR_KEY, String(open));
}

export type LabelVisibility = Record<LabelCategory, boolean>;

const AUTO_3D_KEY = 'auto3DLayersOnPitch';
const AUTO_3D_DEFAULT = true;

export function loadAuto3DLayers(): boolean {
	const stored = safeGetItem(AUTO_3D_KEY);
	if (stored === 'true') return true;
	if (stored === 'false') return false;
	return AUTO_3D_DEFAULT;
}

export function saveAuto3DLayers(on: boolean) {
	safeSetItem(AUTO_3D_KEY, String(on));
}

const VELOV_PALETTE_KEY = 'velovPalette';

export function loadVelovPalette(): VelovPaletteId {
	const stored = safeGetItem(VELOV_PALETTE_KEY);
	return isVelovPaletteId(stored) ? stored : VELOV_DEFAULT_PALETTE;
}

export function saveVelovPalette(id: VelovPaletteId) {
	safeSetItem(VELOV_PALETTE_KEY, id);
}

let velovPaletteId = $state(loadVelovPalette());

export const velovPalettePreference = {
	get id(): VelovPaletteId {
		return velovPaletteId;
	},
	set id(id: VelovPaletteId) {
		velovPaletteId = id;
		saveVelovPalette(id);
	},
	get colors() {
		return VELOV_PALETTES[velovPaletteId];
	},
};
