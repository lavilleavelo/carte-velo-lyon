import { env } from '$env/dynamic/private';
import { createHash } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { todayInParis } from '$lib/server/counters/calendar';
import {
	estimatedJourneys,
	journeyKey,
	lineCode,
	lineRef,
	recordedAt,
	responseTimestamp,
	situations,
	vehicleActivities,
	vehicleKey,
} from './siri';

const SIRI_URL = 'https://data.grandlyon.com/siri-lite/2.0';
const STOPS_URL =
	'https://data.grandlyon.com/fr/datapusher/ws/rdata/tcl_sytral.tclarret/all.json?maxfeatures=100000';
export const DEFAULT_LINES = 'TB11,C13,C14,C18';
export const DEFAULT_GRENETTE_LINES = 'TB11,C13,C14,C18';
const AUTH_RETRY_MS = 60 * 60 * 1000;
const RATE_LIMIT_RETRY_MS = 10 * 60 * 1000;
const MAX_BACKOFF_MS = 2 * 60 * 1000;
const SCHEDULER_KEY = '__carteVeloLyonTclCollector';

type FeedName = 'vm' | 'et' | 'sx' | 'stops';

type FeedStatus = {
	intervalMs: number;
	polls: number;
	lastSuccessAt: string | null;
	lastStored: number | null;
	lastBytes: number | null;
	storedToday: number;
	lastErrorAt: string | null;
	lastError: string | null;
	consecutiveFailures: number;
};

type Context = {
	authorization: string;
	lines: string[];
	patterns: RegExp[];
	vmLines: Set<string> | null;
	knownLines: Set<string>;
};

class AuthError extends Error {}

class RateLimitError extends Error {
	retryMs: number;

	constructor(retryMs: number) {
		super(`HTTP 429, retry in ${Math.round(retryMs / 1000)} s`);
		this.retryMs = retryMs;
	}
}

const status = {
	enabled: false,
	startedAt: null as string | null,
	dataDir: null as string | null,
	lines: [] as string[],
	vmLines: null as string[] | null,
	feeds: {} as Partial<Record<FeedName, FeedStatus>>,
};

const seen = {
	day: '',
	vehicles: new Map<string, string>(),
	journeys: new Map<string, string>(),
	situations: '',
	stops: '',
};

function dataDir(): string {
	return env.TCL_DATA_DIR || '.data/tcl';
}

