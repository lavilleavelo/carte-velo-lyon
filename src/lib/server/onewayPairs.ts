/**
 * Detects pairs of parallel oneway OSM ways that together model a divided arterial
 * (boulevard with central median: each carriageway tagged separately as oneway=yes
 * in opposite directions). On a cycle map we don't want to render direction arrows
 * on these — visually they look like "two arrows on a two-way street" to a user
 * who reads the boulevard as one road.
 *
 * Algorithm (per Overpass response):
 *   1. Group ways by `name` (and `ref` as fallback). Skip ways with no name/ref.
 *   2. Within each group, compare every pair:
 *      - Both ways must be `oneway=yes` (or `oneway=-1`).
 *      - Their overall direction vectors must be antiparallel (dot product ≲ -0.7).
 *      - Their geometries must be spatially close (avg distance < 30 m on at least
 *        60% of the sampled length, with ≥ 50 m of overlap).
 *   3. Both ways are marked as paired and excluded from arrow rendering.
 *
 * Also respects the (rare) explicit `dual_carriageway=yes` tag.
 */

type OverpassWay = {
	type: 'way';
	id: number;
	geometry?: { lon: number; lat: number }[];
	tags?: Record<string, string>;
};

const PAIR_DISTANCE_THRESHOLD_M = 30;
const PAIR_MIN_OVERLAP_M = 50;
const PAIR_SAMPLE_INTERVAL_M = 20;
const PAIR_MIN_FRACTION_WITHIN = 0.6;
const PAIR_MIN_LENGTH_M = 30;
const ANTIPARALLEL_DOT_MAX = -0.7;

type Vec2 = [number, number];

function projectorForLat(refLat: number): (p: { lon: number; lat: number }) => Vec2 {
	const R = 6_371_000;
	const cosLat = Math.cos((refLat * Math.PI) / 180);
	return (p) => [((p.lon * Math.PI) / 180) * R * cosLat, ((p.lat * Math.PI) / 180) * R];
}

function lineLength(coords: Vec2[]): number {
	let total = 0;
	for (let i = 1; i < coords.length; i++) {
		total += Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]);
	}
	return total;
}

function pointToSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const len2 = dx * dx + dy * dy;
	if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
	let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
	if (t < 0) {
		t = 0;
	} else if (t > 1) {
		t = 1;
	}
	const px = a[0] + t * dx;
	const py = a[1] + t * dy;
	return Math.hypot(p[0] - px, p[1] - py);
}

function pointToLineDistance(p: Vec2, line: Vec2[]): number {
	let min = Infinity;

	for (let i = 1; i < line.length; i++) {
		const d = pointToSegmentDistance(p, line[i - 1], line[i]);
		if (d < min) min = d;
	}

	return min;
}

function* sampleLineEvery(line: Vec2[], interval: number): Generator<Vec2> {
	if (line.length < 2) {
		return;
	}

	const segLengths: number[] = [];
	let total = 0;
	for (let i = 1; i < line.length; i++) {
		const d = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
		segLengths.push(d);
		total += d;
	}

	let target = 0;
	let segIdx = 0;
	let walked = 0;
	while (target <= total) {
		while (segIdx < segLengths.length && walked + segLengths[segIdx] < target) {
			walked += segLengths[segIdx];
			segIdx++;
		}

		if (segIdx >= segLengths.length) {
			break;
		}

		const remaining = target - walked;
		const segLen = segLengths[segIdx];
		const t = segLen > 0 ? remaining / segLen : 0;
		const a = line[segIdx];
		const b = line[segIdx + 1];
		yield [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
		target += interval;
	}
}

function isOneway(tags?: Record<string, string>): boolean {
	if (!tags) {
		return false;
	}

	return tags.oneway === 'yes' || tags.oneway === '-1' || tags.oneway === 'true';
}

function isExplicitDualCarriageway(tags?: Record<string, string>): boolean {
	return tags?.dual_carriageway === 'yes';
}

function groupKey(tags?: Record<string, string>): string | null {
	if (!tags) {
		return null;
	}

	const name = tags.name?.trim();
	if (name) {
		return `name:${name}`;
	}

	const ref = tags.ref?.trim();
	if (ref) {
		return `ref:${ref}`;
	}

	return null;
}

function areSiblings(a: OverpassWay, b: OverpassWay): boolean {
	const ag = a.geometry,
		bg = b.geometry;
	if (!ag || !bg || ag.length < 2 || bg.length < 2) {
		return false;
	}

	const refLat = ag[0].lat;
	const project = projectorForLat(refLat);
	const aProj = ag.map(project);
	const bProj = bg.map(project);

	const aLength = lineLength(aProj);
	const bLength = lineLength(bProj);
	if (aLength < PAIR_MIN_LENGTH_M || bLength < PAIR_MIN_LENGTH_M) {
		return false;
	}

	// antiparallel overall direction
	const aDir: Vec2 = [
		aProj[aProj.length - 1][0] - aProj[0][0],
		aProj[aProj.length - 1][1] - aProj[0][1],
	];
	const bDir: Vec2 = [
		bProj[bProj.length - 1][0] - bProj[0][0],
		bProj[bProj.length - 1][1] - bProj[0][1],
	];
	const aMag = Math.hypot(aDir[0], aDir[1]);
	const bMag = Math.hypot(bDir[0], bDir[1]);
	if (aMag === 0 || bMag === 0) {
		return false;
	}
	const dot = (aDir[0] * bDir[0] + aDir[1] * bDir[1]) / (aMag * bMag);
	if (dot > ANTIPARALLEL_DOT_MAX) {
		return false;
	}

	// Sample shorter way (more conservative pairing on short segments next to long ones)
	const [shortProj, longProj] = aLength <= bLength ? [aProj, bProj] : [bProj, aProj];

	let samples = 0;
	let withinThreshold = 0;
	for (const sample of sampleLineEvery(shortProj, PAIR_SAMPLE_INTERVAL_M)) {
		samples++;
		if (pointToLineDistance(sample, longProj) < PAIR_DISTANCE_THRESHOLD_M) {
			withinThreshold++;
		}
	}
	if (samples === 0) return false;

	const overlapLength = withinThreshold * PAIR_SAMPLE_INTERVAL_M;
	if (overlapLength < PAIR_MIN_OVERLAP_M) return false;

	return withinThreshold / samples >= PAIR_MIN_FRACTION_WITHIN;
}

/**
 * Returns the set of OSM way ids that are part of a divided-carriageway pair.
 * Mutates nothing.
 */
export function findDualCarriagewayWayIds(elements: OverpassWay[]): Set<number> {
	const paired = new Set<number>();

	const groups = new Map<string, OverpassWay[]>();
	for (const el of elements) {
		if (el.type !== 'way') {
			continue;
		}

		if (isExplicitDualCarriageway(el.tags)) {
			paired.add(el.id);
			continue;
		}

		if (!isOneway(el.tags)) {
			continue;
		}

		const key = groupKey(el.tags);
		if (!key) {
			continue;
		}

		let bucket = groups.get(key);
		if (!bucket) {
			bucket = [];
			groups.set(key, bucket);
		}
		bucket.push(el);
	}

	for (const bucket of groups.values()) {
		if (bucket.length < 2) continue;
		for (let i = 0; i < bucket.length; i++) {
			for (let j = i + 1; j < bucket.length; j++) {
				if (areSiblings(bucket[i], bucket[j])) {
					paired.add(bucket[i].id);
					paired.add(bucket[j].id);
				}
			}
		}
	}

	return paired;
}
