import type { FeatureCollection } from 'geojson';
import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
import { featureLineLengthMeters } from '$lib/utils/geoLength';
import { osmFeatureToLegendId } from '$lib/utils/cyclewayLegend';
import { overpassToGeoJSON } from '$lib/utils/osmCycleway';
import { getCachedOverpassCyclewaysData } from '$lib/server/cache';
import { getCommuneBoundary } from '$lib/server/communeBoundary';

let cachedOsmGeoJSON: FeatureCollection | null = null;
let cachedOsmSource: unknown = null;
const lengthCache = new Map<string, number | null>();

async function getOsmCyclewaysGeoJSON(): Promise<FeatureCollection> {
	const raw = await getCachedOverpassCyclewaysData();
	if (raw !== cachedOsmSource || !cachedOsmGeoJSON) {
		cachedOsmSource = raw;
		cachedOsmGeoJSON = overpassToGeoJSON(raw);
		lengthCache.clear();
	}
	return cachedOsmGeoJSON;
}

export async function getCommuneOsmCyclewaysKm(insee: string): Promise<number | null> {
	if (lengthCache.has(insee)) {
		return lengthCache.get(insee) ?? null;
	}

	const boundary = getCommuneBoundary(insee);
	if (!boundary) {
		lengthCache.set(insee, null);
		return null;
	}

	try {
		const osm = await getOsmCyclewaysGeoJSON();
		const inside = filterFeaturesInsideBoundary(osm, boundary);
		let totalMeters = 0;
		for (const f of inside.features) {
			const id = osmFeatureToLegendId(f.properties);
			if (!id) {
				continue;
			}
			totalMeters += featureLineLengthMeters(f);
		}
		const km = totalMeters / 1000;
		lengthCache.set(insee, km);
		return km;
	} catch (error) {
		console.error(`Failed to compute OSM cycleways km for INSEE ${insee}:`, error);
		lengthCache.set(insee, null);
		return null;
	}
}
