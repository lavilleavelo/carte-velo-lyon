import type * as maplibregl from 'maplibre-gl';
import type { MapStyle } from '$lib/utils/mapStyleToggle.svelte';

export type LabelCategory = 'places' | 'roads' | 'transit' | 'pois' | 'water';

export const LABEL_CATEGORIES: LabelCategory[] = ['places', 'roads', 'transit', 'pois', 'water'];

export const DEFAULT_LABELS_OFF: LabelCategory[] = ['water'];

export const STYLE_LABEL_SUPPORT: Record<MapStyle, LabelCategory[]> = {
	cyclopolis: ['places', 'roads', 'transit', 'pois', 'water'],
	'osm-bright': ['places', 'roads', 'transit', 'pois', 'water'],
	positron: ['places', 'roads', 'transit', 'pois', 'water'],
	cyclosm: ['places', 'roads', 'transit', 'pois', 'water'],
	hybrid: ['places', 'roads', 'transit'],
	satellite: ['places', 'transit'],
	neutrino: ['places', 'water'],
	'osm-eu': ['places'],
};

type LabelLayer = maplibregl.LayerSpecification;

type PoiFilter = maplibregl.FilterSpecification;

const poiSubclass = (cls: string, ...subclasses: string[]) =>
	['all', ['==', 'class', cls], ['in', 'subclass', ...subclasses]] as PoiFilter;
const poiNotSubclass = (cls: string, ...subclasses: string[]) =>
	['all', ['==', 'class', cls], ['!in', 'subclass', ...subclasses]] as PoiFilter;

const POI_TIERS: {
	id: string;
	minzoom: number;
	textSize: number;
	textColor: string;
	match: PoiFilter[];
}[] = [
	{
		// City-scale landmarks.
		id: 'poi-landmark',
		minzoom: 14,
		textSize: 12,
		textColor: '#555',
		match: [
			['in', 'class', 'museum', 'castle', 'stadium', 'zoo'],
			poiSubclass('hospital', 'hospital'),
			poiSubclass('college', 'university'),
			poiSubclass('town_hall', 'townhall'),
		],
	},
	{
		// Culture, sport, public services, bike shops.
		id: 'poi-civic',
		minzoom: 15,
		textSize: 11,
		textColor: '#666',
		match: [
			[
				'in',
				'class',
				'theatre',
				'cinema',
				'attraction',
				'swimming_pool',
				'sports_centre',
				'place_of_worship',
				'police',
				'fire_station',
				'bicycle',
				'garden',
				'cemetery',
				'harbor',
			],
			poiSubclass('library', 'library'),
			poiSubclass('town_hall', 'courthouse'),
		],
	},
	{
		// Neighbourhood scale: schools, private colleges, health, post offices, playgrounds.
		id: 'poi-local',
		minzoom: 16,
		textSize: 11,
		textColor: '#777',
		match: [
			[
				'in',
				'class',
				'school',
				'doctors',
				'dentist',
				'pharmacy',
				'playground',
				'pitch',
				'dog_park',
			],
			poiNotSubclass('hospital', 'hospital'),
			poiNotSubclass('college', 'university'),
			poiNotSubclass('town_hall', 'townhall', 'courthouse'),
			poiSubclass('post', 'post_office'),
		],
	},
];

const poiTierLayers: LabelLayer[] = POI_TIERS.map((tier) => ({
	id: tier.id,
	type: 'symbol',
	source: 'openmaptiles',
	'source-layer': 'poi',
	minzoom: tier.minzoom,
	filter: [
		'all',
		['==', '$type', 'Point'],
		['has', 'name'],
		['any', ['!has', 'level'], ['==', 'level', 0]],
		['any', ...tier.match],
	] as PoiFilter,
	layout: {
		// Classes without an icon in the OSM Bright sprite borrow a close one.
		'icon-image': [
			'match',
			['get', 'class'],
			'swimming_pool',
			'swimming_11',
			'sports_centre',
			'pitch_11',
			'doctors',
			'hospital_11',
			['concat', ['get', 'class'], '_11'],
		],
		'symbol-sort-key': ['get', 'rank'],
		'text-anchor': 'top',
		'text-field': '{name:latin}\n{name:nonlatin}',
		'text-font': ['Noto Sans Regular'],
		'text-max-width': 9,
		'text-offset': [0, 0.6],
		'text-padding': 2,
		'text-size': tier.textSize,
	},
	paint: {
		'text-color': tier.textColor,
		'text-halo-blur': 0.5,
		'text-halo-color': '#ffffff',
		'text-halo-width': 1,
	},
}));

