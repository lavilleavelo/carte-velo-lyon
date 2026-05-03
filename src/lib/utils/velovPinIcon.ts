import type maplibregl from 'maplibre-gl';

export const PIN = { width: 48, height: 62, cx: 24, cy: 22, r: 19, tip: 56 };
const RATIO_STEPS = 20;
const PIN_PIXEL_RATIO = 2;

// Precompute the pin's cumulative area function so we can fill the gauge
// proportionally to AREA (not height).
const AREA_TABLE = (() => {
	const { cy, r, tip } = PIN;
	const d = tip - cy;
	const gamma = Math.acos(r / d);
	const yTangent = cy + r * Math.cos(gamma);
	const tangentHalfW = r * Math.sin(gamma);

	function widthAt(y: number): number {
		if (y > tip || y < cy - r) {
			return 0;
		}

		if (y >= yTangent) {
			return (2 * tangentHalfW * (tip - y)) / (tip - yTangent);
		}

		const dyy = y - cy;
		const inside = r * r - dyy * dyy;
		return inside > 0 ? 2 * Math.sqrt(inside) : 0;
	}

	const yMin = cy - r;
	const dy = 0.05;
	const N = Math.ceil((tip - yMin) / dy);
	const areaBelow = new Float64Array(N + 1);
	areaBelow[N] = 0;

	let cum = 0;

	for (let i = N - 1; i >= 0; i--) {
		const yMid = yMin + (i + 0.5) * dy;
		cum += widthAt(yMid) * dy;
		areaBelow[i] = cum;
	}

	return { areaBelow, total: cum, yMin, dy, N };
})();

function findYForArea(target: number): number {
	const { areaBelow, yMin, dy, N } = AREA_TABLE;
	let lo = 0;
	let hi = N;

	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (areaBelow[mid] > target) {
			lo = mid + 1;
		} else {
			hi = mid;
		}
	}

	if (lo === 0) {
		return yMin;
	}

	const a1 = areaBelow[lo - 1];
	const a2 = areaBelow[lo];
	const t = a1 === a2 ? 0 : (a1 - target) / (a1 - a2);
	return yMin + (lo - 1 + t) * dy;
}

function bucketRatio(value: number, total: number): number {
	if (total <= 0) {
		return 0;
	}

	const r = Math.min(Math.max(value / total, 0), 1);
	return Math.round(r * RATIO_STEPS) / RATIO_STEPS;
}

export function velovPinIconKey(
	mech: number,
	elec: number,
	capacity: number,
	closed: boolean,
): string {
	const m = bucketRatio(mech, capacity);
	const e = bucketRatio(elec, capacity);
	return `velov-pin-${closed ? 'c' : 'o'}-${m.toFixed(2)}-${e.toFixed(2)}`;
}

export const VELOV_DEFAULT_PIN_ICON = 'velov-pin-o-0.00-0.00';

function buildPinIcon(mechRatio: number, elecRatio: number, closed: boolean): ImageData | null {
	const canvas = document.createElement('canvas');
	canvas.width = PIN.width * PIN_PIXEL_RATIO;
	canvas.height = PIN.height * PIN_PIXEL_RATIO;

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return null;
	}

	ctx.scale(PIN_PIXEL_RATIO, PIN_PIXEL_RATIO);

	const { cx, cy, r, tip } = PIN;
	const d = tip - cy;
	const gamma = Math.acos(r / d);
	const rightAngle = Math.PI / 2 - gamma;
	const leftAngle = Math.PI / 2 + gamma;

	const pinPath = () => {
		ctx.beginPath();
		ctx.moveTo(cx + r * Math.cos(rightAngle), cy + r * Math.sin(rightAngle));
		ctx.arc(cx, cy, r, rightAngle, leftAngle, true);
		ctx.lineTo(cx, tip);
		ctx.closePath();
	};

	// silhouette
	ctx.save();
	ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
	ctx.shadowBlur = 3;
	ctx.shadowOffsetY = 1.5;
	pinPath();
	ctx.fillStyle = closed ? '#e5e7eb' : '#ffffff';
	ctx.fill();
	ctx.restore();

	// colored bands
	if (!closed) {
		ctx.save();
		pinPath();
		ctx.clip();

		const elecRClamped = Math.min(Math.max(elecRatio, 0), 1);
		const mechRClamped = Math.min(Math.max(mechRatio, 0), 1);
		const totalArea = AREA_TABLE.total;
		const elecArea = totalArea * elecRClamped;
		const mechArea = totalArea * mechRClamped;
		const yElec = findYForArea(elecArea);
		const yEm = findYForArea(elecArea + mechArea);
		const fillX = cx - r - 2;
		const fillW = 2 * r + 4;

		if (elecRClamped > 0) {
			ctx.fillStyle = '#16a34a';
			ctx.fillRect(fillX, yElec, fillW, tip - yElec + 2);
		}

		if (mechRClamped > 0) {
			ctx.fillStyle = '#dc2626';
			ctx.fillRect(fillX, yEm, fillW, yElec - yEm);
		}

		ctx.restore();
	}

	// outline
	pinPath();
	ctx.strokeStyle = closed ? '#9ca3af' : '#4b5563';
	ctx.lineWidth = 1.4;
	ctx.lineJoin = 'round';
	ctx.stroke();

	return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

const generatedIcons = new WeakMap<maplibregl.Map, Set<string>>();

export function ensureVelovPinIcon(
	map: maplibregl.Map,
	key: string,
	mech: number,
	elec: number,
	capacity: number,
	closed: boolean,
): void {
	let registered = generatedIcons.get(map);
	if (!registered) {
		registered = new Set();
		generatedIcons.set(map, registered);
	}

	if (registered.has(key)) {
		return;
	}

	if (map.hasImage(key)) {
		registered.add(key);
		return;
	}

	const mechR = bucketRatio(mech, capacity);
	const elecR = bucketRatio(elec, capacity);
	const imageData = buildPinIcon(mechR, elecR, closed);

	if (!imageData) {
		return;
	}

	map.addImage(key, imageData, { pixelRatio: PIN_PIXEL_RATIO });
	registered.add(key);
}
