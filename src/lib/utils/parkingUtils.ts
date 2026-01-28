import type { FeatureCollection, Feature, Point } from 'geojson';
import { manualParkingData, type ManualParkingConfig } from '$lib/data/parking-config';

export interface ParkingProperties {
	gid: number;
	nom: string;
	adresse: string;
	commune: string;
	avancement: string;
	gestionnaire: string;
	mobiliervelo: string; // "Autre", "Box", "Consigne collective", "Consigne individuelle", "En U inversé", "Wilmotte"
	localisation: string;
	abrite: boolean;
	duree: string;
	nbarceaux: number | null;
	capacite: number;
	anneerealisation: number | null;
	validite: string;
	type: string;
	icon: string;
	observation: string;
}

// TODO: fix me
export function processParkingData(
	features: Feature<Point, any>[],
): FeatureCollection<Point, ParkingProperties> {
	const processedFeatures = features
		.filter((f) => f.properties.validite === 'Validé') // Filter out non-validated if needed, user said "Les stationnements vélo (représentés par des ronds verts)"
		.map((feature) => {
			const props = feature.properties;
			const gid = props.gid;
			const nom = props.nom;

			const manualConfig = manualParkingData[gid] || manualParkingData[nom];

			let type: string;
			let icon: string;

			const mv = props.mobiliervelo;
			const localisation = props.localisation;

			if (localisation === 'Parc relais en ouvrage') {
				type = 'velostation';
				icon = 'velostation';
			} else if (localisation === 'Parking en ouvrage') {
				type = 'lpa';
				icon = 'lpa';
			} else if (mv === 'Box' || mv === 'Consigne individuelle' || mv === 'Consigne collective') {
				type = 'box';
				icon = 'lock';
			} else if (props.abrite) {
				type = 'arceaux-couverts';
				icon = 'roof';
			} else {
				// Includes 'En U inversé', 'Wilmotte', 'Autre' and defaults
				type = 'arceaux';
				icon = 'circle';
			}

			if (manualConfig) {
				if (manualConfig.type) type = manualConfig.type;
				if (type === 'lpa-court') {
					icon = 'lpa';
				}
				if (type === 'longue-duree') {
					icon = 'secure';
				}
				if (type === 'velostation') {
					icon = 'velostation';
				}

				if (manualConfig.capacite !== undefined) {
					props.capacite = manualConfig.capacite;
				}
				if (manualConfig.nom !== undefined) {
					props.nom = manualConfig.nom;
				}
			}

			return {
				...feature,
				properties: {
					...props,
					type,
					icon,
				},
			};
		});

	return {
		type: 'FeatureCollection',
		features: processedFeatures,
	};
}

export function processLPAParkingData(
	features: Feature<Point, any>[],
): FeatureCollection<Point, ParkingProperties> {
	const processedFeatures = features
		.filter((f) => f.properties.capacitevelo > 0)
		.map((feature) => {
			const props = feature.properties;
			// Map specific properties for LPA parking
			const processedProps: ParkingProperties = {
				gid: props.gid,
				nom: props.nom,
				adresse: props.voieentree || props.voiesortie || '',
				commune: props.commune,
				avancement: props.avancement,
				gestionnaire: props.gestionnaire,
				mobiliervelo: 'LPA',
				localisation: props.situation,
				abrite: true, // Generally covered in LPA/P+R
				duree: props.typeparking,
				nbarceaux: null,
				capacite: props.capacitevelo,
				anneerealisation: null,
				validite: 'Validé',
				type: 'lpa',
				icon: 'lpa',
				observation: props.observation,
			};

			return {
				...feature,
				properties: processedProps,
			};
		});

	return {
		type: 'FeatureCollection',
		features: processedFeatures,
	};
}
