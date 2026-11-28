import { getTclDb } from './db';

const WFS_URL = 'https://data.grandlyon.com/geoserver/sytral/ows';
const LAYERS = ['sytral:tcl_sytral.tcllignebus_2_0_0', 'sytral:tcl_sytral.tcllignetram_2_0_0'];
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 10 * 60 * 1000;

type Position = [number, number];

export type RouteFeature = {
	type: 'Feature';
	properties: { line: string; direction: string; name: string };
	geometry:
		| { type: 'MultiLineString'; coordinates: Position[][] }
		| { type: 'LineString'; coordinates: Position[] };
};

export type RouteCollection = { type: 'FeatureCollection'; features: RouteFeature[] };

let lastFailureAt = 0;

function round(position: unknown): Position {
	const [lon, lat] = position as number[];
	return [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];
}

async function download(layer: string, lines: string[]): Promise<RouteFeature[]> {
	const params = new URLSearchParams({
		SERVICE: 'WFS',
		VERSION: '2.0.0',
		request: 'GetFeature',
		typename: layer,
		outputFormat: 'application/json',
		SRSNAME: 'EPSG:4326',
		CQL_FILTER: `ligne IN (${lines.map((line) => `'${line}'`).join(',')})`,
	});
	const response = await fetch(`${WFS_URL}?${params}`, {
		headers: { 'User-Agent': 'carte-velo-lyon' },
		signal: AbortSignal.timeout(30_000),
	});
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`);
	}
	const data = (await response.json()) as {
		features?: { properties?: Record<string, unknown>; geometry?: Record<string, unknown> }[];
	};
	const features: RouteFeature[] = [];
	for (const feature of data.features ?? []) {
		const properties = feature.properties ?? {};
		const geometry = feature.geometry ?? {};
		const line = String(properties.ligne ?? properties.code_ligne ?? '').toUpperCase();
		if (!line || !Array.isArray(geometry.coordinates)) {
			continue;
		}
		const base = {
			type: 'Feature' as const,
			properties: {
				line,
				direction: String(properties.sens ?? ''),
				name: String(properties.nom_trace ?? ''),
			},
		};
		if (geometry.type === 'MultiLineString') {
			features.push({
				...base,
				geometry: {
					type: 'MultiLineString',
					coordinates: (geometry.coordinates as unknown[][]).map((part) => part.map(round)),
				},
			});
		} else if (geometry.type === 'LineString') {
			features.push({
				...base,
				geometry: {
					type: 'LineString',
					coordinates: (geometry.coordinates as unknown[]).map(round),
				},
			});
		}
	}
	return features;
}

export async function getTclRoutes(lines: string[]): Promise<RouteCollection> {
	const db = getTclDb();
	const safe = lines.filter((line) => /^[A-Z0-9]+$/.test(line));
	if (safe.length === 0) {
		return { type: 'FeatureCollection', features: [] };
	}
	const rows = db
		.prepare(
			`SELECT line, fetched_at, features FROM routes WHERE line IN (${safe.map(() => '?').join(',')})`,
		)
		.all(...safe) as { line: string; fetched_at: number; features: string }[];
	const cached = new Map(rows.map((row) => [row.line, row]));
	const stale = safe.filter((line) => {
		const row = cached.get(line);
		return !row || Date.now() - row.fetched_at >= MAX_AGE_MS;
	});

	if (stale.length > 0 && Date.now() - lastFailureAt >= RETRY_MS) {
		try {
			const downloaded = (await Promise.all(LAYERS.map((layer) => download(layer, stale)))).flat();
			const upsert = db.prepare(
				`INSERT INTO routes (line, fetched_at, features) VALUES (?, ?, ?)
				 ON CONFLICT(line) DO UPDATE SET fetched_at = excluded.fetched_at, features = excluded.features`,
			);
			for (const line of stale) {
				const features = JSON.stringify(
					downloaded.filter((feature) => feature.properties.line === line),
				);
				upsert.run(line, Date.now(), features);
				cached.set(line, { line, fetched_at: Date.now(), features });
			}
		} catch (error) {
			lastFailureAt = Date.now();
			console.error('[tcl] routes download failed:', error);
		}
	}

	return {
		type: 'FeatureCollection',
		features: safe.flatMap((line) => {
			const row = cached.get(line);
			return row ? (JSON.parse(row.features) as RouteFeature[]) : [];
		}),
	};
}
