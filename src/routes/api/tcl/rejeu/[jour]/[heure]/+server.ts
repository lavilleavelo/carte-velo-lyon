import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { todayInParis } from '$lib/server/counters/calendar';
import { readReplay } from '$lib/server/tcl/replay';

export const GET: RequestHandler = async ({ params }) => {
	const hour = Number(params.heure);
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(params.jour) ||
		!Number.isInteger(hour) ||
		hour < 0 ||
		hour > 23
	) {
		error(400, 'jour ou heure invalide');
	}
	const body = await readReplay(params.jour, hour);
	if (!body) {
		error(404, 'pas de rejeu pour cette heure');
	}
	return new Response(new Uint8Array(body), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Encoding': 'gzip',
			'Cache-Control': params.jour < todayInParis() ? 'public, max-age=86400' : 'no-store',
		},
	});
};
