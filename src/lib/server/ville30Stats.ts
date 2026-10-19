import type { FeatureCollection } from 'geojson';
import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
import { computeVille30Stats, type Ville30Stats } from '$lib/utils/speedLimits';
import { getCachedGrandLyonData } from '$lib/server/cache';
import { getCommuneBoundary } from '$lib/server/communeBoundary';

let cachedAllData: FeatureCollection | null = null;
let cachedAllPromise: Promise<FeatureCollection> | null = null;
const statsCache = new Map<string, Ville30Stats | null>();

async function getSpeedLimitsData(): Promise<FeatureCollection> {
	if (cachedAllData) {
		return cachedAllData;
	}

	if (cachedAllPromise) {
		return cachedAllPromise;
	}

	cachedAllPromise = (async () => {
		const raw = (await getCachedGrandLyonData('speedLimits')) as FeatureCollection;
		cachedAllData = raw;
		return raw;
	})();

	return cachedAllPromise;
}

export async function getVille30StatsForCommune(insee: string): Promise<Ville30Stats | null> {
	if (statsCache.has(insee)) {
		return statsCache.get(insee) ?? null;
	}

	const boundary = getCommuneBoundary(insee);
	if (!boundary) {
		statsCache.set(insee, null);
		return null;
	}

	try {
		const data = await getSpeedLimitsData();
		const inside = filterFeaturesInsideBoundary(data, boundary);
		const stats = computeVille30Stats(inside.features);
		statsCache.set(insee, stats);
		return stats;
	} catch (error) {
		console.error(`Failed to compute Ville 30 stats for INSEE ${insee}:`, error);
		statsCache.set(insee, null);
		return null;
	}
}

/** Number of streets lying inside the commune, per `insee1` code of the street data. */
export async function countStreetInseesInCommune(insee: string): Promise<Map<string, number>> {
	const counts = new Map<string, number>();
	const boundary = getCommuneBoundary(insee);
	if (!boundary) {
		return counts;
	}

	const data = await getSpeedLimitsData();
	for (const feature of filterFeaturesInsideBoundary(data, boundary).features) {
		const code = feature.properties?.insee1;
		if (typeof code === 'string' && code) {
			counts.set(code, (counts.get(code) ?? 0) + 1);
		}
	}

	return counts;
}