export const labelLayers: Record<LabelCategory, LabelLayer[]> = {
	places: [
		{
			id: 'place-other',
			type: 'symbol',
			metadata: {
				'mapbox:group': '1444849242106.713',
			},
			source: 'openmaptiles',
			'source-layer': 'place',
			filter: [
				'all',
				['!in', 'class', 'city', 'town', 'village', 'state', 'country', 'continent', 'island'],
			],
			layout: {
				'text-field': '{name:latin}\n{name:nonlatin}',
				'text-font': ['Noto Sans Bold'],
				'text-letter-spacing': 0.1,
				'text-max-width': 9,
				'text-size': {
					base: 1.2,
					stops: [
						[12, 10],
						[15, 14],
					],
				},
				'text-transform': 'uppercase',
				visibility: 'visible',
			},
			paint: {
				'text-color': '#633',
				'text-halo-color': 'rgba(255,255,255,0.8)',
				'text-halo-width': 1.2,
			},
		},
		{
			id: 'place-island',
			type: 'symbol',
			metadata: {
				'mapbox:group': '1444849242106.713',
			},
			source: 'openmaptiles',
			'source-layer': 'place',
			filter: ['==', 'class', 'island'],
			layout: {
				'text-field': '{name:latin}',
				'text-font': ['Noto Sans Italic'],
				'text-letter-spacing': 0.05,
				'text-max-width': 8,
				'text-size': {
					base: 1.2,
					stops: [
						[13, 9],
						[16, 12],
					],
				},
				visibility: 'visible',
			},
			paint: {
				'text-color': '#6b8a6b',
				'text-halo-color': 'rgba(255,255,255,0.7)',
				'text-halo-width': 1,
			},
			minzoom: 16,
		},
		{
			id: 'place-village',
			type: 'symbol',
			metadata: {
				'mapbox:group': '1444849242106.713',
			},
			source: 'openmaptiles',
			'source-layer': 'place',
			filter: ['==', 'class', 'village'],
			layout: {
				'text-field': '{name:latin}\n{name:nonlatin}',
				'text-font': ['Noto Sans Regular'],
				'text-max-width': 8,
				'text-size': {
					base: 1.2,
					stops: [
						[10, 10],
						[15, 17],
					],
				},
				visibility: 'visible',
			},
			paint: {
				'text-color': '#333',
				'text-halo-color': 'rgba(255,255,255,0.8)',
				'text-halo-width': 1.2,
			},
		},
		{
			id: 'place-town',
			type: 'symbol',
			metadata: {
				'mapbox:group': '1444849242106.713',
			},
			source: 'openmaptiles',
			'source-layer': 'place',
			filter: ['==', 'class', 'town'],
			layout: {
				'text-field': '{name:latin}\n{name:nonlatin}',
				'text-font': ['Noto Sans Regular'],
				'text-max-width': 8,
				'text-size': {
					base: 1.2,
					stops: [
						[10, 11],
						[15, 19],
					],
				},
				visibility: 'visible',
			},
			paint: {
				'text-color': '#333',
				'text-halo-color': 'rgba(255,255,255,0.8)',
				'text-halo-width': 1.2,
			},
		},
		{
			id: 'place-city',
			type: 'symbol',
			metadata: {
				'mapbox:group': '1444849242106.713',
			},
			source: 'openmaptiles',
			'source-layer': 'place',
			filter: ['all', ['!=', 'capital', 2], ['==', 'class', 'city']],
			layout: {
				'text-field': '{name:latin}\n{name:nonlatin}',
				'text-font': ['Noto Sans Regular'],
				'text-max-width': 8,
				'text-size': {
					base: 1.2,
					stops: [
						[7, 11],
						[11, 19],
					],
				},
				visibility: 'visible',
			},
			paint: {
				'text-color': '#333',
				'text-halo-color': 'rgba(255,255,255,0.8)',
				'text-halo-width': 1.2,
			},
		},
		{
			id: 'place-city-capital',
			type: 'symbol',
			metadata: {
				'mapbox:group': '1444849242106.713',
			},
			source: 'openmaptiles',
			'source-layer': 'place',
			filter: ['all', ['==', 'capital', 2], ['==', 'class', 'city']],
			layout: {
				'icon-image': 'star_11',
				'icon-size': 0.8,
				'text-anchor': 'left',
				'text-field': '{name:latin}\n{name:nonlatin}',
				'text-font': ['Noto Sans Regular'],
				'text-max-width': 8,
				'text-offset': [0.4, 0],
				'text-size': {
					base: 1.2,
					stops: [
						[7, 11],
						[11, 19],
					],
				},
				visibility: 'visible',
			},
			paint: {
				'text-color': '#333',
				'text-halo-color': 'rgba(255,255,255,0.8)',
				'text-halo-width': 1.2,
			},
		},
		{
			id: 'place-state',
			type: 'symbol',
			metadata: {
				'mapbox:group': '1444849242106.713',
			},
			source: 'openmaptiles',
			'source-layer': 'place',
			filter: ['in', 'class', 'state'],
			layout: {
				'text-field': '{name:latin}',
				'text-font': ['Noto Sans Bold'],
				'text-letter-spacing': 0.1,
				'text-max-width': 9,
				'text-size': {
					base: 1.2,
					stops: [
						[12, 10],
						[15, 14],
					],
				},
				'text-transform': 'uppercase',
				visibility: 'visible',
			},
			paint: {
				'text-color': '#633',
				'text-halo-color': 'rgba(255,255,255,0.8)',
				'text-halo-width': 1.2,
			},
		},
		{
			id: 'place-country-other',
			type: 'symbol',
			metadata: {
				'mapbox:group': '1444849242106.713',
			},
			source: 'openmaptiles',
			'source-layer': 'place',
			filter: ['all', ['==', 'class', 'country'], ['>=', 'rank', 3], ['!has', 'iso_a2']],
			layout: {
				'text-field': '{name:latin}',
				'text-font': ['Noto Sans Italic'],
				'text-max-width': 6.25,
				'text-size': {
					stops: [
						[3, 11],
						[7, 17],
					],
				},
				'text-transform': 'uppercase',
				visibility: 'visible',
			},
			paint: {
				'text-color': '#334',
				'text-halo-blur': 1,
				'text-halo-color': 'rgba(255,255,255,0.8)',
				'text-halo-width': 2,
			},
		},
		{
			id: 'place-country-3',
			type: 'symbol',
			metadata: {
				'mapbox:group': '1444849242106.713',
			},
			source: 'openmaptiles',
			'source-layer': 'place',
			filter: ['all', ['==', 'class', 'country'], ['>=', 'rank', 3], ['has', 'iso_a2']],
			layout: {
				'text-field': '{name:latin}',
				'text-font': ['Noto Sans Bold'],
				'text-max-width': 6.25,
				'text-size': {
					stops: [
						[3, 11],
						[7, 17],
					],
				},
				'text-transform': 'uppercase',
				visibility: 'visible',
			},
			paint: {
				'text-color': '#334',
				'text-halo-blur': 1,
				'text-halo-color': 'rgba(255,255,255,0.8)',
				'text-halo-width': 2,
			},
		},
		{
			id: 'place-country-2',
			type: 'symbol',
			metadata: {
				'mapbox:group': '1444849242106.713',
			},
			source: 'openmaptiles',
			'source-layer': 'place',
			filter: ['all', ['==', 'class', 'country'], ['==', 'rank', 2], ['has', 'iso_a2']],
			layout: {
				'text-field': '{name:latin}',
				'text-font': ['Noto Sans Bold'],
				'text-max-width': 6.25,
				'text-size': {
					stops: [
						[2, 11],
						[5, 17],
					],
				},
				'text-transform': 'uppercase',
				visibility: 'visible',
			},
			paint: {
				'text-color': '#334',
				'text-halo-blur': 1,
				'text-halo-color': 'rgba(255,255,255,0.8)',
				'text-halo-width': 2,
			},
		},
		{
			id: 'place-country-1',
			type: 'symbol',
			metadata: {
				'mapbox:group': '1444849242106.713',
			},
			source: 'openmaptiles',
			'source-layer': 'place',
			filter: ['all', ['==', 'class', 'country'], ['==', 'rank', 1], ['has', 'iso_a2']],
			layout: {
				'text-field': '{name:latin}',
				'text-font': ['Noto Sans Bold'],
				'text-max-width': 6.25,
				'text-size': {
					stops: [
						[1, 11],
						[4, 17],
					],
				},
				'text-transform': 'uppercase',
				visibility: 'visible',
			},
			paint: {
				'text-color': '#334',
				'text-halo-blur': 1,
				'text-halo-color': 'rgba(255,255,255,0.8)',
				'text-halo-width': 2,
			},
		},
		{
			id: 'place-continent',
			type: 'symbol',
			metadata: {
				'mapbox:group': '1444849242106.713',
			},
			source: 'openmaptiles',
			'source-layer': 'place',
			maxzoom: 1,
			filter: ['==', 'class', 'continent'],
			layout: {
				'text-field': '{name:latin}',
				'text-font': ['Noto Sans Bold'],
				'text-max-width': 6.25,
				'text-size': 14,
				'text-transform': 'uppercase',
				visibility: 'visible',
			},
			paint: {
				'text-color': '#334',
				'text-halo-blur': 1,
				'text-halo-color': 'rgba(255,255,255,0.8)',
				'text-halo-width': 2,
			},
		},
	],
	roads: [
		{
			id: 'highway-name-path',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'transportation_name',
			minzoom: 15.5,
			filter: ['==', 'class', 'path'],
			layout: {
				'symbol-placement': 'line',
				'text-field': '{name:latin} {name:nonlatin}',
				'text-font': ['Noto Sans Regular'],
				'text-rotation-alignment': 'map',
				'text-size': {
					base: 1,
					stops: [
						[13, 12],
						[14, 13],
					],
				},
			},
			paint: {
				'text-color': 'hsl(30, 23%, 62%)',
				'text-halo-color': '#f8f4f0',
				'text-halo-width': 0.5,
			},
		},
		{
			id: 'highway-name-minor',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'transportation_name',
			minzoom: 15,
			filter: ['all', ['==', '$type', 'LineString'], ['in', 'class', 'minor', 'service', 'track']],
			layout: {
				'symbol-placement': 'line',
				'text-field': '{name:latin} {name:nonlatin}',
				'text-font': ['Noto Sans Regular'],
				'text-rotation-alignment': 'map',
				'text-size': {
					base: 1,
					stops: [
						[13, 12],
						[14, 13],
					],
				},
			},
			paint: {
				'text-color': '#765',
				'text-halo-blur': 0.5,
				'text-halo-width': 1,
			},
		},
		{
			id: 'highway-name-major',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'transportation_name',
			minzoom: 12.2,
			filter: ['in', 'class', 'primary', 'secondary', 'tertiary', 'trunk'],
			layout: {
				'symbol-placement': 'line',
				'text-field': '{name:latin} {name:nonlatin}',
				'text-font': ['Noto Sans Regular'],
				'text-rotation-alignment': 'map',
				'text-size': {
					base: 1,
					stops: [
						[13, 12],
						[14, 13],
					],
				},
			},
			paint: {
				'text-color': '#765',
				'text-halo-blur': 0.5,
				'text-halo-width': 1,
			},
		},
		{
			id: 'highway-shield',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'transportation_name',
			minzoom: 8,
			filter: [
				'all',
				['<=', 'ref_length', 6],
				['==', '$type', 'LineString'],
				['!in', 'network', 'us-interstate', 'us-highway', 'us-state'],
			],
			layout: {
				'icon-image': 'road_{ref_length}',
				'icon-rotation-alignment': 'viewport',
				'icon-size': 1,
				'symbol-placement': {
					base: 1,
					stops: [
						[10, 'point'],
						[11, 'line'],
					],
				},
				'symbol-spacing': 200,
				'text-field': '{ref}',
				'text-font': ['Noto Sans Regular'],
				'text-rotation-alignment': 'viewport',
				'text-size': 10,
			},
			paint: {},
		},
		{
			id: 'highway-shield-us-interstate',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'transportation_name',
			minzoom: 7,
			filter: [
				'all',
				['<=', 'ref_length', 6],
				['==', '$type', 'LineString'],
				['in', 'network', 'us-interstate'],
			],
			layout: {
				'icon-image': '{network}_{ref_length}',
				'icon-rotation-alignment': 'viewport',
				'icon-size': 1,
				'symbol-placement': {
					base: 1,
					stops: [
						[7, 'point'],
						[7, 'line'],
						[8, 'line'],
					],
				},
				'symbol-spacing': 200,
				'text-field': '{ref}',
				'text-font': ['Noto Sans Regular'],
				'text-rotation-alignment': 'viewport',
				'text-size': 10,
			},
			paint: {
				'text-color': 'rgba(0, 0, 0, 1)',
			},
		},
		{
			id: 'highway-shield-us-other',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'transportation_name',
			minzoom: 9,
			filter: [
				'all',
				['<=', 'ref_length', 6],
				['==', '$type', 'LineString'],
				['in', 'network', 'us-highway', 'us-state'],
			],
			layout: {
				'icon-image': '{network}_{ref_length}',
				'icon-rotation-alignment': 'viewport',
				'icon-size': 1,
				'symbol-placement': {
					base: 1,
					stops: [
						[10, 'point'],
						[11, 'line'],
					],
				},
				'symbol-spacing': 200,
				'text-field': '{ref}',
				'text-font': ['Noto Sans Regular'],
				'text-rotation-alignment': 'viewport',
				'text-size': 10,
			},
			paint: {
				'text-color': 'rgba(0, 0, 0, 1)',
			},
		},
	],
	transit: [
		{
			id: 'airport-label-major',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'aerodrome_label',
			minzoom: 10,
			filter: ['all', ['has', 'iata']],
			layout: {
				'icon-image': 'airport_11',
				'icon-size': 1,
				'text-anchor': 'top',
				'text-field': '{name:latin}\n{name:nonlatin}',
				'text-font': ['Noto Sans Regular'],
				'text-max-width': 9,
				'text-offset': [0, 0.6],
				'text-optional': true,
				'text-padding': 2,
				'text-size': 12,
				visibility: 'visible',
			},
			paint: {
				'text-color': '#666',
				'text-halo-blur': 0.5,
				'text-halo-color': '#ffffff',
				'text-halo-width': 1,
			},
		},
		{
			id: 'poi-railway',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'poi',
			minzoom: 13,
			filter: [
				'all',
				['==', '$type', 'Point'],
				['has', 'name'],
				['==', 'class', 'railway'],
				['in', 'subclass', 'station', 'subway', 'tram_stop', 'halt'],
			],
			layout: {
				'icon-allow-overlap': false,
				'icon-ignore-placement': false,
				'icon-image': '{class}_11',
				'icon-optional': false,
				'text-allow-overlap': false,
				'text-anchor': 'top',
				'text-field': '{name:latin}\n{name:nonlatin}',
				'text-font': ['Noto Sans Regular'],
				'text-ignore-placement': false,
				'text-max-width': 9,
				'text-offset': [0, 0.6],
				'text-optional': true,
				'text-padding': 2,
				'text-size': 12,
			},
			paint: {
				'text-color': '#666',
				'text-halo-blur': 0.5,
				'text-halo-color': '#ffffff',
				'text-halo-width': 1,
			},
		},
	],
	pois: [
		{
			id: 'poi-park-label',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'poi',
			minzoom: 12,
			filter: [
				'all',
				['==', '$type', 'Point'],
				['==', 'class', 'park'],
				['<=', 'rank', 14],
				['has', 'name'],
			],
			layout: {
				'icon-image': '{class}_11',
				'text-anchor': 'top',
				'text-field': '{name:latin}',
				'text-font': ['Noto Sans Italic'],
				'text-max-width': 9,
				'text-offset': [0, 0.6],
				'text-padding': 2,
				'text-size': {
					base: 1.2,
					stops: [
						[12, 11],
						[14, 14],
						[17, 18],
					],
				},
				visibility: 'visible',
			},
			paint: {
				'text-color': '#4a7a4a',
				'text-halo-color': 'rgba(255,255,255,0.85)',
				'text-halo-width': 1.5,
			},
		},
		...poiTierLayers,
	],
	water: [
		{
			id: 'waterway-name',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'waterway',
			minzoom: 13,
			filter: ['all', ['==', '$type', 'LineString'], ['has', 'name']],
			layout: {
				'symbol-placement': 'line',
				'symbol-spacing': 350,
				'text-field': '{name:latin} {name:nonlatin}',
				'text-font': ['Noto Sans Italic'],
				'text-letter-spacing': 0.2,
				'text-max-width': 5,
				'text-rotation-alignment': 'map',
				'text-size': 14,
			},
			paint: {
				'text-color': '#74aee9',
				'text-halo-color': 'rgba(255,255,255,0.7)',
				'text-halo-width': 1.5,
			},
		},
		{
			id: 'water-name-lakeline',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'water_name',
			filter: ['==', '$type', 'LineString'],
			layout: {
				'symbol-placement': 'line',
				'symbol-spacing': 350,
				'text-field': '{name:latin}\n{name:nonlatin}',
				'text-font': ['Noto Sans Italic'],
				'text-letter-spacing': 0.2,
				'text-max-width': 5,
				'text-rotation-alignment': 'map',
				'text-size': 14,
			},
			paint: {
				'text-color': '#74aee9',
				'text-halo-color': 'rgba(255,255,255,0.7)',
				'text-halo-width': 1.5,
			},
		},
		{
			id: 'water-name-ocean',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'water_name',
			filter: ['all', ['==', '$type', 'Point'], ['==', 'class', 'ocean']],
			layout: {
				'symbol-placement': 'point',
				'symbol-spacing': 350,
				'text-field': '{name:latin}',
				'text-font': ['Noto Sans Italic'],
				'text-letter-spacing': 0.2,
				'text-max-width': 5,
				'text-rotation-alignment': 'map',
				'text-size': 14,
			},
			paint: {
				'text-color': '#74aee9',
				'text-halo-color': 'rgba(255,255,255,0.7)',
				'text-halo-width': 1.5,
			},
		},
		{
			id: 'water-name-other',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'water_name',
			filter: ['all', ['==', '$type', 'Point'], ['!in', 'class', 'ocean']],
			layout: {
				'symbol-placement': 'point',
				'symbol-spacing': 350,
				'text-field': '{name:latin}\n{name:nonlatin}',
				'text-font': ['Noto Sans Italic'],
				'text-letter-spacing': 0.2,
				'text-max-width': 5,
				'text-rotation-alignment': 'map',
				'text-size': {
					stops: [
						[0, 10],
						[6, 14],
					],
				},
				visibility: 'visible',
			},
			paint: {
				'text-color': '#74aee9',
				'text-halo-color': 'rgba(255,255,255,0.7)',
				'text-halo-width': 1.5,
			},
		},
	],
};
