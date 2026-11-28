#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '.cache/tcl');
const LINES = (process.env.TCL_LINES ?? 'TB11,C13,C14,C18')
	.split(',')
	.map((l) => l.trim().toUpperCase());

const FEEDS = {
	vm: 'https://data.grandlyon.com/siri-lite/2.0/vehicle-monitoring.json',
	et: 'https://data.grandlyon.com/siri-lite/2.0/estimated-timetables.json',
	sx: 'https://data.grandlyon.com/siri-lite/2.0/situation-exchange.json',
	passages:
		'https://data.grandlyon.com/fr/datapusher/ws/rdata/tcl_sytral.tclpassagearret/all.json?maxfeatures=200000',
};

const login = process.env.GRANDLYON_LOGIN;
const password = process.env.GRANDLYON_PASSWORD;
if (!login || !password) {
	console.error('GRANDLYON_LOGIN et GRANDLYON_PASSWORD manquants (node --env-file=.env …)');
	process.exit(1);
}
const headers = {
	Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
	'User-Agent': 'carte-velo-lyon',
};

async function get(url) {
	const start = performance.now();
	const response = await fetch(url, { headers, signal: AbortSignal.timeout(120_000) });
	const body = Buffer.from(await response.arrayBuffer());
	return { status: response.status, body, seconds: (performance.now() - start) / 1000 };
}

function keyPaths(node, prefix = '', depth = 0, seen = new Set()) {
	if (depth > 8) return seen;
	if (Array.isArray(node)) {
		if (node.length > 0) keyPaths(node[0], `${prefix}[]`, depth + 1, seen);
	} else if (node && typeof node === 'object') {
		for (const [key, value] of Object.entries(node)) {
			const path = prefix ? `${prefix}.${key}` : key;
			seen.add(path);
			keyPaths(value, path, depth + 1, seen);
		}
	}
	return seen;
}

function* objectsWithKey(node, key) {
	const stack = [node];
	while (stack.length > 0) {
		const current = stack.pop();
		if (Array.isArray(current)) {
			stack.push(...current);
		} else if (current && typeof current === 'object') {
			if (key in current) yield current;
			for (const [k, value] of Object.entries(current)) {
				if (k !== key) stack.push(value);
			}
		}
	}
}

function journeys(data, feed) {
	const key = feed === 'vm' ? 'VehicleActivity' : 'EstimatedVehicleJourney';
	return [...objectsWithKey(data, key)].flatMap((o) => [o[key]].flat());
}

function strings(value) {
	if (typeof value === 'string') return [value];
	if (Array.isArray(value)) return value.flatMap(strings);
	if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
	return [];
}

function lineRef(journey) {
	const trip = journey.MonitoredVehicleJourney ?? journey;
	return strings(trip.LineRef).join(' | ');
}

function lineTokens(journey) {
	const trip = journey.MonitoredVehicleJourney ?? journey;
	return new Set(
		[...strings(trip.LineRef), ...strings(trip.PublishedLineName)].flatMap((s) =>
			s
				.toUpperCase()
				.split(/[^A-Z0-9]+/)
				.filter(Boolean),
		),
	);
}

await mkdir(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

for (const [feed, url] of Object.entries(FEEDS)) {
	console.log(`\n=== ${feed} ${url}`);
	let result;
	try {
		result = await get(url);
	} catch (error) {
		console.log('  échec', error);
		continue;
	}
	console.log(
		`  HTTP ${result.status}, ${(result.body.length / 1e6).toFixed(2)} Mo, ${result.seconds.toFixed(1)} s`,
	);
	if (result.status === 401 || result.status === 403) {
		console.log('  accès refusé : identifiant, mot de passe API ou droits sur le jeu de données');
		continue;
	}
	await writeFile(resolve(OUT_DIR, `${feed}-${stamp}.json.gz`), gzipSync(result.body));
	let data;
	try {
		data = JSON.parse(result.body.toString('utf8'));
	} catch {
		console.log('  pas du JSON :', result.body.subarray(0, 300).toString());
		continue;
	}
	const paths = [...keyPaths(data)].sort();
	console.log(`  clés (${paths.length}) :`);
	for (const path of paths.slice(0, 120)) console.log('   ', path);
	if (feed === 'vm' || feed === 'et') {
		const all = journeys(data, feed);
		const kept = all.filter((j) => LINES.some((line) => lineTokens(j).has(line)));
		const refs = [...new Set(all.map(lineRef))].sort();
		console.log(`  courses : ${all.length}, dont ${kept.length} sur ${LINES.join(', ')}`);
		console.log(`  LineRef (${refs.length}) :`, refs.slice(0, 20));
		const perLine = Object.fromEntries(
			LINES.map((line) => [line, kept.filter((j) => lineTokens(j).has(line)).length]),
		);
		console.log('  par ligne :', perLine);
		if (kept.length > 0) {
			console.log('  exemple :', JSON.stringify(kept[0]).slice(0, 2500));
			const ref = strings((kept[0].MonitoredVehicleJourney ?? kept[0]).LineRef)[0];
			if (ref) {
				const filtered = await get(`${url}?${new URLSearchParams({ LineRef: ref })}`);
				let count = '?';
				try {
					count = journeys(JSON.parse(filtered.body.toString('utf8')), feed).length;
				} catch {}
				console.log(
					`  filtre LineRef=${ref} : HTTP ${filtered.status}, ${(filtered.body.length / 1e6).toFixed(2)} Mo, ${count} courses`,
				);
			}
		}
	} else if (feed === 'passages') {
		const rows = data.values ?? data.results ?? [];
		console.log(`  lignes : ${rows.length}, nb_results ${data.nb_results ?? '?'}`);
		if (rows.length > 0) console.log('  exemple :', JSON.stringify(rows[0]));
	} else {
		console.log('  extrait :', JSON.stringify(data).slice(0, 1500));
	}
}
