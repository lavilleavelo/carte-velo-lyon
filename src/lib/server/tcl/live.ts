import { getTclDb } from './db';
import { getLatestVehicles, type LiveVehicle } from './vehicles';

const NAMES_TTL_MS = 60 * 60 * 1000;

let names: { at: number; map: Map<number, string> } | null = null;

function stopNames(): Map<number, string> {
	if (!names || Date.now() - names.at > NAMES_TTL_MS) {
		const rows = getTclDb().prepare('SELECT id, name FROM gtfs_stops').all() as {
			id: number;
			name: string;
		}[];
		const fallback = getTclDb().prepare('SELECT id, name FROM stops').all() as {
			id: number;
			name: string;
		}[];
		const map = new Map<number, string>();
		for (const row of [...fallback, ...rows]) {
			map.set(row.id, row.name);
		}
		names = { at: Date.now(), map };
	}
	return names.map;
}

export type LiveVehicleView = Omit<LiveVehicle, 'journey'> & {
	destinationName: string | null;
	stopName: string | null;
};

export function liveVehicles(): { receivedAt: string | null; vehicles: LiveVehicleView[] } {
	const snapshot = getLatestVehicles();
	if (!snapshot) {
		return { receivedAt: null, vehicles: [] };
	}
	const map = stopNames();
	return {
		receivedAt: snapshot.receivedAt,
		vehicles: snapshot.vehicles.map((vehicle) => ({
			id: vehicle.id,
			line: vehicle.line,
			direction: vehicle.direction,
			lat: vehicle.lat,
			lon: vehicle.lon,
			bearing: vehicle.bearing,
			delay: vehicle.delay,
			status: vehicle.status,
			recordedAt: vehicle.recordedAt,
			destination: vehicle.destination,
			stop: vehicle.stop,
			destinationName: vehicle.destination === null ? null : (map.get(vehicle.destination) ?? null),
			stopName: vehicle.stop === null ? null : (map.get(vehicle.stop) ?? null),
		})),
	};
}
