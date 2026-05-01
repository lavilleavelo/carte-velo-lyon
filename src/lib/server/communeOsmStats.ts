import type { FeatureCollection } from 'geojson';
import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
import { featureLineLengthMeters } from '$lib/utils/geoLength';
import { osmFeatureToLegendId } from '$lib/utils/cyclewayLegend';
import { isPavedSurface, overpassToGeoJSON } from '$lib/utils/osmCycleway';
import { getCachedOverpassCyclewaysData } from '$lib/server/cache';
import { getCommuneBoundary } from '$lib/server/communeBoundary';

let cachedOsmGeoJSON: FeatureCollection | null = null;
let cachedOsmSource: unknown = null;
const lengthCache = new Map<string, number | null>();
const safetyCache = new Map<string, OsmSafetyStats | null>();

export interface OsmSafetyStats {
	totalKm: number;
	safeKm: number;
	safeNoVoieVerteKm: number;
	voieVerteKm: number;
	voieVerteUnstableKm: number;
	safePct: number;
	safeNoVoieVertePct: number;
	voieVerteUnstablePct: number;
}

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

export async function getCommuneOsmSafetyStats(insee: string): Promise<OsmSafetyStats | null> {
	if (safetyCache.has(insee)) {
		return safetyCache.get(insee) ?? null;
	}

	const boundary = getCommuneBoundary(insee);
	if (!boundary) {
		safetyCache.set(insee, null);
		return null;
	}

	try {
		const osm = await getOsmCyclewaysGeoJSON();
		const inside = filterFeaturesInsideBoundary(osm, boundary);

		const seen = new Set<string>();
		let total = 0;
		let safe = 0;
		let safeNoVoieVerte = 0;
		let voieVerte = 0;
		let voieVerteUnstable = 0;
		for (const f of inside.features) {
			const props = f.properties as Record<string, unknown> | null;
			const key = `${props?.osmId}:${props?.typeamenagement}`;
			if (seen.has(key)) {
				continue;
			}

			seen.add(key);
			const len = featureLineLengthMeters(f);
			const isSafe = Boolean(props?.isSafe);
			const isVoieVerte = props?.typeamenagement === 'Voie verte';
			total += len;

			if (isSafe) {
				safe += len;
				if (!isVoieVerte) safeNoVoieVerte += len;
			}

			if (isVoieVerte) {
				voieVerte += len;
				const surface = typeof props?.surface === 'string' ? props.surface : null;
				if (!isPavedSurface(surface)) voieVerteUnstable += len;
			}
		}

		const stats: OsmSafetyStats = {
			totalKm: total / 1000,
			safeKm: safe / 1000,
			safeNoVoieVerteKm: safeNoVoieVerte / 1000,
			voieVerteKm: voieVerte / 1000,
			voieVerteUnstableKm: voieVerteUnstable / 1000,
			safePct: total > 0 ? (safe / total) * 100 : 0,
			safeNoVoieVertePct: total > 0 ? (safeNoVoieVerte / total) * 100 : 0,
			voieVerteUnstablePct: voieVerte > 0 ? (voieVerteUnstable / voieVerte) * 100 : 0,
		};
		safetyCache.set(insee, stats);
		return stats;
	} catch (error) {
		console.error(`Failed to compute OSM safety stats for INSEE ${insee}:`, error);
		safetyCache.set(insee, null);
		return null;
	}
}
