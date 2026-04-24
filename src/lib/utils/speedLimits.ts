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
