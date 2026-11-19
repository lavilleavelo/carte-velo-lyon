import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadVelovForecastContext } from '$lib/server/velovForecast';
import { velovForecastMap } from '$lib/server/velovForecastMap';
import {
	VELOV_FORECAST_STEP_COUNT,
	type VelovForecastMap,
	type VelovForecastMapResponse,
} from '$lib/utils/velovForecast';

const MAX_STEPS = 12;

function respond(forecast: VelovForecastMap | null, maxAge: number) {
	return json({ forecast } satisfies VelovForecastMapResponse, {
		headers: { 'Cache-Control': `public, max-age=${maxAge}` },
	});
}

export const GET: RequestHandler = async ({ url }) => {
	const steps = (url.searchParams.get('steps') ?? '').split(',').map(Number);
	const valid = steps.every(
		(step) => Number.isInteger(step) && step >= 1 && step <= VELOV_FORECAST_STEP_COUNT,
	);
	if (!valid || steps.length > MAX_STEPS) {
		return json({ error: 'Invalid steps' }, { status: 400 });
	}

	try {
		const context = await loadVelovForecastContext();
		if (!context) {
			return respond(null, 60);
		}

		return respond(await velovForecastMap(context, steps), 120);
	} catch (error) {
		console.error('Error computing velov map forecast:', error);
		return respond(null, 60);
	}
};
