import type { Feature } from 'geojson';

export type SpeedBucket = '5' | '30' | '50' | '70' | 'unknown';

export const SPEED_BUCKETS: SpeedBucket[] = ['5', '30', '50', '70', 'unknown'];

export const SPEED_BUCKET_LABELS: Record<SpeedBucket, string> = {
	'5': '≤5',
	'30': '≤30',
	'50': '50',
	'70': '70+',
	unknown: 'Inconnu',
};

export const SPEED_BUCKET_COLORS: Record<SpeedBucket, string> = {
	'5': '#648FFF',
	'30': '#785EF0',
	'50': '#FFB000',
	'70': '#ff0000',
	unknown: '#6b7280',
};

export function bucketForSpeed(raw: unknown): SpeedBucket {
	if (raw === undefined || raw === null || raw === '') return 'unknown';
	const n = Number(raw);
	if (!Number.isFinite(n)) return 'unknown';
	if (n <= 5) return '5';
	if (n <= 30) return '30';
	if (n <= 50) return '50';
	if (n >= 70) return '70';
	return 'unknown';
}

export type SpeedLimitsStats = Record<SpeedBucket, number>;

export function emptyStats(): SpeedLimitsStats {
	return { '5': 0, '30': 0, '50': 0, '70': 0, unknown: 0 };
}

export function computeSpeedLimitsStats(features: Feature[] | undefined): SpeedLimitsStats {
	const stats = emptyStats();
	if (!features) return stats;
	for (const feature of features) {
		const props = feature.properties ?? {};
		const bucket = bucketForSpeed(props.limitationvitesse);
		const length = Number(props.longueurcalculee) || 0;
		stats[bucket] += length;
	}
	return stats;
}

export interface Ville30Stats {
	bySpeedLimit: Record<string, { km: number; streets: number }>;
	totalStreets: number;
	totalKm: number;
	under30Km: number;
	under30KmPercentage: number;
	eligibleKm: number;
	eligibleUnder30Km: number;
	eligibleUnder30KmPercentage: number;
}

export function computeVille30Stats(features: Feature[] | undefined): Ville30Stats | null {
	if (!features || features.length === 0) {
		return null;
	}

	const bySpeedLimit: Record<string, { km: number; streets: number }> = {};
	let totalStreets = 0;
	let totalKm = 0;
	let under30Km = 0;
	let eligibleKm = 0;
	let eligibleUnder30Km = 0;

	for (const feature of features) {
		const props = (feature.properties ?? {}) as Record<string, unknown>;
		const rawSpeed = props.limitationvitesse;
		const speedKey =
			rawSpeed === undefined || rawSpeed === null || rawSpeed === '' ? 'unknown' : String(rawSpeed);
		const lengthKm = (Number(props.longueurcalculee) || 0) / 1000;

		if (!bySpeedLimit[speedKey]) {
			bySpeedLimit[speedKey] = { km: 0, streets: 0 };
		}
		bySpeedLimit[speedKey].km += lengthKm;
		bySpeedLimit[speedKey].streets += 1;

		totalStreets += 1;
		totalKm += lengthKm;

		const numericSpeed = parseInt(speedKey, 10);
		if (!Number.isNaN(numericSpeed) && numericSpeed <= 30) {
			under30Km += lengthKm;
		}

		const isEligible = !Number.isNaN(numericSpeed) && numericSpeed > 5 && numericSpeed < 70;
		if (isEligible) {
			eligibleKm += lengthKm;
			if (numericSpeed <= 30) {
				eligibleUnder30Km += lengthKm;
			}
		}
	}

	return {
		bySpeedLimit,
		totalStreets,
		totalKm,
		under30Km,
		under30KmPercentage: totalKm > 0 ? (under30Km / totalKm) * 100 : 0,
		eligibleKm,
		eligibleUnder30Km,
		eligibleUnder30KmPercentage: eligibleKm > 0 ? (eligibleUnder30Km / eligibleKm) * 100 : 0,
	};
}
