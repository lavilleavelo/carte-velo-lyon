import type * as maplibregl from 'maplibre-gl';
import {
	VELOV_DEFAULT_PALETTE,
	VELOV_PALETTES,
	isVelovPaletteId,
	type VelovPaletteId,
} from '$lib/utils/velovPalette';

const RATIO_STEPS = 20;
const PIN_PIXEL_RATIO = 2;

const WIDTH = 48;
const HEIGHT = 56;
const CX = 24;
const CY = 22;
const RING = 3;

const BODY_COLOR = '#ffffff';
const TRACK_COLOR = '#dfe3ea';
const CLOSED_COLOR = '#64748b';
const EDGE_COLOR = '#0f172a';
const EDGE_OPACITY = 0.5;
const SHADOW_COLOR = 'rgba(15, 23, 42, 0.28)';

type PinShape = { r: number; tip: number; round: number };

const OUTER: PinShape = { r: 19, tip: 51, round: 2.5 };
const TIP_SIN = OUTER.r / (OUTER.tip - CY);
const TIP_COS = Math.sqrt(1 - TIP_SIN * TIP_SIN);
const INNER: PinShape = { r: OUTER.r - RING, tip: OUTER.tip - RING / TIP_SIN, round: 1 };
const PIN_TOP = CY - OUTER.r;
const PIN_BOTTOM = OUTER.tip - OUTER.round * (1 / TIP_SIN - 1);

export const VELOV_PIN_ICON_OFFSET: [number, number] = [0, HEIGHT - PIN_BOTTOM];
export const VELOV_PIN_CENTER_LIFT = (PIN_BOTTOM - PIN_TOP) / 2;
export const VELOV_PIN_HEAD = { radius: OUTER.r, lift: PIN_BOTTOM - CY };

function pinPathData({ r, tip, round }: PinShape): string {
	const headX = r * TIP_COS;
	const headY = CY + r * TIP_SIN;
	const roundX = round * TIP_COS;
	const roundY = tip - round / TIP_SIN + round * TIP_SIN;
	const f = (value: number) => value.toFixed(2);

	return [
		`M${f(CX - headX)} ${f(headY)}`,
		`A${r} ${r} 0 1 1 ${f(CX + headX)} ${f(headY)}`,
		`L${f(CX + roundX)} ${f(roundY)}`,
		`A${round} ${round} 0 0 1 ${f(CX - roundX)} ${f(roundY)}`,
		'Z',
	].join('');
}

function fillLevels({ r, tip }: PinShape): number[] {
	const top = CY - r;
	const tangentY = CY + r * TIP_SIN;
	const tangentHalfWidth = r * TIP_COS;
	const samples = 480;
	const dy = (tip - top) / samples;
	const snap = (y: number) => Math.round(y * PIN_PIXEL_RATIO) / PIN_PIXEL_RATIO;

	const cumulative = [0];
	for (let i = 0; i < samples; i++) {
		const y = tip - (i + 0.5) * dy;
		const halfWidth =
			y > tangentY
				? (tangentHalfWidth * (tip - y)) / (tip - tangentY)
				: Math.sqrt(Math.max(r * r - (y - CY) ** 2, 0));
		cumulative.push(cumulative[i] + halfWidth);
	}

	const levels = [Math.ceil(tip)];
	let i = 0;
	for (let step = 1; step < RATIO_STEPS; step++) {
		const target = (cumulative[samples] * step) / RATIO_STEPS;
		while (cumulative[i] < target) {
			i++;
		}
		levels.push(snap(tip - i * dy));
	}
	levels.push(Math.floor(top));

	return levels;
}

const OUTER_PATH = pinPathData(OUTER);
const INNER_PATH = pinPathData(INNER);
const FILL_LEVELS = fillLevels(INNER);

type PinSpec = { closed: boolean; mech: number; elec: number; palette: VelovPaletteId };

function ratioSteps(value: number, total: number): number {
	if (!(total > 0) || !(value > 0)) {
		return 0;
	}

	return Math.max(1, Math.round(Math.min(value / total, 1) * RATIO_STEPS));
}

export const VELOV_DEFAULT_PIN_ICON = 'velov-pin-empty';
const VELOV_CLOSED_PIN_ICON = 'velov-pin-closed';
const PIN_KEY_PATTERN = /^velov-pin-([a-z]+)-(\d+)-(\d+)$/;

export function velovPinIconKey(
	mech: number,
	elec: number,
	capacity: number,
	closed: boolean,
	palette: VelovPaletteId = VELOV_DEFAULT_PALETTE,
): string {
	if (closed) {
		return VELOV_CLOSED_PIN_ICON;
	}

	const m = ratioSteps(mech, capacity);
	const e = Math.min(ratioSteps(elec, capacity), RATIO_STEPS - m);
	if (m + e === 0) {
		return VELOV_DEFAULT_PIN_ICON;
	}

	return `velov-pin-${palette}-${m}-${e}`;
}

function parsePinKey(key: string): PinSpec | null {
	if (key === VELOV_DEFAULT_PIN_ICON || key === VELOV_CLOSED_PIN_ICON) {
		return {
			closed: key === VELOV_CLOSED_PIN_ICON,
			mech: 0,
			elec: 0,
			palette: VELOV_DEFAULT_PALETTE,
		};
	}

	const match = PIN_KEY_PATTERN.exec(key);
	if (!match || !isVelovPaletteId(match[1])) {
		return null;
	}

	const mech = Math.min(Number(match[2]), RATIO_STEPS);
	const elec = Math.min(Number(match[3]), RATIO_STEPS - mech);
	return { closed: false, mech, elec, palette: match[1] };
}

