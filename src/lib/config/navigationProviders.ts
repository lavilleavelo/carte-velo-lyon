export type OsmType = 'node' | 'way' | 'relation';

export interface PoiContext {
	name?: string;
	osmType?: OsmType;
	osmId?: number;
}

export interface NavigationProvider {
	id: string;
	label: string;
	shortLabel: string;
	url: (lat: number, lng: number, ctx?: PoiContext) => string;
	nativeUrl?: (lat: number, lng: number, ctx?: PoiContext) => string;
}

function isMobile(): boolean {
	if (typeof navigator === 'undefined') {
		return false;
	}

	return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function getProviderUrl(
	provider: NavigationProvider,
	lat: number,
	lng: number,
	ctx?: PoiContext,
): string {
	if (isMobile() && provider.nativeUrl) {
		return provider.nativeUrl(lat, lng, ctx);
	}

	return provider.url(lat, lng, ctx);
}

const OSM_TYPE_PREFIX: Record<OsmType, string> = {
	node: 'n',
	way: 'w',
	relation: 'r',
};

export function parseOsmId(value: string | undefined): PoiContext | undefined {
	if (!value) {
		return undefined;
	}

	const m = value.trim().match(/^(node|way|relation)[/\s]?(\d+)$/i);
	if (m)
		return {
			osmType: m[1].toLowerCase() as OsmType,
			osmId: Number(m[2]),
		};
	const short = value.trim().match(/^([nwr])(\d+)$/i);
	if (short) {
		const type =
			short[1].toLowerCase() === 'n' ? 'node' : short[1].toLowerCase() === 'w' ? 'way' : 'relation';
		return {
			osmType: type,
			osmId: Number(short[2]),
		};
	}
	return undefined;
}

export const navigationProviders: NavigationProvider[] = [
	{
		id: 'geo',
		label: 'Application par défaut',
		shortLabel: 'App par défaut',
		url: (lat, lng) => `geo:${lat},${lng}?z=17`,
		nativeUrl: (lat, lng) => `geo:${lat},${lng}?z=17`,
	},
	{
		id: 'osm',
		label: 'OpenStreetMap',
		shortLabel: 'OSM',
		url: (lat, lng, ctx) => {
			if (ctx?.osmType && ctx.osmId) {
				return `https://www.openstreetmap.org/${ctx.osmType}/${ctx.osmId}`;
			}
			return `https://www.openstreetmap.org/query?lat=${lat}&lon=${lng}&mlat=${lat}&mlon=${lng}#map=19/${lat}/${lng}`;
		},
	},
	{
		id: 'cartes',
		label: 'Cartes.app',
		shortLabel: 'Cartes.app',
		url: (lat, lng, ctx) => {
			if (ctx?.osmType && ctx.osmId && ctx.name) {
				const prefix = OSM_TYPE_PREFIX[ctx.osmType];
				const allez = `${ctx.name}|${prefix}${ctx.osmId}|${lng}|${lat}`;
				return `https://cartes.app/?allez=${encodeURIComponent(allez)}`;
			}
			return `https://cartes.app/?sports=oui-bicycle&terrain=non&clic=${lat}%7C${lng}#16.77/${lat}/${lng}`;
		},
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
		id: 'comaps',
		label: 'Comaps',
		shortLabel: 'Comaps',
		url: (lat, lng) => `https://comaps.app/?ll=${lat},${lng}&z=17`,
		nativeUrl: (lat, lng) => `cm://map?v=1&ll=${lat},${lng}&z=17`,
	},
	{
		id: 'google',
		label: 'Google Maps',
		shortLabel: 'Maps',
		url: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}&z=17`,
	},
	{
		id: 'apple',
		label: 'Apple Plans',
		shortLabel: 'Apple',
		url: (lat, lng) => `https://maps.apple.com/?ll=${lat},${lng}&z=17`,
	},
	{
		id: 'waze',
		label: 'Waze',
		shortLabel: 'Waze',
		url: (lat, lng) => `https://waze.com/ul?ll=${lat},${lng}&z=17`,
	},
];

const STORAGE_KEY = 'defaultNavProvider';

export function loadDefaultProvider(): string {
	if (typeof globalThis.localStorage === 'undefined') {
		return 'cartes';
	}

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored && navigationProviders.some((p) => p.id === stored)) {
			return stored;
		}
	} catch {}

	return 'cartes';
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
