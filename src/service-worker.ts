// Disables access to DOM typings like `HTMLElement` which are not available
// inside a service worker and instantiates the correct globals
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Ensures that the `$service-worker` import has proper type definitions
/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const cacheName = `app-cache-${version}`;
const mapCacheName = 'map-cache-v1';
const appShell = '/';
const appShellRequest = new Request(appShell, { cache: 'reload' });
const assets = [...build, ...files];
const mapHosts = [
	'tiles.openfreemap.org',
	'openmaptiles.data.gouv.fr',
	'openmaptiles.geo.data.gouv.fr',
	'data.geopf.fr',
];

function isMapHost(hostname: string) {
	return (
		mapHosts.includes(hostname) ||
		hostname.endsWith('.openfreemap.org') ||
		hostname.endsWith('.tile-cyclosm.openstreetmap.fr')
	);
}

async function cacheMapRequest(request: Request) {
	const cache = await caches.open(mapCacheName);
	const cached = await cache.match(request);
	if (cached) return cached;

	try {
		const response = await fetch(request);
		if (response.ok || response.type === 'opaque') {
			await cache.put(request, response.clone());
		}
		return response;
	} catch {
		return cached ?? Response.error();
	}
}

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(cacheName)
			.then((cache) => cache.addAll([...assets, appShellRequest]))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key !== cacheName && key !== mapCacheName)
						.map((key) => caches.delete(key)),
				),
			),
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	if (isMapHost(url.hostname)) {
		event.respondWith(cacheMapRequest(event.request));
		return;
	}

	if (event.request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				const cache = await caches.open(cacheName);
				const cached =
					(await cache.match(event.request, { ignoreSearch: true })) ??
					(await cache.match(appShell));
				try {
					const response = await fetch(event.request);
					await cache.put(appShell, response.clone());
					return response;
				} catch {
					return cached ?? Response.error();
				}
			})(),
		);
		return;
	}

	if (url.origin !== self.location.origin) return;

	if (assets.includes(url.pathname)) {
		event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
		return;
	}

	event.respondWith(
		(async () => {
			try {
				const response = await fetch(event.request);
				const copy = response.clone();
				const cache = await caches.open(cacheName);
				await cache.put(event.request, copy);
				return response;
			} catch {
				const cached = await caches.match(event.request);
				return cached ?? Response.error();
			}
		})(),
	);
});
