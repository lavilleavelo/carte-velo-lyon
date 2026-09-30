import { createHash } from 'node:crypto';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { getCountersDb, transaction } from './db';
import type { EcoCounter } from './ecoCounter';

const PHOTOS_DIR = join(process.env.CACHE_DIR ?? '.cache', 'counter-photos');
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 30_000;
const CONCURRENCY = 4;
const THUMBNAIL_WIDTH = 480;
const THUMBNAIL_QUALITY = 75;
const FILE_PATTERN = /^[a-f0-9]{40}\.(jpg|png|webp)$/;
const CONTENT_TYPES: Record<string, string> = {
	jpg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
};
const STATE_KEY = 'photos_synced_at';

type Photo = { idPdc: number; position: number; url: string; file: string; thumbnail: string };

export type CounterPhoto = { file: string; thumbnail: string | null };

// Eco-Counter photo URLs never change content: the files are named after the URL
function fileNames(url: string): { file: string; thumbnail: string } {
	const hash = createHash('sha1').update(url).digest('hex');
	const extension = url.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
	return { file: `${hash}.${extension}`, thumbnail: `${hash}.webp` };
}

export function getPhotoFile(file: string): { path: string; contentType: string } | null {
	if (!FILE_PATTERN.test(file)) {
		return null;
	}
	return {
		path: join(PHOTOS_DIR, file),
		contentType: CONTENT_TYPES[file.split('.').pop()!],
	};
}

export function getCounterPhotos(idPdc: number): CounterPhoto[] {
	return getCountersDb()
		.prepare('SELECT file, thumbnail FROM counter_photos WHERE id_pdc = ? ORDER BY position')
		.all(idPdc) as CounterPhoto[];
}

async function download(photo: Photo): Promise<boolean> {
	try {
		const response = await fetch(photo.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		await writeFile(join(PHOTOS_DIR, photo.file), Buffer.from(await response.arrayBuffer()));
		return true;
	} catch (error) {
		console.warn(`[counters] photo ${photo.url} not cached: ${error}`);
		return false;
	}
}

async function createThumbnail(photo: Photo): Promise<boolean> {
	try {
		await sharp(join(PHOTOS_DIR, photo.file))
			.rotate()
			.resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
			.webp({ quality: THUMBNAIL_QUALITY })
			.toFile(join(PHOTOS_DIR, photo.thumbnail));
		return true;
	} catch (error) {
		console.warn(`[counters] thumbnail of ${photo.url} not created: ${error}`);
		return false;
	}
}

async function runWithConcurrency<T>(items: T[], fn: (item: T) => Promise<void>): Promise<void> {
	let next = 0;
	await Promise.all(
		Array.from({ length: CONCURRENCY }, async () => {
			while (next < items.length) {
				await fn(items[next++]);
			}
		}),
	);
}

// Downloads the new photos once a day, creates their thumbnails and removes the ones Eco-Counter
// no longer lists
export async function syncCounterPhotos(counters: EcoCounter[]): Promise<void> {
	const db = getCountersDb();
	const state = db.prepare('SELECT value FROM sync_state WHERE key = ?').get(STATE_KEY) as
		| { value: string }
		| undefined;
	if (state && Date.now() - Date.parse(state.value) < SYNC_INTERVAL_MS) {
		return;
	}

	await mkdir(PHOTOS_DIR, { recursive: true });
	const cached = new Set(await readdir(PHOTOS_DIR));
	const photos: Photo[] = counters.flatMap((counter) =>
		counter.photos.map((url, position) => ({
			idPdc: counter.idPdc,
			position,
			url,
			...fileNames(url),
		})),
	);

	const missing = photos.filter((photo) => !cached.has(photo.file));
	await runWithConcurrency(missing, async (photo) => {
		if (await download(photo)) {
			cached.add(photo.file);
		}
	});

	const available = photos.filter((photo) => cached.has(photo.file));
	const withoutThumbnail = available.filter((photo) => !cached.has(photo.thumbnail));
	await runWithConcurrency(withoutThumbnail, async (photo) => {
		if (await createThumbnail(photo)) {
			cached.add(photo.thumbnail);
		}
	});

	const insert = db.prepare(
		'INSERT INTO counter_photos (id_pdc, position, url, file, thumbnail) VALUES (?, ?, ?, ?, ?)',
	);
	transaction(db, () => {
		db.exec('DELETE FROM counter_photos');
		for (const photo of available) {
			const thumbnail = cached.has(photo.thumbnail) ? photo.thumbnail : null;
			insert.run(photo.idPdc, photo.position, photo.url, photo.file, thumbnail);
		}
		db.prepare(
			'INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
		).run(STATE_KEY, new Date().toISOString());
	});

	const used = new Set(available.flatMap((photo) => [photo.file, photo.thumbnail]));
	for (const file of cached) {
		if (!used.has(file) && FILE_PATTERN.test(file)) {
			await rm(join(PHOTOS_DIR, file), { force: true });
		}
	}
	console.log(
		`[counters] ${available.length} photos cached (${missing.length} downloaded, ${withoutThumbnail.length} thumbnails created)`,
	);
}
