import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const store = new Map<string, unknown>();
const fetchers = new Map<string, () => Promise<unknown>>();
const lastFetched = new Map<string, number>();
const inflight = new Map<string, Promise<unknown>>();

const CACHE_DIR = process.env.CACHE_DIR ?? '.cache';
const TTL_MS = 5 * 60 * 1000;
let cacheDirReady: Promise<void> | null = null;

function isStale(key: string): boolean {
	const ts = lastFetched.get(key);
	return ts === undefined || Date.now() - ts > TTL_MS;
}

function ensureCacheDir(): Promise<void> {
	if (!cacheDirReady) {
		cacheDirReady = mkdir(CACHE_DIR, { recursive: true }).then(() => undefined);
	}
	return cacheDirReady;
}

function cacheFilePath(key: string): string {
	return join(CACHE_DIR, `${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
}

async function persistEntry(key: string, data: unknown): Promise<void> {
	try {
		await ensureCacheDir();
		const path = cacheFilePath(key);
		const tmp = `${path}.tmp`;
		await writeFile(tmp, JSON.stringify(data));
		await rename(tmp, path);
	} catch (error) {
		console.error(`[cache] failed to persist "${key}" to disk:`, error);
	}
}

async function loadFromDisk(key: string): Promise<unknown | undefined> {
	try {
		const raw = await readFile(cacheFilePath(key), 'utf8');
		return JSON.parse(raw);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
			console.error(`[cache] failed to read "${key}" from disk:`, error);
		}
		return undefined;
	}
}

function fetchAndStore(key: string): Promise<unknown> {
	const existing = inflight.get(key);
	if (existing) {
		return existing;
	}

	const fetcher = fetchers.get(key);

	if (!fetcher) {
		return Promise.reject(new Error(`[cache] no fetcher registered for "${key}"`));
	}

	const promise = (async () => {
		try {
			const data = await fetcher();
			store.set(key, data);
			lastFetched.set(key, Date.now());
			await persistEntry(key, data);
			return data;
		} finally {
			inflight.delete(key);
		}
	})();

	inflight.set(key, promise);
	return promise;
}

function refreshInBackground(key: string): void {
	if (inflight.has(key)) {
		return;
	}

	fetchAndStore(key).catch((error) => {
		console.error(`[cache] background refresh failed for "${key}":`, error);
	});
}

function registerEntry(key: string, fetcher: () => Promise<unknown>): void {
	fetchers.set(key, fetcher);
}

async function getCached<T>(key: string): Promise<T> {
	const cached = store.get(key);
	if (cached !== undefined) {
		if (isStale(key)) {
			refreshInBackground(key);
		}

		return cached as T;
	}
	const fromDisk = await loadFromDisk(key);
	if (fromDisk !== undefined) {
		store.set(key, fromDisk);
		refreshInBackground(key);
		return fromDisk as T;
	}
	try {
		return (await fetchAndStore(key)) as T;
	} catch (error) {
		const fallback = await loadFromDisk(key);
		if (fallback !== undefined) {
			console.warn(`[cache] upstream fetch failed for "${key}", serving stale disk copy`);
			store.set(key, fallback);
			return fallback as T;
		}
		throw error;
	}
}

// Background refresh: every ~5min (with random jitter) re-fetch all populated entries
const REFRESH_BASE_MS = 5 * 60 * 1000;
const REFRESH_JITTER_MS = 60 * 1000;

function scheduleNextRefresh(): void {
	const delay = REFRESH_BASE_MS + Math.random() * REFRESH_JITTER_MS;
	setTimeout(async () => {
		const keys = [...store.keys()];
		for (const key of keys) {
			if (!isStale(key)) {
				continue;
			}

			refreshInBackground(key);
			await new Promise((r) => setTimeout(r, 1000 + Math.random() * 4000));
		}
		scheduleNextRefresh();
	}, delay);
}

scheduleNextRefresh();

// --- Data source definitions ---

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
	speedLimits:
		'https://data.grandlyon.com/geoserver/metropole-de-lyon/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=metropole-de-lyon:pvo_patrimoine_voirie.pvochausseetrottoir&outputFormat=application/json&SRSNAME=EPSG:4171&sortBy=gid',
} as const;

export type GrandLyonDataType = keyof typeof GRAND_LYON_URLS;
export { GRAND_LYON_URLS };

for (const type of Object.keys(GRAND_LYON_URLS) as GrandLyonDataType[]) {
	registerEntry(`grandlyon:${type}`, async () => {
		const url = GRAND_LYON_URLS[type];
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch ${type} data: ${response.statusText}`);
		}
		return response.json();
	});
}

