/**
 * Utility functions for analyzing cyclable infrastructure data
 */

export interface CyclableFeature {
	properties: {
		nom?: string;
		commune1?: string;
		insee1?: string;
		commune2?: string | null;
		insee2?: string | null;
		reseau?: string;
		financementac?: string;
		typeamenagement?: string;
		typeamenagement2?: string | null;
		positionnement?: string;
		senscirculation?: string;
		environnement?: string;
		localisation?: string;
		typologiepiste?: string;
		revetementpiste?: string;
		domanialite?: string;
		reglementation?: string;
		zonecirculationapaisee?: string | null;
		anneelivraison?: number;
		longueur?: number;
		observation?: string | null;
		validite?: string;
		gid?: number;
	};
}

export const isSecureInfrastructure = (
	feature: CyclableFeature,
	{ isVille30 = false }: { isVille30?: boolean },
) => {
	const type = feature.properties.typeamenagement;
	const zone30 = feature.properties.zonecirculationapaisee;

	if (type === 'Piste Cyclable' || type === 'Voie verte') {
		return true;
	}

	if (type === 'Couloir bus vélo élargi') {
		return true;
	}

	if (type === 'Bande Cyclable') {
		return isVille30 ? true : zone30 !== null && zone30 !== '';
	}

	return false;
};

export function calculateSecureLength(
	features: CyclableFeature[],
	{ isVille30 = false } = {},
): number {
	return features
		.filter((f) => isSecureInfrastructure(f, { isVille30 }))
		.reduce((sum, feature) => sum + (Number(feature.properties.longueur) || 0), 0);
}

export function calculateSecureLengthPer1000Inhabitants(
	features: CyclableFeature[],
	population: number,
	{ isVille30 = false } = {},
): number {
	if (population === 0) return 0;
	const secureLength = calculateSecureLength(features, { isVille30 });
	// secureLength is in meters, divide by 1000 to get km, then divide by (population/1000)
	return secureLength / 1000 / (population / 1000);
}

export function getSecureLengthByType(
	features: CyclableFeature[],
	{ isVille30 = false } = {},
): Record<string, number> {
	return features
		.filter((f) => isSecureInfrastructure(f, { isVille30 }))
		.reduce(
			(acc, feature) => {
				const type = feature.properties.typeamenagement || 'Non spécifié';
				const length = Number(feature.properties.longueur) || 0;
				acc[type] = (acc[type] || 0) + length;
				return acc;
			},
			{} as Record<string, number>,
		);
}
