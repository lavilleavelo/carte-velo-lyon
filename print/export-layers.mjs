// Exports the GeoJSON of the map layers visible by default, as the running app renders them.
// Usage: node print/export-layers.mjs [http://localhost:5173]
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.argv[2] ?? 'http://localhost:5173';
const outDir = join(dirname(fileURLToPath(import.meta.url)), 'out', 'data');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 120_000 });

// The map instance is not exposed: patch the prototype of the module Vite served and wait for a frame.
const sources = await page.evaluate(async () => {
	const url = performance
		.getEntriesByType('resource')
		.map((e) => e.name)
		.find((n) => n.includes('/maplibre-gl.js'));
	const mod = await import(url);
	const MapClass = mod.Map ?? mod.default.Map;
	let map;
	const render = MapClass.prototype._render;
	MapClass.prototype._render = function (...args) {
		map = this;
		return render.apply(this, args);
	};
	const deadline = Date.now() + 60_000;
	while (!map && Date.now() < deadline) {
		window.dispatchEvent(new Event('resize'));
		await new Promise((r) => setTimeout(r, 250));
	}
	if (!map) throw new Error('map instance not found');

	const wanted = (id) =>
		id === 'osm-cycleways-source' ||
		id === 'parking-source' ||
		id === 'metropole-boundary' ||
		/^vl-\d+-(shield-)?source$/.test(id);
	const waitFor = async () => {
		while (Date.now() < deadline) {
			const style = map.getStyle();
			const ids = Object.keys(style.sources).filter(wanted);
			const ready = ids.length >= 27 && ids.every((id) => style.sources[id].data?.features?.length);
			if (ready) return style;
			await new Promise((r) => setTimeout(r, 500));
		}
		throw new Error('sources did not load');
	};
	const style = await waitFor();
	return Object.fromEntries(
		Object.entries(style.sources)
			.filter(([id]) => wanted(id))
			.map(([id, s]) => [id, s.data]),
	);
});
await browser.close();

await mkdir(outDir, { recursive: true });

const fc = (features) => ({ type: 'FeatureCollection', features });
const files = {
	'cycleways.geojson': sources['osm-cycleways-source'],
	'parkings.geojson': fc(
		sources['parking-source'].features.filter((f) =>
			['velostation', 'lpa'].includes(f.properties?.type),
		),
	),
	'metropole-boundary.geojson': sources['metropole-boundary'],
	// One file for all Voies Lyonnaises, keeping only the built sections like the map does.
	'vl-lines.geojson': fc(
		Object.entries(sources)
			.filter(([id]) => /^vl-\d+-source$/.test(id))
			.flatMap(([id, data]) =>
				data.features
					.filter((f) => f.properties?.status === 'done')
					.map((f) => ({ ...f, properties: { ...f.properties, vl: Number(id.split('-')[1]) } })),
			),
	),
	'vl-shields.geojson': fc(
		Object.entries(sources)
			.filter(([id]) => /^vl-\d+-shield-source$/.test(id))
			.flatMap(([id, data]) =>
				data.features
					.filter((f) => f.properties?.status === 'done')
					.map((f) => ({ ...f, properties: { ...f.properties, vl: Number(id.split('-')[1]) } })),
			),
	),
};

for (const [name, data] of Object.entries(files)) {
	await writeFile(join(outDir, name), JSON.stringify(data));
	console.log(`${name}: ${data.features.length} features`);
}
