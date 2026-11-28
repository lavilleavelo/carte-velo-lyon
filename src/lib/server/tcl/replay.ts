import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { tclDataDir } from './files';
import { compactVehicle } from './vehicles';

const FRAME_S = 60;
const STALE_S = 150;
const MAX_FILL_S = 3600;

export type FrameVehicle = [
	id: string,
	line: string,
	direction: 0 | 1,
	lat: number,
	lon: number,
	bearing: number | null,
	delay: number | null,
];

type Frame = { t: number; v: FrameVehicle[] };

const PARIS_HOUR = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Europe/Paris',
	hour: '2-digit',
	hourCycle: 'h23',
});

function replayDir(day: string): string {
	return join(tclDataDir(), 'replay', day);
}

export function replayPath(day: string, hour: number): string {
	return join(replayDir(day), `${String(hour).padStart(2, '0')}.json.gz`);
}

export function createReplayWriter(day: string) {
	const latest = new Map<string, { t: number; vehicle: FrameVehicle }>();
	let frames: Frame[] = [];
	let hour: number | null = null;
	let nextFrameAt: number | null = null;

	async function flush() {
		if (hour === null || frames.length === 0) {
			return;
		}
		await mkdir(replayDir(day), { recursive: true });
		const path = replayPath(day, hour);
		await writeFile(`${path}.tmp`, gzipSync(JSON.stringify({ day, hour, frames })));
		await rename(`${path}.tmp`, path);
		frames = [];
	}

	return {
		async add(receivedAt: number, activities: unknown[]) {
			if (nextFrameAt === null || receivedAt - nextFrameAt > MAX_FILL_S) {
				nextFrameAt = Math.ceil(receivedAt / FRAME_S) * FRAME_S;
			}
			while (nextFrameAt <= receivedAt) {
				const frameAt = nextFrameAt;
				const frameHour = Number(PARIS_HOUR.format(frameAt * 1000)) % 24;
				if (hour !== null && frameHour !== hour) {
					await flush();
				}
				hour = frameHour;
				frames.push({
					t: frameAt,
					v: [...latest.values()]
						.filter((entry) => frameAt - entry.t <= STALE_S)
						.map((entry) => entry.vehicle),
				});
				nextFrameAt += FRAME_S;
			}
			for (const activity of activities) {
				const vehicle = compactVehicle(activity as Record<string, unknown>);
				if (!vehicle) {
					continue;
				}
				const t = Date.parse(vehicle.recordedAt) / 1000;
				const known = latest.get(vehicle.id);
				if (known && known.t >= t) {
					continue;
				}
				latest.set(vehicle.id, {
					t,
					vehicle: [
						vehicle.id,
						vehicle.line,
						vehicle.direction === 'inbound' ? 1 : 0,
						vehicle.lat,
						vehicle.lon,
						vehicle.bearing,
						vehicle.delay === null ? null : Math.round(vehicle.delay),
					],
				});
			}
		},
		finish: flush,
	};
}

export async function readReplay(day: string, hour: number): Promise<Buffer | null> {
	try {
		return await readFile(replayPath(day, hour));
	} catch {
		return null;
	}
}

export async function replayIndex(): Promise<{ day: string; hours: number[] }[]> {
	const root = join(tclDataDir(), 'replay');
	let days: string[];
	try {
		days = (await readdir(root)).filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name)).sort();
	} catch {
		return [];
	}
	const index = [];
	for (const day of days) {
		const hours = (await readdir(join(root, day)))
			.map((file) => file.match(/^(\d{2})\.json\.gz$/)?.[1])
			.filter((hour): hour is string => hour !== undefined)
			.map(Number)
			.sort((a, b) => a - b);
		if (hours.length > 0) {
			index.push({ day, hours });
		}
	}
	return index;
}
