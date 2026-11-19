import { Worker } from 'node:worker_threads';
import source from './velovForecastKernel.ts?thread';
import {
	VELOV_FORECAST_THREAD,
	type VelovForecastPlan,
	type VelovForecastStation,
	type VelovForecastThreadReply,
	type VelovForecastThreadRequest,
} from './velovForecastKernel';

const IDLE_MS = 2 * 60_000;
const RETRY_MS = 60_000;
const JOB_TIMEOUT_MS = 20_000;

type Job = {
	resolve: (ranges: number[][]) => void;
	reject: (error: Error) => void;
	timeout: NodeJS.Timeout;
};

type Thread = {
	worker: Worker;
	plan: VelovForecastPlan | null;
	jobs: Map<number, Job>;
	idle: NodeJS.Timeout | null;
};

let thread: Thread | null = null;
let retryAt = 0;
let lastJob = 0;

function stop(target: Thread, error: Error | null) {
	if (thread === target) {
		thread = null;
		if (error) {
			retryAt = Date.now() + RETRY_MS;
		}
	}

	if (target.idle) {
		clearTimeout(target.idle);
	}
	for (const job of target.jobs.values()) {
		clearTimeout(job.timeout);
		job.reject(error ?? new Error('Velov forecast thread stopped'));
	}
	target.jobs.clear();
	void target.worker.terminate();
}

function rest(target: Thread) {
	if (target.idle) {
		clearTimeout(target.idle);
	}
	target.idle =
		target.jobs.size === 0 ? setTimeout(() => stop(target, null), IDLE_MS).unref() : null;
}

function start(): Thread {
	const worker = new Worker(
		new URL(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`),
		{ name: VELOV_FORECAST_THREAD, workerData: VELOV_FORECAST_THREAD },
	);
	const started: Thread = { worker, plan: null, jobs: new Map(), idle: null };

	worker.on('message', (reply: VelovForecastThreadReply) => {
		const job = started.jobs.get(reply.id);
		if (!job) {
			return;
		}

		started.jobs.delete(reply.id);
		clearTimeout(job.timeout);
		rest(started);
		if (reply.ranges) {
			job.resolve(reply.ranges);
		} else {
			job.reject(new Error(reply.error));
		}
	});
	worker.on('error', (error) => stop(started, error));
	worker.on('exit', () => stop(started, new Error('Velov forecast thread exited')));
	worker.unref();

	return started;
}

export function velovForecastThreadReady(): boolean {
	return Date.now() >= retryAt;
}

export function velovForecastThreadRanges(
	plan: VelovForecastPlan,
	stations: VelovForecastStation[],
	originMs: number,
	steps: number[],
): Promise<number[][]> {
	return new Promise((resolve, reject) => {
		try {
			thread ??= start();
			const target = thread;
			const send = (request: VelovForecastThreadRequest) => target.worker.postMessage(request);

			if (target.plan !== plan) {
				send({ plan });
				target.plan = plan;
			}

			lastJob += 1;
			const timeout = setTimeout(
				() => stop(target, new Error('Velov forecast thread timed out')),
				JOB_TIMEOUT_MS,
			).unref();
			target.jobs.set(lastJob, { resolve, reject, timeout });
			rest(target);
			send({ id: lastJob, stations, originMs, steps });
		} catch (error) {
			if (thread) {
				stop(thread, error as Error);
			} else {
				retryAt = Date.now() + RETRY_MS;
			}
			reject(error);
		}
	});
}
