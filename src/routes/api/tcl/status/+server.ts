import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTclStatus } from '$lib/server/tcl/collector';

export const GET: RequestHandler = () => {
	return json(getTclStatus(), { headers: { 'Cache-Control': 'no-store' } });
};
