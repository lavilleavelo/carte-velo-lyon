import type { FeatureCollection } from 'geojson';
import { getFiche, getAllFiches, type Fiche, type FicheType } from './fiches';

const rawGeojsonModules = import.meta.glob<string>('./fiches/*.geojson', {
	query: '?raw',
	import: 'default',
	eager: true,
});

const geojsonByBasename = new Map<string, string>();
for (const [path, raw] of Object.entries(rawGeojsonModules)) {
	const basename = path
		.split('/')
		.pop()!
		.replace(/\.geojson$/, '');
	geojsonByBasename.set(basename, raw);
}

export function getFicheGeometryRaw(fiche: Fiche): string | null {
	return geojsonByBasename.get(fiche.basename) ?? null;
}

export function getFicheGeometry(fiche: Fiche): FeatureCollection | null {
	const raw = getFicheGeometryRaw(fiche);
	if (!raw) {
		return null;
	}

	return JSON.parse(raw) as FeatureCollection;
}

export function getFicheGeometryBySlug(slug: string): FeatureCollection | null {
	const fiche = getFiche(slug);
	if (!fiche) {
		return null;
	}
	return getFicheGeometry(fiche);
}

export function getMergedGeojsonForType(type: FicheType): FeatureCollection {
	const features: FeatureCollection['features'] = [];
	for (const fiche of getAllFiches()) {
		if (fiche.type !== type || !fiche.hasGeometry) {
			continue;
		}

		const fc = getFicheGeometry(fiche);
		if (!fc?.features?.length) {
			continue;
		}

		const decorations: Record<string, unknown> = {
			slug: fiche.slug,
			title: fiche.title,
			type: fiche.type,
		};

		if (fiche.type === 'itineraire') {
			if (fiche.ref) {
				decorations.ref = fiche.ref;
			}

			if (fiche.color) {
				decorations.color = fiche.color;
			}
		}

		for (const feature of fc.features) {
			features.push({
				...feature,
				properties: { ...(feature.properties ?? {}), ...decorations },
			});
		}
	}
	return { type: 'FeatureCollection', features };
}

function bbox4(): [number, number, number, number] {
	return [Infinity, Infinity, -Infinity, -Infinity];
}

function expand(bbox: [number, number, number, number], lng: number, lat: number) {
	if (lng < bbox[0]) bbox[0] = lng;
	if (lat < bbox[1]) bbox[1] = lat;
	if (lng > bbox[2]) bbox[2] = lng;
	if (lat > bbox[3]) bbox[3] = lat;
}

function haversine(lon1: number, lat1: number, lon2: number, lat2: number): number {
	const R = 6371000;
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

	return 2 * R * Math.asin(Math.sqrt(a));
}

function visitLine(
	coords: number[][],
	bbox: [number, number, number, number],
	totals: { meters: number },
) {
	for (let i = 0; i < coords.length; i++) {
		const [lng, lat] = coords[i];
		expand(bbox, lng, lat);
		if (i > 0) {
			totals.meters += haversine(coords[i - 1][0], coords[i - 1][1], lng, lat);
		}
	}
}

export interface GeometrySummary {
	bbox: [number, number, number, number];
	lengthKm: number;
}

export function summarizeFeatureCollection(fc: FeatureCollection): GeometrySummary | null {
	const bbox = bbox4();
	const totals = { meters: 0 };

	for (const feature of fc.features ?? []) {
		const g = feature.geometry;
		if (!g) continue;
		if (g.type === 'Point') {
			expand(bbox, g.coordinates[0], g.coordinates[1]);
		} else if (g.type === 'LineString') {
			visitLine(g.coordinates, bbox, totals);
		} else if (g.type === 'MultiLineString' || g.type === 'Polygon') {
			for (const line of g.coordinates) {
				visitLine(line, bbox, totals);
			}
		} else if (g.type === 'MultiPolygon') {
			for (const poly of g.coordinates) {
				for (const ring of poly) {
					visitLine(ring, bbox, totals);
				}
			}
		}
	}

	if (!Number.isFinite(bbox[0])) {
		return null;
	}

	return { bbox, lengthKm: Math.round(totals.meters / 100) / 10 };
}
