import { SvelteMap } from 'svelte/reactivity';
import {
	VELOV_FORECAST_STEP_COUNT,
	fetchVelovForecastSteps,
	type VelovForecastKind,
} from './velovForecast';

const BATCH_SIZE = 6;
const MAX_AGE_MS = 10 * 60_000;

export type VelovSimulationFrame = {
	kind: VelovForecastKind;
	ranks: Map<number, number>;
	values: number[];
};

export type VelovSimulation = ReturnType<typeof createVelovSimulation>;

export function createVelovSimulation() {
	const loaded = new SvelteMap<number, number[]>();
	let active = $state(false);
	let step = $state(4);
	let kind = $state<VelovForecastKind>('velos');
	let origin = $state(0);
	let unavailable = $state(false);
	let ranks = $state.raw(new Map<number, number>());
	let filling = false;
	let loadedAt = 0;
	let run = 0;
	let shown: number[] | null = null;

	function reset() {
		run += 1;
		filling = false;
		loaded.clear();
		origin = 0;
		shown = null;
		unavailable = false;
	}

	function nextBatch(): number[] {
		const aim = Math.max(1, step);
		const missing: number[] = [];
		for (let candidate = 1; candidate <= VELOV_FORECAST_STEP_COUNT; candidate += 1) {
			if (!loaded.has(candidate)) {
				missing.push(candidate);
			}
		}
		missing.sort((a, b) => Math.abs(a - aim) - Math.abs(b - aim) || b - a);

		return missing.slice(0, loaded.has(aim) ? BATCH_SIZE : 1);
	}

	async function fill() {
		if (filling || !active) {
			return;
		}

		const token = run;
		filling = true;
		try {
			while (token === run && active) {
				const batch = nextBatch();
				if (batch.length === 0) {
					break;
				}

				const data = await fetchVelovForecastSteps(batch);
				if (token !== run) {
					return;
				}

				if (!data) {
					unavailable = true;
					break;
				}

				if (data.origin !== origin) {
					loaded.clear();
					origin = data.origin;
					ranks = new Map(data.ids.map((id, rank) => [id, rank]));
					loadedAt = Date.now();
				}
				for (const [key, values] of Object.entries(data.steps)) {
					loaded.set(Number(key), values);
				}
			}
		} catch {
			if (token === run) {
				unavailable = true;
			}
		} finally {
			if (token === run) {
				filling = false;
			}
		}
	}

	function ensure() {
		if (!active) {
			return;
		}

		if (loadedAt && Date.now() - loadedAt > MAX_AGE_MS) {
			loadedAt = 0;
			reset();
		}
		void fill();
	}

	const frame = $derived.by<VelovSimulationFrame | null>(() => {
		if (!active || step === 0) {
			return null;
		}

		shown = loaded.get(step) ?? shown;
		return shown ? { kind, ranks, values: shown } : null;
	});

	return {
		get active() {
			return active;
		},
		set active(value: boolean) {
			active = value;
			unavailable = false;
			ensure();
		},
		get step() {
			return step;
		},
		set step(value: number) {
			step = value;
			ensure();
		},
		get kind() {
			return kind;
		},
		set kind(value: VelovForecastKind) {
			kind = value;
		},
		get origin() {
			return origin;
		},
		get unavailable() {
			return unavailable;
		},
		get progress() {
			return loaded.size / VELOV_FORECAST_STEP_COUNT;
		},
		get frame() {
			return frame;
		},
	};
}
