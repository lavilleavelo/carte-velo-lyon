import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'static/og/communes');
const INDEX_PATH = resolve(ROOT, 'src/lib/data/communes/_index.json');

const BASE_URL = process.env.OG_BASE_URL ?? 'http://localhost:5173';
const VIEWPORT = { width: 1200, height: 1050 };
const SETTLE_MS = 2500;
const CONCURRENCY = Number(process.env.OG_CONCURRENCY ?? 4);
const ONLY = process.argv.slice(2);

const communes = JSON.parse(await readFile(INDEX_PATH, 'utf8'));
const targets = ONLY.length ? communes.filter((c) => ONLY.includes(c.slug)) : communes;

await mkdir(OUT_DIR, { recursive: true });

console.log(`OG generator: ${targets.length} commune(s) → ${OUT_DIR}`);
console.log(`Base URL: ${BASE_URL} · concurrency: ${CONCURRENCY}`);

const OG_FONT_STACK = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

const OG_CSS = `
	.maplibregl-ctrl-top-left,
	.maplibregl-ctrl-top-right,
	.maplibregl-ctrl-bottom-left,
	.maplibregl-ctrl-bottom-right { display: none !important; }
	.og-card {
		position: absolute;
		top: 20px;
		left: 20px;
		z-index: 10;
		max-width: 420px;
		padding: 12px 18px;
		background: rgba(255, 255, 255, 0.96);
		border-radius: 12px;
		box-shadow: 0 6px 20px rgba(30, 58, 95, 0.18);
		font-family: ${OG_FONT_STACK};
		color: #1e3a5f;
		letter-spacing: -0.01em;
	}
	.og-card .og-name {
		font-weight: 700;
		font-size: 22px;
		line-height: 1.15;
	}
	.og-card .og-subtitle {
		margin-top: 2px;
		font-size: 11px;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.og-card .og-km {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid rgba(30, 58, 95, 0.12);
		font-weight: 700;
		font-size: 22px;
		font-variant-numeric: tabular-nums;
		color: #1e3a5f;
	}
	.og-card .og-km .og-km-label {
		display: inline;
		margin-right: 6px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #6b7280;
		vertical-align: 0.18em;
	}
	.og-brand {
		position: absolute;
		bottom: -3px;
		right: -3px;
		z-index: 10;
		height: 78px;
		width: auto;
	}
`;

const browser = await chromium.launch();

async function renderOne(page, { slug, name }) {
	const url = `${BASE_URL}/communes/${slug}?layers=osm-cycleways,vl&mapStyle=osm-eu`;
	const out = resolve(OUT_DIR, `${slug}.jpg`);
	await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
	await page.waitForSelector('.maplibregl-canvas', { timeout: 30_000 });
	await page.waitForTimeout(SETTLE_MS);
	const totalKm = await page.evaluate(() => {
		const legend = document.querySelector('.cycleway-legend-control');
		if (!legend) return null;
		const match = legend.textContent?.match(/(\d+(?:[.,]\d+)?)\s*km/i);
		return match ? `${match[1].replace('.', ',')} km` : null;
	});
	await page.addStyleTag({ content: OG_CSS });
	await page.evaluate(
		({ title, km }) => {
			const map = document.querySelector('.maplibregl-map');
			if (!map) return;
			map.querySelector('.og-card')?.remove();
			map.querySelector('.og-brand')?.remove();
			const card = document.createElement('div');
			card.className = 'og-card';
			card.innerHTML = `
				<div class="og-name">${title}</div>
				<div class="og-subtitle">Aménagements cyclables</div>
				${km ? `<div class="og-km"><span class="og-km-label">Total</span>${km}</div>` : ''}
			`;
			map.appendChild(card);
			const brand = document.createElement('img');
			brand.className = 'og-brand';
			brand.src = 'https://cyclopolis.lavilleavelo.org/logo-lvv-carte.png';
			brand.alt = 'La Ville à Vélo';
			map.appendChild(brand);
		},
		{ title: name, km: totalKm },
	);
	await page.waitForFunction(
		() => {
			const img = document.querySelector('.og-brand');
			return img && img.complete && img.naturalWidth > 0;
		},
		{ timeout: 10_000 },
	);
	const map = page.locator('.maplibregl-map').first();
	await map.screenshot({ path: out, type: 'jpeg', quality: 85 });
}

async function worker(workerId, queue, results) {
	const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
	const page = await context.newPage();
	while (queue.length) {
		const target = queue.shift();
		if (!target) break;
		try {
			await renderOne(page, target);
			console.log(`  [w${workerId}] ✓  ${target.slug.padEnd(30)} ${target.name}`);
			results.ok++;
		} catch (err) {
			console.log(`  [w${workerId}] ✗  ${target.slug.padEnd(30)} ${target.name} — ${err.message}`);
			results.failed++;
		}
	}
	await context.close();
}

const queue = [...targets];
const results = { ok: 0, failed: 0 };
const start = Date.now();

const workers = Array.from({ length: Math.min(CONCURRENCY, targets.length) }, (_, i) =>
	worker(i + 1, queue, results),
);
await Promise.all(workers);

await browser.close();

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\nDone in ${elapsed}s: ${results.ok} ok, ${results.failed} failed`);
process.exit(results.failed > 0 ? 1 : 0);
