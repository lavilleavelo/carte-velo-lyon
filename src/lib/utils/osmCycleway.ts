import type { Feature, FeatureCollection } from 'geojson';
import { isSafePath } from '$lib/utils/safePath';

export const PAVED_SURFACES = new Set([
	'asphalt',
	'paved',
	'chipseal',
	'concrete',
	'concrete:lanes',
	'concrete:plates',
	'concrete_plates',
	'paving_stones',
	'paving_stones:lanes',
	'bricks',
	'sett',
	'cobblestone',
	'unhewn_cobblestone',
	'metal',
	'metal_grid',
	'wood',
	'rubber',
	'tiles',
]);

export function isPavedSurface(surface: string | undefined | null): boolean {
	if (!surface) {
		return true;
	}

	return surface.split(';').every((s) => PAVED_SURFACES.has(s.trim()));
}

const SURFACE_LABELS: Record<string, string> = {
	asphalt: 'enrobé',
	paved: 'revêtu',
	chipseal: 'enduit gravillonné',
	concrete: 'béton',
	'concrete:plates': 'dalles de béton',
	concrete_plates: 'dalles de béton',
	'concrete:lanes': 'béton',
	paving_stones: 'pavés',
	sett: 'pavés',
	cobblestone: 'pavés',
	unhewn_cobblestone: 'pavés bruts',
	metal: 'métal',
	metal_grid: 'grille métallique',
	wood: 'bois',
	rubber: 'caoutchouc',
	plastic: 'plastique',
	tartan: 'tartan',
	compacted: 'stabilisé',
	fine_gravel: 'gravier fin',
	gravel: 'gravier',
	pebblestone: 'galets',
	unpaved: 'non revêtu',
	ground: 'terre',
	dirt: 'terre',
	earth: 'terre',
	clay: 'argile',
	mud: 'boue',
	sand: 'sable',
	grass: 'herbe',
	grass_paver: 'dalles engazonnées',
	rock: 'roche',
	woodchips: 'copeaux de bois',
};

export function surfaceLabel(surface: string): string {
	return [...new Set(surface.split(';').map((s) => SURFACE_LABELS[s.trim()] ?? s.trim()))].join(
		' / ',
	);
}

export type Side = 'left' | 'right' | 'center';

export type Classification = {
	typeamenagement: string;
	side: Side;
	bidirectional?: boolean;
	advisory?: boolean;
};

function sideOffset(side: Side): number {
	if (side === 'left') return -5;
	if (side === 'right') return 5;
	return 0;
}

export function overpassToGeoJSON(data: any): FeatureCollection {
	const features: Feature[] = [];
	for (const element of data?.elements ?? []) {
		if (element.type !== 'way' || !element.geometry) continue;
		const tags = element.tags ?? {};
		const classifications = classifyOsmCycleway(tags);
		if (classifications.length === 0) continue;

		const coordinates = element.geometry.map((p: { lon: number; lat: number }) => [p.lon, p.lat]);

		for (const c of classifications) {
			const safety = isSafePath(tags, c.typeamenagement, c.advisory);
			features.push({
				type: 'Feature',
				properties: {
					...tags,
					id: `osm-cw-${element.id}-${c.typeamenagement}-${c.bidirectional ? 'bi' : 'uni'}`,
					osmId: element.id,
					osmType: element.type,
					typeamenagement: c.typeamenagement,
					side: c.side,
					bidirectional: c.bidirectional ?? false,
					advisory: c.advisory ?? false,
					paved: isPavedSurface(tags.surface),
					offset: sideOffset(c.side),
					isSafe: safety.isSafe,
					safetyReason: safety.reason,
					safetyCaveat: safety.caveat,
				},
				geometry: {
					type: 'LineString',
					coordinates,
				},
			});
		}
	}
	return { type: 'FeatureCollection', features };
}

export function classifyValue(value?: string): string | null {
	if (!value || value === 'no' || value === 'separate' || value === 'shared_lane') return null;
	if (value === 'track' || value === 'opposite_track') return 'Piste Cyclable';
	if (value === 'lane' || value === 'opposite_lane') return 'Bande Cyclable';
	if (value === 'opposite') return 'Double sens cyclable';
	if (value === 'share_busway' || value === 'shared_busway') return 'Couloir bus vélo';
	return null;
}

const NOT_ROADS = new Set(['pedestrian', 'footway', 'path', 'steps', 'corridor', 'bridleway']);