export async function getCachedGrandLyonData(type: GrandLyonDataType): Promise<unknown> {
	return getCached(`grandlyon:${type}`);
}

// Voies Lyonnaises

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

registerEntry('voiesLyonnaises', fetchAllVoiesLyonnaises);

export async function getCachedVoiesLyonnaisesData(): Promise<Record<number, any>> {
	return getCached<Record<number, any>>('voiesLyonnaises');
}

// Overpass queries

const OVERPASS_BBOX = '45.55,4.6,45.95,5.1';

function overpassFetcher(query: string): () => Promise<unknown> {
	return async () => {
		const response = await fetch('https://overpass-api.de/api/interpreter', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: '*/*',
				'User-Agent': 'carte-velo-lyon/1.0 (+https://github.com/hverlin/carte-velo-lyon)',
			},
			body: `data=${encodeURIComponent(query)}`,
		});
		if (!response.ok) {
			throw new Error(`Failed to fetch Overpass data: ${response.statusText}`);
		}
		return response.json();
	};
}

const OVERPASS_VL_QUERY = `[out:json];nwr["cycle_network"="Les Voies Lyonnaises"](${OVERPASS_BBOX});out geom;`;
registerEntry('overpassVL', overpassFetcher(OVERPASS_VL_QUERY));

export async function getCachedOverpassVLData(): Promise<unknown> {
	return getCached('overpassVL');
}

const CYCLEWAY_TYPES =
	'^(lane|track|share_busway|shared_busway|opposite|opposite_lane|opposite_track)$';

const OVERPASS_CYCLEWAYS_QUERY = [
	`[out:json][timeout:180];`,
	`(`,
	// Dedicated cycleways and bicycle-priority streets
	`  way["highway"="cycleway"](${OVERPASS_BBOX});`,
	`  way["bicycle_road"="yes"](${OVERPASS_BBOX});`,
	`  way["cyclestreet"="yes"](${OVERPASS_BBOX});`,
	// Roads with cycleway infrastructure on the carriageway
	`  way["cycleway"~"${CYCLEWAY_TYPES}"](${OVERPASS_BBOX});`,
	`  way["cycleway:left"~"${CYCLEWAY_TYPES}"](${OVERPASS_BBOX});`,
	`  way["cycleway:right"~"${CYCLEWAY_TYPES}"](${OVERPASS_BBOX});`,
	`  way["cycleway:both"~"${CYCLEWAY_TYPES}"](${OVERPASS_BBOX});`,
	// Paths and pedestrian areas where bicycles are allowed
	`  way["highway"="path"]["bicycle"="designated"](${OVERPASS_BBOX});`,
	`  way["highway"="pedestrian"]["bicycle"~"^(yes|designated)$"](${OVERPASS_BBOX});`,
	`  way["highway"~"^(service|track|unclassified)$"]["bicycle"="designated"](${OVERPASS_BBOX});`,
	// Living streets and contraflow cycling
	`  way["highway"="living_street"](${OVERPASS_BBOX});`,
	`  way["oneway:bicycle"="no"]["oneway"="yes"](${OVERPASS_BBOX});`,
	`);`,
	`out geom;`,
].join('\n');
registerEntry('overpassCycleways', overpassFetcher(OVERPASS_CYCLEWAYS_QUERY));

