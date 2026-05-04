import type maplibregl from 'maplibre-gl';

export const PIN = { width: 48, height: 62, cx: 24, cy: 22, r: 19, tip: 56 };
const RATIO_STEPS = 20;
const PIN_PIXEL_RATIO = 2;

const PIN_TOP = PIN.cy - PIN.r;
const PIN_HEIGHT_PX = PIN.tip - PIN_TOP;

function findYForRatio(ratio: number): number {
	const r = Math.min(Math.max(ratio, 0), 1);
	return PIN.tip - r * PIN_HEIGHT_PX;
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
		const yElec = findYForRatio(elecRClamped);
		const yEm = findYForRatio(elecRClamped + mechRClamped);
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