function hash(value: unknown): string {
	return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function startDay(): string {
	const day = todayInParis();
	if (day !== seen.day) {
		seen.day = day;
		seen.vehicles.clear();
		seen.journeys.clear();
		seen.situations = '';
		for (const state of Object.values(status.feeds)) {
			state.storedToday = 0;
		}
	}
	return day;
}

async function fetchJson(
	url: string,
	authorization: string,
): Promise<{ data: unknown; bytes: number }> {
	const response = await fetch(url, {
		headers: { Authorization: authorization, 'User-Agent': 'carte-velo-lyon' },
		signal: AbortSignal.timeout(60_000),
	});
	if (response.status === 429) {
		const retryAfter = Number(response.headers.get('retry-after')) * 1000;
		throw new RateLimitError(Math.max(RATE_LIMIT_RETRY_MS, retryAfter || 0));
	}
	if (response.status === 401 || response.status === 403) {
		throw new AuthError(`HTTP ${response.status}`);
	}
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${response.statusText}`);
	}
	const body = Buffer.from(await response.arrayBuffer());
	return { data: JSON.parse(body.toString('utf8')), bytes: body.length };
}

async function append(feed: FeedName, day: string, record: unknown): Promise<void> {
	const dir = join(dataDir(), feed);
	await mkdir(dir, { recursive: true });
	await appendFile(join(dir, `${day}.jsonl.gz`), gzipSync(`${JSON.stringify(record)}\n`));
}

async function pollVehicles(context: Context, state: FeedStatus): Promise<number> {
	const received = new Date().toISOString();
	const { data, bytes } = await fetchJson(
		`${SIRI_URL}/vehicle-monitoring.json?MaximumVehicles=3000`,
		context.authorization,
	);
	state.lastBytes = bytes;
	const day = startDay();
	const activities = vehicleActivities(data);
	for (const activity of activities) {
		const code = lineCode(activity);
		if (code) {
			context.knownLines.add(code);
		}
	}
	const fresh = activities
		.filter((activity) => {
			const code = lineCode(activity);
			return (
				!context.vmLines ||
				(code !== null &&
					(context.vmLines.has(code) || context.patterns.some((pattern) => pattern.test(code))))
			);
		})
		.map((activity) => ({
			activity,
			key: vehicleKey(activity) ?? hash(activity.MonitoredVehicleJourney),
			version: recordedAt(activity) ?? hash(activity),
		}))
		.filter(({ key, version }) => seen.vehicles.get(key) !== version);
	await append('vm', day, {
		received,
		responseTimestamp: responseTimestamp(data),
		items: fresh.map(({ activity }) => activity),
	});
	for (const { key, version } of fresh) {
		seen.vehicles.set(key, version);
	}
	return fresh.length;
}

async function pollTimetables(context: Context, state: FeedStatus): Promise<number> {
	let stored = 0;
	let bytesTotal = 0;
	const errors: string[] = [];
	const lines = timetableLines(context);
	status.lines = lines;
	for (const line of lines) {
		const received = new Date().toISOString();
		let response: { data: unknown; bytes: number };
		try {
			response = await fetchJson(
				`${SIRI_URL}/estimated-timetables.json?${new URLSearchParams({ LineRef: lineRef(line) })}`,
				context.authorization,
			);
		} catch (error) {
			if (error instanceof AuthError || error instanceof RateLimitError) {
				throw error;
			}
			errors.push(`${line}: ${error instanceof Error ? error.message : String(error)}`);
			continue;
		}
		bytesTotal += response.bytes;
		const day = startDay();
		const journeys = estimatedJourneys(response.data);
		const fresh = journeys
			.map((journey) => ({ journey, version: hash(journey) }))
			.map((entry) => ({ ...entry, key: journeyKey(entry.journey) ?? entry.version }))
			.filter(({ key, version }) => seen.journeys.get(key) !== version);
		await append('et', day, {
			received,
			line,
			responseTimestamp: responseTimestamp(response.data),
			journeys: journeys.length,
			items: fresh.map(({ journey }) => journey),
		});
		for (const { key, version } of fresh) {
			seen.journeys.set(key, version);
		}
		stored += fresh.length;
	}
	state.lastBytes = bytesTotal;
	if (errors.length > 0 && errors.length === lines.length) {
		throw new Error(errors.join('; '));
	}
	if (errors.length > 0) {
		state.lastErrorAt = new Date().toISOString();
		state.lastError = errors.join('; ');
	}
	return stored;
}

async function pollSituations(context: Context, state: FeedStatus): Promise<number> {
	const received = new Date().toISOString();
	const { data, bytes } = await fetchJson(
		`${SIRI_URL}/situation-exchange.json`,
		context.authorization,
	);
	state.lastBytes = bytes;
	const day = startDay();
	const items = situations(data);
	const version = hash(items);
	if (version === seen.situations) {
		return 0;
	}
	seen.situations = version;
	await append('sx', day, { received, responseTimestamp: responseTimestamp(data), items });
	return items.length;
}

async function pollStops(context: Context, state: FeedStatus): Promise<number> {
	const received = new Date().toISOString();
	const { data, bytes } = await fetchJson(STOPS_URL, context.authorization);
	state.lastBytes = bytes;
	const day = startDay();
	const values = ((data as { values?: Record<string, unknown>[] }).values ?? []).map((row) => {
		const stop = { ...row };
		delete stop.last_update;
		delete stop.last_update_fme;
		return stop;
	});
	if (values.length === 0) {
		throw new Error('no stops in response');
	}
	const version = hash(values);
	if (version === seen.stops) {
		return 0;
	}
	seen.stops = version;
	await append('stops', day, { received, values });
	return values.length;
}

function schedule(
	name: FeedName,
	intervalMs: number,
	context: Context,
	poll: (context: Context, state: FeedStatus) => Promise<number>,
): void {
	const state: FeedStatus = {
		intervalMs,
		polls: 0,
		lastSuccessAt: null,
		lastStored: null,
		lastBytes: null,
		storedToday: 0,
		lastErrorAt: null,
		lastError: null,
		consecutiveFailures: 0,
	};
	status.feeds[name] = state;

	const run = async () => {
		const started = Date.now();
		let delay = intervalMs;
		try {
			state.lastStored = await poll(context, state);
			state.storedToday += state.lastStored;
			state.polls++;
			state.lastSuccessAt = new Date().toISOString();
			state.consecutiveFailures = 0;
		} catch (error) {
			state.consecutiveFailures++;
			state.lastErrorAt = new Date().toISOString();
			state.lastError = error instanceof Error ? error.message : String(error);
			delay =
				error instanceof AuthError
					? AUTH_RETRY_MS
					: error instanceof RateLimitError
						? error.retryMs
						: Math.min(intervalMs * 2 ** state.consecutiveFailures, MAX_BACKOFF_MS);
			if (
				error instanceof AuthError ||
				error instanceof RateLimitError ||
				state.consecutiveFailures <= 3
			) {
				console.error(`[tcl] ${name} poll failed (${state.consecutiveFailures}):`, error);
			}
		}
		setTimeout(run, Math.max(0, delay - (Date.now() - started))).unref();
	};
	run();
}

function parseLines(value: string): string[] {
	return value
		.split(',')
		.map((line) => line.trim().toUpperCase())
		.filter(Boolean);
}

function linePattern(token: string): RegExp {
	return new RegExp(`^${token.replace(/[^A-Z0-9*]/g, '').replace(/\*/g, '[A-Z0-9]*')}$`);
}

function timetableLines(context: Context): string[] {
	const lines = new Set(context.lines);
	for (const line of context.knownLines) {
		if (context.patterns.some((pattern) => pattern.test(line))) {
			lines.add(line);
		}
	}
	return [...lines].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
}

export function grenetteLines(): string[] {
	return parseLines(env.TCL_GRENETTE_LINES || DEFAULT_GRENETTE_LINES);
}

export function getTclStatus() {
	return ((globalThis as Record<string, unknown>)[SCHEDULER_KEY] as typeof status) ?? status;
}

export function startTclCollector(): void {
	if (env.TCL_COLLECT === 'false') {
		return;
	}
	const login = env.GRANDLYON_LOGIN;
	const password = env.GRANDLYON_PASSWORD;
	if (!login || !password) {
		console.log('[tcl] GRANDLYON_LOGIN / GRANDLYON_PASSWORD not set, collector disabled');
		return;
	}

	const scope = globalThis as Record<string, unknown>;
	if (scope[SCHEDULER_KEY]) {
		return;
	}
	scope[SCHEDULER_KEY] = status;

	const tokens = parseLines(env.TCL_LINES || DEFAULT_LINES);
	const lines = tokens.filter((token) => !token.includes('*'));
	const patterns = tokens.filter((token) => token.includes('*')).map(linePattern);
	const vmLineList = parseLines(env.TCL_VM_LINES || '*');
	const vmLines = vmLineList.includes('*') ? null : new Set([...vmLineList, ...lines]);
	const context: Context = {
		authorization: `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
		lines,
		patterns,
		vmLines,
		knownLines: new Set(),
	};
	status.enabled = true;
	status.startedAt = new Date().toISOString();
	status.dataDir = dataDir();
	status.lines = lines;
	status.vmLines = vmLines ? [...vmLines] : null;
	startDay();
	console.log(
		`[tcl] collecting et ${tokens.join(', ')} and vm ${vmLines ? [...vmLines].join(', ') : 'all lines'} into ${dataDir()}`,
	);
	schedule('vm', Number(env.TCL_VM_INTERVAL_S || 30) * 1000, context, pollVehicles);
	schedule('et', Number(env.TCL_ET_INTERVAL_S || 60) * 1000, context, pollTimetables);
	schedule('sx', 10 * 60_000, context, pollSituations);
	schedule('stops', 6 * 60 * 60_000, context, pollStops);
}
