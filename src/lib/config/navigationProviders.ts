export interface NavigationProvider {
	id: string;
	label: string;
	shortLabel: string;
	url: (lat: number, lng: number) => string;
	nativeUrl?: (lat: number, lng: number) => string;
}

function isMobile(): boolean {
	if (typeof navigator === 'undefined') return false;
	return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function getProviderUrl(provider: NavigationProvider, lat: number, lng: number): string {
	if (isMobile() && provider.nativeUrl) {
		return provider.nativeUrl(lat, lng);
	}
	return provider.url(lat, lng);
}

export const navigationProviders: NavigationProvider[] = [
	{
		id: 'geo',
		label: 'Application par défaut',
		shortLabel: 'Carte',
		url: (lat, lng) => `geo:${lat},${lng}?z=17`,
		nativeUrl: (lat, lng) => `geo:${lat},${lng}?z=17`,
	},
	{
		id: 'osm',
		label: 'OpenStreetMap',
		shortLabel: 'OSM',
		url: (lat, lng) =>
			`https://www.openstreetmap.org/query?lat=${lat}&lon=${lng}&mlat=${lat}&mlon=${lng}#map=19/${lat}/${lng}`,
	},
	{
		id: 'cartes',
		label: 'Cartes.app',
		shortLabel: 'Cartes.app',
		url: (lat, lng) =>
			`https://cartes.app/?sports=oui-bicycle&terrain=non&clic=${lat}%7C${lng}#16.77/${lat}/${lng}`,
	},
	{
		id: 'google',
		label: 'Google Maps',
		shortLabel: 'Maps',
		url: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}&z=17`,
	},
	{
		id: 'geovelo',
		label: 'Geovelo',
		shortLabel: 'Geovelo',
		url: (lat, lng) => `https://www.geovelo.fr/lyon/route?to=${lng},${lat}`,
	},
	{
		id: 'osmand',
		label: 'OsmAnd',
		shortLabel: 'OsmAnd',
		url: (lat, lng) => `https://osmand.net/map?pin=${lat},${lng}&z=17`,
	},
	{
		id: 'organicmaps',
		label: 'Organic Maps',
		shortLabel: 'Organic',
		url: (lat, lng) => `https://omaps.app/?ll=${lat},${lng}&z=17`,
	},
	{
		id: 'comaps',
		label: 'Comaps',
		shortLabel: 'Comaps',
		url: (lat, lng) => `https://comaps.app/?ll=${lat},${lng}&z=17`,
		nativeUrl: (lat, lng) => `cm://map?v=1&ll=${lat},${lng}&z=17`,
	},
	{
		id: 'waze',
		label: 'Waze',
		shortLabel: 'Waze',
		url: (lat, lng) => `https://waze.com/ul?ll=${lat},${lng}&z=17`,
	},
	{
		id: 'apple',
		label: 'Apple Plans',
		shortLabel: 'Apple',
		url: (lat, lng) => `https://maps.apple.com/?ll=${lat},${lng}&z=17`,
	},
];

const STORAGE_KEY = 'defaultNavProvider';

export function loadDefaultProvider(): string {
	if (typeof globalThis.localStorage === 'undefined') {
		return 'osm';
	}

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored && navigationProviders.some((p) => p.id === stored)) return stored;
	} catch {}
	return 'osm';
}

export function saveDefaultProvider(id: string) {
	if (typeof globalThis.localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, id);
	} catch {}
}

export function getProvider(id: string): NavigationProvider {
	return navigationProviders.find((p) => p.id === id) ?? navigationProviders[0];
}