export function classifyOsmCycleway(tags: Record<string, any>): Classification[] {
	const results: Classification[] = [];

	if (tags.area === 'yes') {
		return results;
	}

	const trafficSign = String(tags.traffic_sign ?? '');
	const hasC115 = /(^|;|\s)FR:C115(\b|$)/i.test(trafficSign) || trafficSign.includes('C115');
	const motorRestricted =
		tags.motor_vehicle === 'no' || tags.motor_vehicle === 'destination' || tags.motorcar === 'no';
	const bikeDesignated = tags.bicycle === 'designated';

	if (hasC115 && (bikeDesignated || tags.bicycle === 'yes')) {
		results.push({ typeamenagement: 'Voie verte', side: 'center', bidirectional: true });
		return results;
	}

	if (tags.highway === 'cycleway' && tags.foot === 'designated' && tags.segregated === 'no') {
		const onewayBicycle = tags['oneway:bicycle'];
		const bidirectional = onewayBicycle === 'no' || tags.oneway !== 'yes';
		results.push({ typeamenagement: 'Voie verte', side: 'center', bidirectional });
		return results;
	}

	if (tags.highway === 'cycleway') {
		const onewayBicycle = tags['oneway:bicycle'];
		const oneway = tags.oneway;
		const bidirectional = onewayBicycle === 'no' || (oneway !== 'yes' && onewayBicycle !== 'yes');
		results.push({ typeamenagement: 'Piste Cyclable', side: 'center', bidirectional });
		return results;
	}

	if (tags.bicycle_road === 'yes' || tags.cyclestreet === 'yes') {
		results.push({ typeamenagement: 'Vélorue', side: 'center', bidirectional: true });
		return results;
	}

	if (tags.highway === 'path' && bikeDesignated) {
		results.push({ typeamenagement: 'Voie verte', side: 'center', bidirectional: true });
		return results;
	}

	if (
		tags.highway === 'pedestrian' &&
		(bikeDesignated || tags.bicycle === 'yes') &&
		tags.segregated !== 'yes'
	) {
		results.push({ typeamenagement: 'Voie verte', side: 'center', bidirectional: true });
		return results;
	}

	if (
		tags.highway === 'footway' &&
		(bikeDesignated || tags.bicycle === 'yes' || tags.bicycle === 'permissive')
	) {
		results.push({
			typeamenagement: 'Voie piétonne (vélos autorisés)',
			side: 'center',
			bidirectional: true,
		});
		return results;
	}

	if (
		(tags.highway === 'service' || tags.highway === 'track' || tags.highway === 'unclassified') &&
		bikeDesignated &&
		(motorRestricted || tags.foot === 'designated')
	) {
		results.push({ typeamenagement: 'Voie verte', side: 'center', bidirectional: true });
		return results;
	}

	if (NOT_ROADS.has(tags.highway) && (tags.bicycle === 'no' || tags.bicycle === 'dismount')) {
		return results;
	}

	const hasSideTags = tags['cycleway:left'] || tags['cycleway:right'] || tags['cycleway:both'];

	const isCentered = (type: string) => type === 'Double sens cyclable';

	const sideIsBidir = (sideKey: string) => {
		const ow = tags[`${sideKey}:oneway`];
		return ow === 'no' || ow === '-1';
	};

	const isAdvisory =
		tags['cycleway:both:lane'] === 'advisory' || tags['cycleway:lane'] === 'advisory';

	if (tags['cycleway:both']) {
		const type = classifyValue(tags['cycleway:both']);
		const bidir = sideIsBidir('cycleway:both') || (isAdvisory && type === 'Bande Cyclable');
		if (type && isCentered(type)) {
			results.push({ typeamenagement: type, side: 'center', bidirectional: bidir });
		} else if (type) {
			results.push({ typeamenagement: type, side: 'left', bidirectional: bidir });
			results.push({ typeamenagement: type, side: 'right', bidirectional: bidir });
		}
	} else {
		if (tags['cycleway:left']) {
			const type = classifyValue(tags['cycleway:left']);
			if (type) {
				const bidir = sideIsBidir('cycleway:left');
				results.push({
					typeamenagement: type,
					side: isCentered(type) ? 'center' : 'left',
					bidirectional: bidir,
				});
			}
		}
		if (tags['cycleway:right']) {
			const type = classifyValue(tags['cycleway:right']);
			if (type) {
				const alreadyCentered =
					isCentered(type) &&
					results.some((r) => r.typeamenagement === type && r.side === 'center');
				if (!alreadyCentered) {
					const bidir = sideIsBidir('cycleway:right');
					results.push({
						typeamenagement: type,
						side: isCentered(type) ? 'center' : 'right',
						bidirectional: bidir,
					});
				}
			}
		}
	}

	if (tags.cycleway && !hasSideTags) {
		const type = classifyValue(tags.cycleway);
		if (type) {
			const bidir = isAdvisory && type === 'Bande Cyclable';
			const onewayWithoutContraflow = tags.oneway === 'yes' && tags['oneway:bicycle'] !== 'no';
			if (isCentered(type) || String(tags.cycleway).startsWith('opposite')) {
				results.push({ typeamenagement: type, side: 'center', bidirectional: bidir });
			} else if (type === 'Couloir bus vélo' || onewayWithoutContraflow) {
				results.push({ typeamenagement: type, side: 'right', bidirectional: bidir });
			} else {
				results.push({ typeamenagement: type, side: 'left', bidirectional: bidir });
				results.push({ typeamenagement: type, side: 'right', bidirectional: bidir });
			}
		}
	}

	for (const r of results) {
		if (
			r.typeamenagement === 'Bande Cyclable' &&
			(isAdvisory || (r.side !== 'center' && tags[`cycleway:${r.side}:lane`] === 'advisory'))
		) {
			r.advisory = true;
		}
	}

	const hasDsc = results.some((r) => r.typeamenagement === 'Double sens cyclable');
	const contraflowHandled =
		results.length > 0 &&
		(results.some((r) => r.bidirectional) ||
			(results.some((r) => r.side === 'left') && results.some((r) => r.side === 'right')));

	if (!hasDsc && !contraflowHandled) {
		const isOneway = tags.oneway === 'yes';
		const onewayBicycle = tags['oneway:bicycle'];
		const isContresens = isOneway && onewayBicycle === 'no';
		const isLivingStreet = tags.highway === 'living_street';
		if (isContresens) {
			results.push({ typeamenagement: 'Double sens cyclable', side: 'center' });
		} else if (isLivingStreet && isOneway && onewayBicycle !== 'yes') {
			results.push({ typeamenagement: 'Double sens cyclable', side: 'center' });
		}
	}

	return results;
}
