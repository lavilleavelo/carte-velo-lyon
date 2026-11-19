import { getCachedVelovForecastFiles, getCachedVelovStations } from './cache';
import { VelovForecastModel, type VelovForecastBundle } from './velovForecastModel';
import type { VelovForecastState } from '$lib/utils/velovForecast';

const MAX_VERIFIED_AGE_MS = 21 * 86_400_000;
const MAX_STATE_AGE_MS = 20 * 60_000;

type RawStands = {
	availabilities?: {
		bikes?: number;
		stands?: number;
		mechanicalBikes?: number;
		electricalBikes?: number;
	};
	capacity?: number;
};

export type VelovRawStation = {
	number: number;
	status?: string;
	bike_stands?: number;
	available_bike_stands?: number;
	available_bikes?: number;
	total_stands?: RawStands | null;
	main_stands?: RawStands | null;
};

export type VelovForecastContext = {
	model: VelovForecastModel;
	stations: VelovRawStation[];
	fetchedAt: number;
};

const models = new WeakMap<VelovForecastBundle, VelovForecastModel | null>();

function modelFor(bundle: VelovForecastBundle): VelovForecastModel | null {
	if (!models.has(bundle)) {
		try {
			models.set(bundle, new VelovForecastModel(bundle));
		} catch (error) {
			console.error('Unusable velov forecast model:', error);
			models.set(bundle, null);
		}
	}

	return models.get(bundle) ?? null;
}

export function velovStateOf(station: VelovRawStation): VelovForecastState {
	const available =
		station.total_stands?.availabilities ?? station.main_stands?.availabilities ?? {};
	const elec = Number(available.electricalBikes ?? 0);
	const mechanical = Number(available.mechanicalBikes ?? 0);
	const bikes = Number(available.bikes ?? station.available_bikes ?? 0);

	return {
		elec,
		meca: mechanical > 0 ? mechanical : Math.max(0, bikes - elec),
		docks: Number(available.stands ?? station.available_bike_stands ?? 0),
		capacity: Number(station.total_stands?.capacity ?? station.bike_stands ?? 0),
	};
}

export async function loadVelovForecastContext(): Promise<VelovForecastContext | null> {
	const [files, stations] = await Promise.all([
		getCachedVelovForecastFiles(),
		getCachedVelovStations(),
	]);
	const verified =
		files.index.version === files.model.version &&
		Date.now() - files.index.verifie * 1000 < MAX_VERIFIED_AGE_MS;
	const model = verified ? modelFor(files.model) : null;

	if (!model || Date.now() - stations.fetchedAt > MAX_STATE_AGE_MS) {
		return null;
	}

	return {
		model,
		stations: (stations.data as { values?: VelovRawStation[] }).values ?? [],
		fetchedAt: stations.fetchedAt,
	};
}
