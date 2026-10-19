import type { Feature, FeatureCollection } from 'geojson';
import { getCachedGrandLyonData } from '$lib/server/cache';

/** Properties the maps need; the full attribute set is fetched per street on demand. */
const SLIM_PROPERTIES = [
	'gid',
	'limitationvitesse',
	'nomvoie1',
	'nomvoie2',
	'insee1',
	'insee2',
	'reglementationzca',
	'longueurcalculee',
] as const;

const slimCache = new WeakMap<FeatureCollection, { data: FeatureCollection; json: string }>();
const propertiesByGidCache = new WeakMap<FeatureCollection, Map<number, Record<string, unknown>>>();

function slimFeature(feature: Feature): Feature {
	const props = (feature.properties ?? {}) as Record<string, unknown>;
	const properties: Record<string, unknown> = {};
	for (const key of SLIM_PROPERTIES) {
		const value = props[key];
		if (value !== null && value !== undefined && value !== '') {
			properties[key] = value;
		}
	}

	// Coordinates are kept as is: streets often share vertices with commune limits, and
	// rounding them changes which side of a limit they fall on (and the per-commune stats).
	return { type: 'Feature', geometry: feature.geometry, properties };
}

async function getRawSpeedLimits(): Promise<FeatureCollection> {
	return (await getCachedGrandLyonData('speedLimits')) as FeatureCollection;
}

async function getSlim(): Promise<{ data: FeatureCollection; json: string }> {
	const raw = await getRawSpeedLimits();
	let slim = slimCache.get(raw);
	if (!slim) {
		const data: FeatureCollection = {
			type: 'FeatureCollection',
			features: raw.features.map(slimFeature),
		};
		slim = { data, json: JSON.stringify(data) };
		slimCache.set(raw, slim);
	}

	return slim;
}

/** Speed limits with only the properties used by the maps. */
export async function getSlimSpeedLimits(): Promise<FeatureCollection> {
	return (await getSlim()).data;
}

/** Same as `getSlimSpeedLimits`, already serialized (computed once per upstream refresh). */
export async function getSlimSpeedLimitsJson(): Promise<string> {
	return (await getSlim()).json;
}

/** Full attribute set of one street segment, by its `gid`. */
export async function getSpeedLimitProperties(
	gid: number,
): Promise<Record<string, unknown> | null> {
	const raw = await getRawSpeedLimits();
	let byGid = propertiesByGidCache.get(raw);
	if (!byGid) {
		byGid = new Map();
		for (const feature of raw.features) {
			const props = (feature.properties ?? {}) as Record<string, unknown>;
			if (typeof props.gid === 'number') {
				byGid.set(props.gid, props);
			}
		}
		propertiesByGidCache.set(raw, byGid);
	}

	return byGid.get(gid) ?? null;
}
