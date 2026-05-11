import { type LabelCategory } from '$lib/components/map/labels/labelLayers';

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
