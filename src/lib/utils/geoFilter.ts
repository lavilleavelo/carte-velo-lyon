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
};

const boundaryCache = new WeakMap<FeatureCollection, BoundaryCache>();

function getBoundaryCache(boundary: FeatureCollection): BoundaryCache {
	let cached = boundaryCache.get(boundary);
	if (!cached) {
		const geoms = boundary.features.map((f) => f.geometry);
		const bboxes = geoms.map(bboxOfGeom);
		cached = { geoms, bboxes };
		boundaryCache.set(boundary, cached);
	}
	return cached;
}

export function filterFeaturesInsideBoundary(
	data: FeatureCollection,
	boundary: FeatureCollection,
): FeatureCollection {
	const { geoms: boundaryGeoms, bboxes: boundaryBboxes } = getBoundaryCache(boundary);

	const kept = data.features.filter((feature) => {
		const fGeom = feature.geometry as Geometry | null;
		if (!fGeom) {
			return false;
		}

		const fBbox = bboxOfGeom(fGeom);
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

	return { type: 'FeatureCollection', features: kept };
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
					if (v == null) return null;
					const n = typeof v === 'number' ? v : Number(v);
					return Number.isNaN(n) ? null : n;
				};

	const features = data.features.filter((f) => {
		const year = getYear(f);
		if (year == null) return true;
		return year >= from && year <= to;
	});

	return { type: 'FeatureCollection', features };
}
