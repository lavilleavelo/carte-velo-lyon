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
