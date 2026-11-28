import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { liveVehicles } from '$lib/server/tcl/live';

export const GET: RequestHandler = () => {
	return json(liveVehicles(), { headers: { 'Cache-Control': 'no-store' } });
};
