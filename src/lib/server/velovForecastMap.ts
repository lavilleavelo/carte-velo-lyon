import { setImmediate as breathe } from 'node:timers/promises';
import { VELOV_FORECAST_STEP_COUNT, type VelovForecastMap } from '$lib/utils/velovForecast';
import { velovStateOf, type VelovForecastContext } from './velovForecast';
import type { VelovForecastStation } from './velovForecastKernel';
import type { VelovForecastModel } from './velovForecastModel';
import { velovForecastThreadRanges, velovForecastThreadReady } from './velovForecastWorker';

const BATCH_SIZE = 8;

type Reading = {
	key: string;
	model: VelovForecastModel;
	origin: number;
	stations: VelovForecastStation[];
	ids: number[];
	steps: Map<number, number[]>;
	waiters: Map<number, PromiseWithResolvers<number[]>>;
	focus: number;
	filling: boolean;
	pumping: boolean;
};

let latest: Reading | null = null;

function readingOf({ model, stations, fetchedAt }: VelovForecastContext): Reading {
	const key = `${model.version}:${fetchedAt}`;
	if (latest?.key !== key) {
		const open = stations
			.filter((station) => station.status === 'OPEN' && model.knows(station.number))
			.map((station) => ({ id: station.number, state: velovStateOf(station) }));
		latest = {
			key,
			model,
			origin: fetchedAt,
			stations: open,
			ids: open.map((station) => station.id),
			steps: new Map(),
			waiters: new Map(),
			focus: 1,
			filling: true,
			pumping: false,
		};
	}

	return latest;
}

function nextBatch(reading: Reading): number[] {
	const candidates = [...reading.waiters.keys()];
	if (
		candidates.length === 0 &&
		reading === latest &&
		reading.filling &&
		velovForecastThreadReady()
	) {
		for (let step = 1; step <= VELOV_FORECAST_STEP_COUNT; step += 1) {
			if (!reading.steps.has(step)) {
				candidates.push(step);
			}
		}
	}

	return candidates
		.sort((a, b) => Math.abs(a - reading.focus) - Math.abs(b - reading.focus) || b - a)
		.slice(0, BATCH_SIZE)
		.sort((a, b) => a - b);
}

async function compute(reading: Reading, steps: number[]): Promise<[number, number[]][]> {
	const { model, stations, origin } = reading;

	if (velovForecastThreadReady()) {
		try {
			const ranges = await velovForecastThreadRanges(model.plan, stations, origin, steps);
			return steps.map((step, rank) => [step, ranges[rank]]);
		} catch (error) {
			reading.filling = false;
			console.error('Velov forecast thread failed, computing on the main thread:', error);
		}
	}

	const out: [number, number[]][] = [];
	for (const step of steps) {
		if (reading.waiters.has(step)) {
			out.push([step, model.rangesAt(stations, origin, [step])[0]]);
			await breathe();
		}
	}

	return out;
}

async function pump(reading: Reading) {
	if (reading.pumping) {
		return;
	}

	reading.pumping = true;
	try {
		for (let batch = nextBatch(reading); batch.length > 0; batch = nextBatch(reading)) {
			for (const [step, ranges] of await compute(reading, batch)) {
				reading.steps.set(step, ranges);
				reading.waiters.get(step)?.resolve(ranges);
				reading.waiters.delete(step);
			}
		}
	} catch (error) {
		reading.filling = false;
		for (const waiter of reading.waiters.values()) {
			waiter.reject(error);
		}
		reading.waiters.clear();
	} finally {
		reading.pumping = false;
	}
}

export async function velovForecastMap(
	context: VelovForecastContext,
	steps: number[],
): Promise<VelovForecastMap> {
	const reading = readingOf(context);
	const pending = steps.map((step) => {
		const ranges = reading.steps.get(step);
		if (ranges) {
			return ranges;
		}

		let waiter = reading.waiters.get(step);
		if (!waiter) {
			waiter = Promise.withResolvers<number[]>();
			reading.waiters.set(step, waiter);
		}

		return waiter.promise;
	});

	reading.focus = steps[0];
	void pump(reading);
	const ranges = await Promise.all(pending);

	return {
		version: reading.model.version,
		origin: reading.origin,
		ids: reading.ids,
		steps: Object.fromEntries(steps.map((step, rank) => [step, ranges[rank]])),
	};
}
