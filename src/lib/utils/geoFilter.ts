import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

export const EMPTY_FEATURE_COLLECTION: FeatureCollection = Object.freeze({
	type: 'FeatureCollection',
	features: [],
}) as FeatureCollection;

function pointInRing(x: number, y: number, ring: Position[]): boolean {
	let inside = false;

	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const xi = ring[i][0];
		const yi = ring[i][1];
		const xj = ring[j][0];
		const yj = ring[j][1];
		const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}

	return inside;
}

function pointInPolygon(x: number, y: number, polygon: Position[][]): boolean {
	if (!pointInRing(x, y, polygon[0])) {
		return false;
	}

	for (let i = 1; i < polygon.length; i++) {
		if (pointInRing(x, y, polygon[i])) return false;
	}

	return true;
}

function pointInGeom(x: number, y: number, geom: Geometry): boolean {
	if (geom.type === 'Polygon') {
		return pointInPolygon(x, y, geom.coordinates);
	}

	if (geom.type === 'MultiPolygon') {
		for (const poly of geom.coordinates) if (pointInPolygon(x, y, poly)) return true;
	}

	return false;
}

function walkPositions(coords: unknown, visit: (x: number, y: number) => boolean): boolean {
	if (!Array.isArray(coords)) {
		return false;
	}

	if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
		return visit(coords[0] as number, coords[1] as number);
	}

	for (const c of coords) {
		if (walkPositions(c, visit)) return true;
	}

	return false;
}

function bboxOfGeom(geom: Geometry): [number, number, number, number] {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	walkPositions((geom as { coordinates: unknown }).coordinates, (x, y) => {
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;

		return false;
	});

	return [minX, minY, maxX, maxY];
}

function bboxesOverlap(
	a: [number, number, number, number],
	b: [number, number, number, number],
): boolean {
	return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

type BoundaryCache = {
	geoms: Geometry[];
	bboxes: [number, number, number, number][];
	overall: [number, number, number, number];
};

const boundaryCache = new WeakMap<FeatureCollection, BoundaryCache>();

function getBoundaryCache(boundary: FeatureCollection): BoundaryCache {
	let cached = boundaryCache.get(boundary);
	if (!cached) {
		const geoms = boundary.features.map((f) => f.geometry);
		const bboxes = geoms.map(bboxOfGeom);
		const overall: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];

		for (const b of bboxes) {
			if (b[0] < overall[0]) overall[0] = b[0];
			if (b[1] < overall[1]) overall[1] = b[1];
			if (b[2] > overall[2]) overall[2] = b[2];
			if (b[3] > overall[3]) overall[3] = b[3];
		}

		cached = { geoms, bboxes, overall };
		boundaryCache.set(boundary, cached);
	}
	return cached;
}

const featureBboxCache = new WeakMap<Feature, [number, number, number, number]>();

function getFeatureBbox(feature: Feature): [number, number, number, number] | null {
	let bbox = featureBboxCache.get(feature);
	if (bbox) {
		return bbox;
	}

	const geom = feature.geometry as Geometry | null;
	if (!geom) {
		return null;
	}

	bbox = bboxOfGeom(geom);
	featureBboxCache.set(feature, bbox);
	return bbox;
}

const filteredCache = new WeakMap<
	FeatureCollection,
	WeakMap<FeatureCollection, FeatureCollection>
>();

export function filterFeaturesInsideBoundary(
	data: FeatureCollection,
	boundary: FeatureCollection,
): FeatureCollection {
	let inner = filteredCache.get(data);
	if (inner) {
		const hit = inner.get(boundary);
		if (hit) return hit;
	} else {
		inner = new WeakMap();
		filteredCache.set(data, inner);
	}

	const { geoms: boundaryGeoms, bboxes: boundaryBboxes, overall } = getBoundaryCache(boundary);

	const kept = data.features.filter((feature) => {
		const fGeom = feature.geometry as Geometry | null;
		if (!fGeom) {
			return false;
		}

		const fBbox = getFeatureBbox(feature);
		if (!fBbox) {
			return false;
		}

		if (!bboxesOverlap(fBbox, overall)) {
			return false;
		}

		let boxHit = false;
		for (const b of boundaryBboxes) {
			if (bboxesOverlap(fBbox, b)) {
				boxHit = true;
				break;
			}
		}

		if (!boxHit) {
			return false;
		}

		return walkPositions((fGeom as { coordinates: unknown }).coordinates, (x, y) => {
			for (const g of boundaryGeoms) if (pointInGeom(x, y, g)) return true;
			return false;
		});
	}) as Feature[];

	const result: FeatureCollection = { type: 'FeatureCollection', features: kept };
	inner.set(boundary, result);
	return result;
}

type YearGetter = (feature: Feature) => number | null | undefined;

export function filterFeaturesByYear(
	data: FeatureCollection,
	yearGetter: string | YearGetter,
	range: [number, number],
): FeatureCollection {
	const [from, to] = range;

	const getYear: YearGetter =
		typeof yearGetter === 'function'
			? yearGetter
			: (f) => {
					const v = (f.properties as Record<string, unknown> | null)?.[yearGetter];
					if (v == null || v === '') {
						return null;
					}
					const n = typeof v === 'number' ? v : Number(v);

					if (Number.isNaN(n)) {
						return null;
					}

					if (n < 1900) {
						return null;
					}

					return n;
				};

	const features = data.features.filter((f) => {
		const year = getYear(f);
		if (year == null) return true;
		return year >= from && year <= to;
	});

	return { type: 'FeatureCollection', features };
}
