import type { Handle } from '@sveltejs/kit';

const ALLOWED_ORIGINS = new Set([
	'https://dazzling-gumdrop-a1bad4.netlify.app',
	'http://localhost:5173',
	'http://localhost:4173',
]);

const ALLOWED_ORIGIN_PATTERN = /^https:\/\/([a-z0-9-]+\.)*lavilleavelo\.org$/;

function corsOrigin(request: Request): string | null {
	const origin = request.headers.get('origin');
	if (!origin) {
		return null;
	}
	if (ALLOWED_ORIGINS.has(origin) || ALLOWED_ORIGIN_PATTERN.test(origin)) {
		return origin;
	}
	return null;
}

export const handle: Handle = async ({ event, resolve }) => {
	const isApi = event.url.pathname.startsWith('/api/');
	const allowOrigin = corsOrigin(event.request);

	if (isApi && event.request.method === 'OPTIONS') {
		const headers: Record<string, string> = {
			Vary: 'Origin',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': '*',
			'Access-Control-Max-Age': '86400',
		};

		if (allowOrigin) {
			headers['Access-Control-Allow-Origin'] = allowOrigin;
		}

		return new Response(null, { status: 204, headers });
	}

	const response = await resolve(event);

	if (isApi && allowOrigin) {
		response.headers.set('Access-Control-Allow-Origin', allowOrigin);
		response.headers.append('Vary', 'Origin');
	}

	return response;
};
