import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadVelovForecastContext, velovStateOf } from '$lib/server/velovForecast';
import {
	VELOV_FORECAST_KINDS,
	type VelovForecast,
	type VelovForecastResponse,
	type VelovForecastSeries,
} from '$lib/utils/velovForecast';

const computed = new Map<number, { key: string; forecast: VelovForecast }>();

function rounded(series: VelovForecastSeries): VelovForecastSeries {
	const round = (values: number[]) => values.map((value) => Math.round(value * 1000) / 1000);
	return {
		q10: round(series.q10),
		q30: round(series.q30),
		q50: round(series.q50),
		q70: round(series.q70),
		q90: round(series.q90),
		p: round(series.p),
	};
}

function respond(forecast: VelovForecast | null, maxAge: number) {
	return json({ forecast } satisfies VelovForecastResponse, {
		headers: { 'Cache-Control': `public, max-age=${maxAge}` },
	});
}

export const GET: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) {
		return json({ error: 'Invalid station id' }, { status: 400 });
	}

	try {
		const context = await loadVelovForecastContext();
		const station = context?.stations.find((candidate) => candidate.number === id);

		if (!context || !station || station.status !== 'OPEN' || !context.model.knows(id)) {
			return respond(null, 60);
		}

		const { model, fetchedAt } = context;
		const key = `${model.version}:${fetchedAt}`;
		const held = computed.get(id);
		if (held?.key === key) {
			return respond(held.forecast, 120);
		}

		const state = velovStateOf(station);
		const series = model.forecast(id, state, fetchedAt);
		const forecast: VelovForecast = {
			version: model.version,
			origin: fetchedAt,
			state,
			coverage: model.coverage,
			series: Object.fromEntries(
				VELOV_FORECAST_KINDS.map((kind) => [kind, rounded(series[kind])]),
			) as VelovForecast['series'],
		};
		computed.set(id, { key, forecast });

		return respond(forecast, 120);
	} catch (error) {
		console.error('Error computing velov forecast:', error);
		return respond(null, 60);
	}
};
