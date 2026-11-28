import {
	directionOf,
	journeyKey,
	lineCode,
	parseDuration,
	recordedAt,
	stopIdOf,
	vehicleKey,
} from './siri';

const LATEST_KEY = '__carteVeloLyonTclLatestVehicles';

export type LiveVehicle = {
	id: string;
	line: string;
	direction: string;
	journey: string | null;
	lat: number;
	lon: number;
	bearing: number | null;
	delay: number | null;
	status: string | null;
	recordedAt: string;
	destination: number | null;
	stop: number | null;
};

export type LiveSnapshot = { receivedAt: string; vehicles: LiveVehicle[] };

function text(value: unknown): string | null {
	if (typeof value === 'string') {
		return value;
	}
	const inner = (value as { value?: unknown } | null)?.value;
	return typeof inner === 'string' ? inner : null;
}

export function compactVehicle(activity: Record<string, unknown>): LiveVehicle | null {
	const journey = (activity.MonitoredVehicleJourney ?? {}) as Record<string, unknown>;
	const location = (journey.VehicleLocation ?? {}) as Record<string, unknown>;
	const lat = Number(location.Latitude);
	const lon = Number(location.Longitude);
	const id = vehicleKey(activity);
	const line = lineCode(activity);
	const time = recordedAt(activity);
	if (!id || !line || !time || !Number.isFinite(lat) || !Number.isFinite(lon)) {
		return null;
	}
	const bearing = Number(journey.Bearing);
	const destination = text(journey.DestinationRef)?.match(/SP:(\d+):/)?.[1];
	return {
		id: id.replace(/^.*Vehicle:[^:]*:/, '').replace(/:[^:]*$/, ''),
		line,
		direction: directionOf(journey),
		journey: journeyKey(journey),
		lat: Math.round(lat * 1e5) / 1e5,
		lon: Math.round(lon * 1e5) / 1e5,
		bearing: Number.isFinite(bearing) ? bearing : null,
		delay: parseDuration(journey.Delay),
		status: typeof journey.VehicleStatus === 'string' ? journey.VehicleStatus : null,
		recordedAt: time,
		destination: destination ? Number(destination) : null,
		stop: stopIdOf((journey.MonitoredCall ?? {}) as Record<string, unknown>),
	};
}

export function setLatestVehicles(receivedAt: string, activities: Record<string, unknown>[]): void {
	const vehicles = activities
		.map(compactVehicle)
		.filter((vehicle): vehicle is LiveVehicle => vehicle !== null);
	(globalThis as Record<string, unknown>)[LATEST_KEY] = { receivedAt, vehicles };
}

export function getLatestVehicles(): LiveSnapshot | null {
	return ((globalThis as Record<string, unknown>)[LATEST_KEY] as LiveSnapshot | undefined) ?? null;
}
