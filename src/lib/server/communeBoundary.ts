import type { Feature, FeatureCollection, Geometry } from 'geojson';
import communesGeoJSON from '$lib/data/communes_limit_arrondissements.json';
import { LYON_ARRONDISSEMENT_INSEE, isLyonAggregateInsee } from '$lib/config/lyon';

const features = communesGeoJSON.features as unknown as Feature<Geometry>[];

export const featureByInsee: ReadonlyMap<string, Feature<Geometry>> = (() => {
	const map = new Map<string, Feature<Geometry>>();
	for (const f of features) {
		const insee = (f.properties as { insee?: string } | null)?.insee;
		if (insee) {
			map.set(insee, f);
		}
	}
	return map;
})();

export function expandInsee(insee: string): readonly string[] {
	return isLyonAggregateInsee(insee) ? LYON_ARRONDISSEMENT_INSEE : [insee];
}

export function buildBoundary(insees: readonly string[]): FeatureCollection | null {
	const matched = insees
		.map((i) => featureByInsee.get(i))
		.filter((f): f is Feature<Geometry> => Boolean(f));

	if (matched.length === 0) {
		return null;
	}

	return { type: 'FeatureCollection', features: matched };
}

export function getCommuneBoundary(insee: string): FeatureCollection | null {
	return buildBoundary(expandInsee(insee));
}
