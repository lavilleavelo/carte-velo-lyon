import { createCache } from 'async-cache-dedupe';

const cache = createCache({
	ttl: 300,
	stale: 300,
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
	voirie:
		'https://data.grandlyon.com/geoserver/metropole-de-lyon/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=metropole-de-lyon:pvo_patrimoine_voirie.pvoamenagementcyclable&outputFormat=application/json&SRSNAME=EPSG:4171&sortBy=gid',
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

const OVERPASS_BBOX = '45.55,4.6,45.95,5.1';
const OVERPASS_QUERY = `[out:json];nwr["cycle_network"="Les Voies Lyonnaises"](${OVERPASS_BBOX});out geom;`;
const OVERPASS_URL = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(OVERPASS_QUERY)}`;

async function fetchOverpassVL(): Promise<unknown> {
	const response = await fetch(OVERPASS_URL);
	if (!response.ok) {
		throw new Error(`Failed to fetch Overpass data: ${response.statusText}`);
	}
	return response.json();
}

const overpassCache = createCache({
	ttl: 300,
	stale: 300,
	storage: { type: 'memory' },
});

overpassCache.define('overpassVL', async () => {
	return fetchOverpassVL();
});

interface OverpassCache {
	overpassVL: () => Promise<unknown>;
}

const typedOverpassCache = overpassCache as unknown as OverpassCache;

export async function getCachedOverpassVLData(): Promise<unknown> {
	return typedOverpassCache.overpassVL();
}

const COUNTERS_BASE_URL =
	'https://raw.githubusercontent.com/lavilleavelo/cyclopolis/refs/heads/main/content/compteurs';

async function fetchCounterFile(type: 'velo' | 'voiture', slug: string): Promise<unknown | null> {
	const url = `${COUNTERS_BASE_URL}/${type}/${slug}.json`;
	try {
		const response = await fetch(url);
		if (!response.ok) return null;
		const data = await response.json();
		return { ...data, slug };
	} catch {
		return null;
	}
}

async function fetchCounterDirectory(type: 'velo' | 'voiture'): Promise<string[]> {
	const url = `https://api.github.com/repos/lavilleavelo/cyclopolis/contents/content/compteurs/${type}`;
	try {
		const response = await fetch(url, {
			headers: { Accept: 'application/vnd.github.v3+json' },
		});
		if (!response.ok) return [];
		const files = (await response.json()) as { name: string }[];
		return files.filter((f) => f.name.endsWith('.json')).map((f) => f.name.replace('.json', ''));
	} catch {
		return [];
	}
}

async function fetchAllCounters(): Promise<{ velo: unknown[]; voiture: unknown[] }> {
	const [veloSlugs, voitureSlugs] = await Promise.all([
		fetchCounterDirectory('velo'),
		fetchCounterDirectory('voiture'),
	]);

	const [veloData, voitureData] = await Promise.all([
		Promise.all(veloSlugs.map((slug) => fetchCounterFile('velo', slug))),
		Promise.all(voitureSlugs.map((slug) => fetchCounterFile('voiture', slug))),
	]);

	return {
		velo: veloData.filter(Boolean),
		voiture: voitureData.filter(Boolean),
	};
}

const countersCache = createCache({
	ttl: 300,
	stale: 300,
	storage: { type: 'memory' },
});

countersCache.define('counters', async () => {
	return fetchAllCounters();
});

interface CountersCache {
	counters: () => Promise<{ velo: unknown[]; voiture: unknown[] }>;
}

const typedCountersCache = countersCache as unknown as CountersCache;

export async function getCachedCountersData(): Promise<{ velo: unknown[]; voiture: unknown[] }> {
	return typedCountersCache.counters();
}
