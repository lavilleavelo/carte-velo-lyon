import type { FeatureCollection, Feature, Point } from 'geojson';
import { manualParkingData, type ManualParkingConfig } from '$lib/data/parking-config';

export interface ParkingProperties {
	gid: number;
	nom: string;
	adresse: string;
	commune: string;
	gestionnaire: string;
	mobiliervelo: string;
	localisation: string;
	abrite: boolean;
	nbarceaux: number | null;
	capacite: number;
	anneerealisation: number | null;
	validite: string;
	type: string;
	icon: string;
	observation: string;
}

export function processParkingData(
	features: Feature<Point, any>[],
): FeatureCollection<Point, ParkingProperties> {
	const processedFeatures = features
		.filter((f) => f.properties.validite === 'Validé')
		.map((feature) => {
			const props = feature.properties;
			const gid = props.gid;
			const nom = props.nom;

			const manualConfig = manualParkingData[gid] || manualParkingData[nom];

			let type: string;
			let icon: string;

			const mv = (props.mobiliervelo || '').toLowerCase();
			const localisation = props.localisation || '';

			if (mv === 'vélostation' || localisation === 'Parc relais en ouvrage') {
				type = 'velostation';
				icon = 'velostation';
			} else if (localisation === 'Parking en ouvrage') {
				type = 'lpa';
				icon = 'lpa';
			} else if (
				mv.includes('box') ||
				mv.includes('consigne') ||
				mv.includes('espace vélo sécurisé') ||
				mv.includes('local vélo sécurisé')
			) {
				type = 'box';
				icon = 'lock';
			} else if (props.abrite) {
				type = 'arceaux-couverts';
				icon = 'roof';
			} else {
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
			const processedProps: ParkingProperties = {
				gid: props.gid,
				nom: props.nom,
				adresse: props.voieentree || props.voiesortie || '',
				commune: props.commune,
				gestionnaire: props.gestionnaire,
				mobiliervelo: 'LPA',
				localisation: props.situation,
				abrite: true,
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