export async function getCachedOverpassCyclewaysData(): Promise<unknown> {
	return getCached('overpassCycleways');
}

const OVERPASS_TOILETS_QUERY = `[out:json][timeout:60];(node["amenity"="toilets"](${OVERPASS_BBOX});way["amenity"="toilets"](${OVERPASS_BBOX});relation["amenity"="toilets"](${OVERPASS_BBOX}););out center;`;
registerEntry('overpassToilets', overpassFetcher(OVERPASS_TOILETS_QUERY));

export async function getCachedOverpassToiletsData(): Promise<unknown> {
	return getCached('overpassToilets');
}

const OVERPASS_SCHOOLS_QUERY = `[out:json][timeout:60];(node["amenity"="kindergarten"](${OVERPASS_BBOX});way["amenity"="kindergarten"](${OVERPASS_BBOX});relation["amenity"="kindergarten"](${OVERPASS_BBOX});node["amenity"="school"](${OVERPASS_BBOX});way["amenity"="school"](${OVERPASS_BBOX});relation["amenity"="school"](${OVERPASS_BBOX}););out center;`;
registerEntry('overpassSchools', overpassFetcher(OVERPASS_SCHOOLS_QUERY));

export async function getCachedOverpassSchoolsData(): Promise<unknown> {
	return getCached('overpassSchools');
}

const OVERPASS_POIS_QUERY = `[out:json][timeout:90];(node["shop"="bicycle"](${OVERPASS_BBOX});way["shop"="bicycle"](${OVERPASS_BBOX});node["amenity"="bicycle_repair_station"](${OVERPASS_BBOX});way["amenity"="bicycle_repair_station"](${OVERPASS_BBOX});node["amenity"="bicycle_rental"](${OVERPASS_BBOX});way["amenity"="bicycle_rental"](${OVERPASS_BBOX});node["club"="bicycle"](${OVERPASS_BBOX});way["club"="bicycle"](${OVERPASS_BBOX});node["amenity"="bench"](${OVERPASS_BBOX});node["leisure"="picnic_table"](${OVERPASS_BBOX});node["amenity"="pharmacy"](${OVERPASS_BBOX});way["amenity"="pharmacy"](${OVERPASS_BBOX});node["emergency"="defibrillator"](${OVERPASS_BBOX}););out center;`;
registerEntry('overpassPOIs', overpassFetcher(OVERPASS_POIS_QUERY));

export async function getCachedOverpassPOIsData(): Promise<unknown> {
	return getCached('overpassPOIs');
}

// One-way streets — limited to drivable highway classes so we can render arrows
// at lower zooms (z11+) than the OpenMapTiles vector layer allows (z14+).
const ONEWAY_HIGHWAY_TYPES =
	'^(motorway|trunk|primary|secondary|tertiary|primary_link|secondary_link|tertiary_link)$';
const OVERPASS_ONEWAYS_QUERY = [
	`[out:json][timeout:120];`,
	`(`,
	`  way["highway"~"${ONEWAY_HIGHWAY_TYPES}"]["oneway"="yes"](${OVERPASS_BBOX});`,
	`  way["highway"~"${ONEWAY_HIGHWAY_TYPES}"]["oneway"="-1"](${OVERPASS_BBOX});`,
	`);`,
	`out geom;`,
].join('\n');
registerEntry('overpassOneways', overpassFetcher(OVERPASS_ONEWAYS_QUERY));

export async function getCachedOverpassOnewaysData(): Promise<unknown> {
	return getCached('overpassOneways');
}

// Counters
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

registerEntry('counters', fetchAllCounters);

export async function getCachedCountersData(): Promise<{ velo: unknown[]; voiture: unknown[] }> {
	return getCached<{ velo: unknown[]; voiture: unknown[] }>('counters');
}
