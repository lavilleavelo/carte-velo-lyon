import type { Feature } from 'geojson';

function haversine(a: [number, number], b: [number, number]): number {
	const R = 6_371_000;
	const lat1 = (a[1] * Math.PI) / 180;
	const lat2 = (b[1] * Math.PI) / 180;
	const dLat = ((b[1] - a[1]) * Math.PI) / 180;
	const dLng = ((b[0] - a[0]) * Math.PI) / 180;
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

function lineLengthMeters(coords: number[][]): number {
	let total = 0;
	for (let i = 1; i < coords.length; i++) {
		total += haversine(coords[i - 1] as [number, number], coords[i] as [number, number]);
	}
	return total;
}

export function featureLineLengthMeters(feature: Feature): number {
	const geom = feature.geometry;
	if (!geom) return 0;
	if (geom.type === 'LineString') return lineLengthMeters(geom.coordinates);
	if (geom.type === 'MultiLineString') {
		let total = 0;
		for (const line of geom.coordinates) total += lineLengthMeters(line);
		return total;
	}
	return 0;
}