type PinToolkit = {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	base: HTMLCanvasElement;
	inner: Path2D;
};

let toolkit: PinToolkit | null | undefined;

function createPinCanvas(): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = WIDTH * PIN_PIXEL_RATIO;
	canvas.height = HEIGHT * PIN_PIXEL_RATIO;
	return canvas;
}

function getToolkit(): PinToolkit | null {
	if (toolkit !== undefined) {
		return toolkit;
	}

	toolkit = null;

	const canvas = createPinCanvas();
	const base = createPinCanvas();
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	const baseCtx = base.getContext('2d');
	if (!ctx || !baseCtx) {
		return null;
	}

	ctx.scale(PIN_PIXEL_RATIO, PIN_PIXEL_RATIO);
	baseCtx.scale(PIN_PIXEL_RATIO, PIN_PIXEL_RATIO);

	const outer = new Path2D(OUTER_PATH);
	const inner = new Path2D(INNER_PATH);

	baseCtx.save();
	baseCtx.shadowColor = SHADOW_COLOR;
	baseCtx.shadowBlur = 3 * PIN_PIXEL_RATIO;
	baseCtx.shadowOffsetY = 1.25 * PIN_PIXEL_RATIO;
	baseCtx.fillStyle = BODY_COLOR;
	baseCtx.fill(outer);
	baseCtx.restore();

	baseCtx.globalAlpha = EDGE_OPACITY;
	baseCtx.strokeStyle = EDGE_COLOR;
	baseCtx.lineWidth = 1.25;
	baseCtx.stroke(outer);
	baseCtx.globalAlpha = 1;

	baseCtx.fillStyle = TRACK_COLOR;
	baseCtx.fill(inner);

	toolkit = { canvas, ctx, base, inner };
	return toolkit;
}

function buildPinIcon(spec: PinSpec): ImageData | null {
	const tools = getToolkit();
	if (!tools) {
		return null;
	}

	const { canvas, ctx, base, inner } = tools;
	ctx.clearRect(0, 0, WIDTH, HEIGHT);
	ctx.drawImage(base, 0, 0, WIDTH, HEIGHT);

	ctx.save();
	ctx.clip(inner);

	if (spec.closed) {
		const arm = 5;
		ctx.fillStyle = CLOSED_COLOR;
		ctx.fillRect(0, 0, WIDTH, HEIGHT);
		ctx.strokeStyle = BODY_COLOR;
		ctx.lineWidth = 2.5;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(CX - arm, CY - arm);
		ctx.lineTo(CX + arm, CY + arm);
		ctx.moveTo(CX + arm, CY - arm);
		ctx.lineTo(CX - arm, CY + arm);
		ctx.stroke();
	} else {
		const colors = VELOV_PALETTES[spec.palette];
		const bottom = FILL_LEVELS[0];
		const elecY = FILL_LEVELS[spec.elec];
		const topY = FILL_LEVELS[spec.elec + spec.mech];

		if (spec.elec > 0) {
			ctx.fillStyle = colors.elec.fill;
			ctx.fillRect(0, elecY, WIDTH, bottom - elecY);
		}

		if (spec.mech > 0) {
			ctx.fillStyle = colors.mech.fill;
			ctx.fillRect(0, topY, WIDTH, elecY - topY);
		}

		ctx.fillStyle = BODY_COLOR;
		if (spec.elec > 0 && spec.mech > 0) {
			ctx.fillRect(0, elecY - 0.5, WIDTH, 1);
		}

		if (spec.elec + spec.mech > 0 && spec.elec + spec.mech < RATIO_STEPS) {
			ctx.fillRect(0, topY - 0.5, WIDTH, 1);
		}
	}

	ctx.restore();

	return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function ensureVelovPinIcon(map: maplibregl.Map, key: string): void {
	if (map.hasImage(key)) {
		return;
	}

	const spec = parsePinKey(key);
	if (!spec) {
		return;
	}

	const imageData = buildPinIcon(spec);
	if (!imageData) {
		return;
	}

	map.addImage(key, imageData, { pixelRatio: PIN_PIXEL_RATIO });
}

export function velovPinLegendIcon(palette: VelovPaletteId = VELOV_DEFAULT_PALETTE): string {
	const { mech, elec } = VELOV_PALETTES[palette];
	const elecY = FILL_LEVELS[6];
	const topY = FILL_LEVELS[14];
	const svg = [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="3 1 42 51">`,
		`<path d="${OUTER_PATH}" fill="${BODY_COLOR}" stroke="${EDGE_COLOR}" stroke-opacity="${EDGE_OPACITY}"/>`,
		`<clipPath id="a"><path d="${INNER_PATH}"/></clipPath>`,
		`<g clip-path="url(#a)">`,
		`<rect width="${WIDTH}" height="${HEIGHT}" fill="${TRACK_COLOR}"/>`,
		`<rect y="${topY}" width="${WIDTH}" height="${elecY - topY}" fill="${mech.fill}"/>`,
		`<rect y="${elecY}" width="${WIDTH}" height="${HEIGHT - elecY}" fill="${elec.fill}"/>`,
		`<rect y="${elecY - 0.5}" width="${WIDTH}" height="1" fill="${BODY_COLOR}"/>`,
		`<rect y="${topY - 0.5}" width="${WIDTH}" height="1" fill="${BODY_COLOR}"/>`,
		`</g></svg>`,
	].join('');

	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
