import type { FeatureCollection } from 'geojson';
import type * as maplibregl from 'maplibre-gl';
import { featureLineLengthMeters } from '$lib/utils/geoLength';

export const DSC_OFFSET_LABEL_LAYER_IDS = new Set(['highway-name-minor', 'highway-name-major']);

const DSC_LABEL_OFFSET = 0.9;

const MIN_DSC_SHARE_OF_STREET = 0.5;

const BASEMAP_STREET_TYPE_ABBREVIATIONS: Record<string, string> = {
	Avenue: 'Av.',
	Boulevard: 'Bd',
	Chemin: 'Ch.',
	Esplanade: 'Espl.',
	Impasse: 'Imp.',
	Passage: 'Pass.',
	Place: 'Pl.',
	Promenade: 'Prom.',
	Route: 'Rte',
	Ruelle: 'Rle',
	Sentier: 'Sent.',
	Square: 'Sq.',
};

function toBasemapStreetName(name: string): string {
	const space = name.indexOf(' ');
	if (space === -1) {
		return name;
	}
	const abbreviation = BASEMAP_STREET_TYPE_ABBREVIATIONS[name.slice(0, space)];
	return abbreviation ? abbreviation + name.slice(space) : name;
}

export function dscStreetNames(osmCycleways: FeatureCollection | undefined): string[] {
	const ways = new Map<string, { name: string; length: number; isDsc: boolean }>();
	for (const feature of osmCycleways?.features ?? []) {
		const props = feature.properties;
		if (typeof props?.name !== 'string') {
			continue;
		}
		const key = `${props.osmType}/${props.osmId}`;
		const way = ways.get(key) ?? {
			name: props.name,
			length: featureLineLengthMeters(feature),
			isDsc: false,
		};
		way.isDsc ||= props.typeamenagement === 'Double sens cyclable';
		ways.set(key, way);
	}

	const streets = new Map<string, { length: number; dscLength: number }>();
	for (const way of ways.values()) {
		const street = streets.get(way.name) ?? { length: 0, dscLength: 0 };
		street.length += way.length;
		if (way.isDsc) {
			street.dscLength += way.length;
		}
		streets.set(way.name, street);
	}

	const names = new Set<string>();
	for (const [name, street] of streets) {
		if (street.dscLength > 0 && street.dscLength / street.length >= MIN_DSC_SHARE_OF_STREET) {
			names.add(name);
			names.add(toBasemapStreetName(name));
		}
	}
	return [...names].sort();
}

export function dscLabelOffset(
	streetNames: readonly string[],
): maplibregl.DataDrivenPropertyValueSpecification<[number, number]> {
	if (streetNames.length === 0) {
		return [0, 0];
	}

	const isMainRoad: maplibregl.ExpressionSpecification = [
		'match',
		['get', 'class'],
		['primary', 'secondary', 'trunk'],
		true,
		false,
	];

	const isDscStreet: maplibregl.ExpressionSpecification = [
		'match',
		['get', 'name'],
		[...streetNames],
		true,
		false,
	];

	return [
		'case',
		['all', ['!', isMainRoad], isDscStreet],
		['literal', [0, DSC_LABEL_OFFSET]],
		['literal', [0, 0]],
	];
}
