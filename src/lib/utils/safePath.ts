// copied from veloscore (src/routes/[commune]/villes-plus/safe-path.ts)

export interface SafetyReason {
	isSafe: boolean;
	reason: string;
	relevantTags: string[];
	condition?: string;
}

const unsafeRoadTypes: Record<string, string> = {
	tertiary: 'Route tertiaire sans aménagement cyclable',
	unclassified: 'Route non classifiée, sans aménagement cyclable',
	residential: 'Rue résidentielle sans aménagement',
	primary_link: 'Bretelle de route principale',
	secondary_link: 'Bretelle de route secondaire',
	trunk_link: 'Bretelle de voie rapide',
};

const unsafeRoad: Record<string, string> = {
	tertiary: 'route tertiaire',
	unclassified: 'route non classifiée',
	residential: 'rue résidentielle',
	primary_link: 'bretelle de route principale',
	secondary_link: 'bretelle de route secondaire',
	trunk_link: 'bretelle de voie rapide',
};

export function isSafePath(tags: Record<string, string>): SafetyReason {
	if (
		tags['bicycle'] !== 'designated' &&
		(tags['highway'] === 'primary' ||
			tags['highway'] === 'secondary' ||
			tags['highway'] === 'trunk')
	) {
		const roadTypes: Record<string, string> = {
			primary: 'route principale',
			secondary: 'route secondaire',
			trunk: 'voie rapide',
		};
		return {
			isSafe: false,
			reason: `${roadTypes[tags['highway']] || 'Route majeure'} sans aménagement cyclable`,
			relevantTags: ['highway', 'bicycle'],
			condition: `highway=${tags['highway']} ET bicycle≠designated`,
		};
	}

	if (tags['highway'] === 'cycleway') {
		return {
			isSafe: true,
			reason: 'Piste cyclable dédiée',
			relevantTags: ['highway'],
			condition: 'highway=cycleway',
		};
	}

	if (tags['highway'] === 'living_street') {
		return {
			isSafe: true,
			reason: 'Zone de rencontre',
			relevantTags: ['highway'],
			condition: 'highway=living_street',
		};
	}

	if (tags['cycleway'] === 'track') {
		return {
			isSafe: true,
			reason: 'Piste cyclable séparée',
			relevantTags: ['cycleway'],
			condition: 'cycleway=track',
		};
	}

	if (tags['cycleway:left'] === 'separate' || tags['cycleway:left'] === 'track') {
		return {
			isSafe: true,
			reason: 'Voie cyclable séparée (gauche)',
			relevantTags: ['cycleway:left'],
			condition: 'cycleway:left=separate OU cycleway:left=track',
		};
	}

	if (tags['cycleway:left'] === 'opposite_lane') {
		return {
			isSafe: true,
			reason: 'Voie cyclable séparée (en sens inverse)',
			relevantTags: ['cycleway:left'],
			condition: 'cycleway:left=opposite_lane',
		};
	}

	if (tags['cycleway:right'] === 'separate' || tags['cycleway:right'] === 'track') {
		return {
			isSafe: true,
			reason: 'Voie cyclable séparée (droite)',
			relevantTags: ['cycleway:right'],
			condition: 'cycleway:right=separate OU cycleway:right=track',
		};
	}

	if (tags['cycleway:right'] === 'opposite_lane') {
		return {
			isSafe: true,
			reason: 'Voie cyclable séparée (en sens inverse)',
			relevantTags: ['cycleway:right'],
			condition: 'cycleway:right=opposite_lane',
		};
	}

	if (tags['cycleway:both'] === 'separate' || tags['cycleway:both'] === 'track') {
		return {
			isSafe: true,
			reason: 'Voies cyclables séparées des deux côtés',
			relevantTags: ['cycleway:both'],
			condition: 'cycleway:both=separate OU cycleway:both=track',
		};
	}

	if (tags['cyclestreet'] === 'yes') {
		return {
			isSafe: true,
			reason: 'Rue cyclable (vélorue)',
			relevantTags: ['cyclestreet'],
			condition: 'cyclestreet=yes',
		};
	}

	if (tags['highway'] === 'pedestrian') {
		return {
			isSafe: true,
			reason: 'Zone piétonne',
			relevantTags: ['highway'],
			condition: 'highway=pedestrian',
		};
	}

	if (
		tags['highway'] === 'path' &&
		tags['bicycle'] === 'designated' &&
		tags['segregated'] === 'yes'
	) {
		return {
			isSafe: true,
			reason: 'Voie cyclable dédiée avec séparation piétons/cyclistes',
			relevantTags: ['highway', 'bicycle', 'segregated'],
			condition: 'highway=path ET bicycle=designated ET segregated=yes',
		};
	}

	if (tags['highway'] === 'path' && tags['bicycle'] === 'designated') {
		return {
			isSafe: true,
			reason: 'Chemin dédiée pour les cyclistes',
			relevantTags: ['highway', 'bicycle'],
			condition: 'highway=path ET bicycle=designated',
		};
	}

	if (
		(tags['highway'] === 'path' || tags['highway'] === 'footway') &&
		(tags['bicycle'] === 'designated' || tags['bicycle'] === 'yes') &&
		tags['segregated'] === 'yes'
	) {
		return {
			isSafe: true,
			reason: 'Voie partagée avec séparation piétons/vélos',
			relevantTags: ['highway', 'bicycle', 'segregated'],
			condition: `highway=${tags['highway']} ET bicycle=${tags['bicycle']} ET segregated=yes`,
		};
	}

	if (tags['motor_vehicle'] === 'no' && tags['bicycle'] === 'designated') {
		return {
			isSafe: true,
			reason: 'Voie interdite aux véhicules motorisés',
			relevantTags: ['motor_vehicle', 'bicycle'],
			condition: 'motor_vehicle=no ET bicycle=designated',
		};
	}

	if (tags['highway'] === 'service' && tags['motor_vehicle'] === 'no') {
		return {
			isSafe: true,
			reason: 'Voie de service (interdite aux véhicules motorisés)',
			relevantTags: ['highway', 'motor_vehicle'],
			condition: 'highway=service ET motor_vehicle=no',
		};
	}

	if (tags['highway'] === 'service' && tags['service'] === 'driveway') {
		return {
			isSafe: true,
			reason: 'Voie de service (desserte de propriété privée)',
			relevantTags: ['highway', 'service'],
			condition: 'highway=service ET service=driveway',
		};
	}

	if (tags['highway'] === 'service' && tags['psv'] === 'yes') {
		return {
			isSafe: true,
			reason: 'Voie de service (utilisée par les transports en commun)',
			relevantTags: ['highway', 'psv'],
			condition: 'highway=service ET psv=yes',
		};
	}

	if (tags['highway'] === 'service') {
		return {
			isSafe: true,
			reason: 'Voie de service (faible trafic)',
			relevantTags: ['highway'],
			condition: 'highway=service',
		};
	}

	if (tags['route_bicycle_icn'] === 'yes') {
		return {
			isSafe: true,
			reason: 'Itinéraire cyclable international',
			relevantTags: ['route_bicycle_icn'],
			condition: 'route_bicycle_icn=yes',
		};
	}

	if (
		tags['highway'] === 'footway' &&
		(tags['bicycle'] === 'permissive' ||
			tags['bicycle'] === 'yes' ||
			tags['bicycle'] === 'designated')
	) {
		return {
			isSafe: true,
			reason: 'Chemin ou traversée piétonne avec accès cyclable',
			relevantTags: ['highway'],
			condition: 'highway=footway ET (bicycle=permissive OU bicycle=yes OU bicycle=designated)',
		};
	}

	if (tags['highway'] === 'footway' && tags['footway'] === 'crossing') {
		return {
			isSafe: true,
			reason: 'Traversée piétonne',
			relevantTags: ['highway'],
			condition: 'highway=footway ET footway=crossing',
		};
	}

	if (tags['highway'] === 'footway' && tags['footway'] === 'sidewalk') {
		return {
			isSafe: false,
			reason: 'Trottoir',
			relevantTags: ['highway'],
			condition: 'highway=footway ET footway=sidewalk',
		};
	}

	if (tags['highway'] === 'footway') {
		return {
			isSafe: false,
			reason: 'Réservé aux piétons',
			relevantTags: ['highway'],
			condition: 'footway=sidewalk',
		};
	}

	if (tags['route_bicycle_ncn'] === 'yes') {
		return {
			isSafe: true,
			reason: 'Itinéraire cyclable national',
			relevantTags: ['route_bicycle_ncn'],
			condition: 'route_bicycle_ncn=yes',
		};
	}

	if (tags['route_bicycle_rcn'] === 'yes') {
		return {
			isSafe: true,
			reason: 'Itinéraire cyclable régional',
			relevantTags: ['route_bicycle_rcn'],
			condition: 'route_bicycle_rcn=yes',
		};
	}

	if (tags['route_bicycle_lcn'] === 'yes') {
		return {
			isSafe: true,
			reason: 'Itinéraire cyclable local',
			relevantTags: ['route_bicycle_lcn'],
			condition: 'route_bicycle_lcn=yes',
		};
	}

	if (tags['highway'] === 'unclassified' && tags['bicycle'] === 'designated') {
		return {
			isSafe: true,
			reason: 'Route non classifiée dédiée aux cyclistes',
			relevantTags: ['highway', 'bicycle'],
			condition: 'highway=unclassified ET bicycle=designated',
		};
	}

	if (tags['highway'] === 'unclassified' && tags['bicycle'] === 'yes') {
		return {
			isSafe: true,
			reason: 'Route non classifiée autorisant les cyclistes',
			relevantTags: ['highway', 'bicycle'],
			condition: 'highway=unclassified ET bicycle=yes',
		};
	}

	if (
		tags['cycleway'] === 'lane' ||
		tags['cycleway:right'] === 'lane' ||
		tags['cycleway:left'] === 'lane' ||
		tags['cycleway:both'] === 'lane'
	) {
		return {
			isSafe: false,
			reason: `Bande cyclable sans séparation physique sur ${unsafeRoad[tags['highway']] || 'la rue'}`,
			relevantTags: ['cycleway'],
			condition: 'cycleway=lane',
		};
	}

	if (tags['highway'] && unsafeRoadTypes[tags['highway']]) {
		return {
			isSafe: false,
			reason: unsafeRoadTypes[tags['highway']],
			relevantTags: ['highway'],
			condition: `highway=${tags['highway']}`,
		};
	}

	return {
		isSafe: false,
		reason: tags['highway']
			? `Voie de type "${tags['highway']}" sans aménagement cyclable`
			: 'Voie sans aménagement cyclable identifié',
		relevantTags: tags['highway'] ? ['highway'] : [],
		condition: tags['highway'] ? `highway=${tags['highway']}` : undefined,
	};
}
