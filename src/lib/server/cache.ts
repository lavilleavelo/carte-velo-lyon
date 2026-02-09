import { createCache } from 'async-cache-dedupe';

const cache = createCache({
	ttl: 60,
	stale: 60,
	storage: { type: 'memory' },
});

const GRAND_LYON_URLS = {
	tram: 'https://data.grandlyon.com/geoserver/sytral/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=sytral:tcl_sytral.tcllignetram_2_0_0&outputFormat=application/json&SRSNAME=EPSG:4171&sortBy=gid',
	metro:
		'https://data.grandlyon.com/geoserver/sytral/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=sytral:tcl_sytral.tcllignemf_2_0_0&outputFormat=application/json&SRSNAME=EPSG:4171&sortBy=gid',
	bus: 'https://data.grandlyon.com/geoserver/sytral/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=sytral:tcl_sytral.tcllignebus_2_0_0&outputFormat=application/json&SRSNAME=EPSG:4171&sortBy=gid',
	parking:
		'https://data.grandlyon.com/geoserver/metropole-de-lyon/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=metropole-de-lyon:pvo_patrimoine_voirie.pvostationnementvelo&outputFormat=application/json&SRSNAME=EPSG:4171&sortBy=gid',
	pumps:
		'https://data.grandlyon.com/geoserver/metropole-de-lyon/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=metropole-de-lyon:pvo_patrimoine_voirie.pvostationvelovpompe&outputFormat=application/json&SRSNAME=EPSG:4171&sortBy=gid',
	fountains:
		'https://data.grandlyon.com/geoserver/metropole-de-lyon/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=metropole-de-lyon:adr_voie_lieu.adrbornefontaine_latest&outputFormat=application/json&SRSNAME=EPSG:4171&sortBy=gid',
	velov:
		'https://data.grandlyon.com/fr/datapusher/ws/rdata/jcd_jcdecaux.jcdvelov/all.json?maxfeatures=1000&start=1',
} as const;

export type GrandLyonDataType = keyof typeof GRAND_LYON_URLS;

async function fetchGrandLyonData(type: GrandLyonDataType): Promise<unknown> {
	const url = GRAND_LYON_URLS[type];
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${type} data: ${response.statusText}`);
	}
	return response.json();
}

cache.define('grandLyonData', async (type: GrandLyonDataType) => {
	return fetchGrandLyonData(type);
});

interface GrandLyonCache {
	grandLyonData: (type: GrandLyonDataType) => Promise<unknown>;
}

const typedCache = cache as unknown as GrandLyonCache;

export async function getCachedGrandLyonData(type: GrandLyonDataType): Promise<unknown> {
	return typedCache.grandLyonData(type);
}

export { GRAND_LYON_URLS };

async function fetchVoieLyonnaise(lineNumber: number) {
	const url = `https://raw.githubusercontent.com/lavilleavelo/cyclopolis/refs/heads/main/content/voies-cyclables/ligne-${lineNumber}.json`;
	try {
		const response = await fetch(url);
		if (!response.ok) {
			console.error(`Failed to fetch VL ${lineNumber}: ${response.statusText}`);
			return null;
		}
		return await response.json();
	} catch (error) {
		console.error(`Error fetching VL ${lineNumber}:`, error);
		return null;
	}
}

async function fetchAllVoiesLyonnaises(): Promise<Record<number, any>> {
	const vlPromises = Array.from({ length: 12 }, (_, i) => fetchVoieLyonnaise(i + 1));
	const vlData = await Promise.all(vlPromises);

	return vlData.reduce(
		(acc, data, index) => {
			if (data) {
				acc[index + 1] = data;
			}
			return acc;
		},
		{} as Record<number, any>,
	);
}

const vlCache = createCache({
	ttl: 300,
	stale: 300,
	storage: { type: 'memory' },
});

vlCache.define('voiesLyonnaises', async () => {
	return fetchAllVoiesLyonnaises();
});

interface VLCache {
	voiesLyonnaises: () => Promise<Record<number, any>>;
}

const typedVlCache = vlCache as unknown as VLCache;

export async function getCachedVoiesLyonnaisesData(): Promise<Record<number, any>> {
	return typedVlCache.voiesLyonnaises();
}
