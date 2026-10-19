import hybridStyle from '$lib/components/map/hybrid-style.json';
import cyclopolisStyle from '$lib/components/map/cyclopolis-style.json';
import osmBrightStyle from '$lib/components/map/osm-bright-style.json';
import neutrinoStyle from '$lib/components/map/neutrino-style.json';
import positronStyle from '$lib/components/map/positron-style.json';
import osmEuStyle from '$lib/components/map/osm-eu-style';
import {
	ATTRIBUTION_OSM_OMT,
	ATTRIBUTION_CYCLOSM,
	ATTRIBUTION_ORTHO,
	attributionMetropoleOrtho,
} from '$lib/config/mapAttribution';

export const MAP_STYLE_IDS = [
	'cyclopolis',
	'neutrino',
	'positron',
	'osm-bright',
	'osm-eu',
	'hybrid',
	'satellite',
	'cyclosm',
] as const;

export type MapStyle = (typeof MAP_STYLE_IDS)[number];

const cyclosmStyle = {
	version: 8,
	id: 'cyclosm',
	name: 'CyclOSM',
	sources: {
		'raster-tiles': {
			type: 'raster',
			tiles: ['https://c.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png'],
			tileSize: 256,
			attribution: ATTRIBUTION_CYCLOSM,
		},
		openmaptiles: {
			type: 'vector',
			url: 'https://openmaptiles.data.gouv.fr/data/planet-vector.json',
			attribution: ATTRIBUTION_CYCLOSM,
		},
	},
	sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
	glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
	layers: [
		{
			id: 'simple-tiles',
			type: 'raster',
			source: 'raster-tiles',
			minzoom: 0,
			maxzoom: 22,
		},
	],
	bearing: 0,
	pitch: 0,
	center: [0, 0],
	zoom: 1,
};

const satelliteStyle = {
	version: 8,
	id: 'satellite',
	name: 'Satellite',
	sources: {
		ortho: {
			type: 'raster',
			tiles: ['https://data.geopf.fr/tms/1.0.0/ORTHOIMAGERY.ORTHOPHOTOS/{z}/{x}/{y}.jpeg'],
			tileSize: 256,
			attribution: ATTRIBUTION_ORTHO,
		},
		openmaptiles: {
			type: 'vector',
			url: 'https://openmaptiles.geo.data.gouv.fr/data/france-vector.json',
			attribution: ATTRIBUTION_OSM_OMT,
		},
	},
	sprite: 'https://openmaptiles.github.io/osm-bright-gl-style/sprite',
	glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
	layers: [
		{
			id: 'ortho',
			type: 'raster',
			source: 'ortho',
			minzoom: 0,
			maxzoom: 22,
		},
	],
	bearing: 0,
	pitch: 0,
	center: [0, 0],
	zoom: 1,
};

export const MAP_STYLES: Record<MapStyle, any> = {
	positron: positronStyle,
	'osm-bright': osmBrightStyle,
	cyclopolis: cyclopolisStyle,
	hybrid: hybridStyle,
	satellite: satelliteStyle,
	cyclosm: cyclosmStyle,
	neutrino: neutrinoStyle,
	'osm-eu': osmEuStyle,
};

export function isMapStyle(value: string | null | undefined): value is MapStyle {
	return value != null && value in MAP_STYLES;
}

export const AERIAL_STYLES = ['hybrid', 'satellite'] as const satisfies readonly MapStyle[];
type AerialStyle = (typeof AERIAL_STYLES)[number];

export function isAerialStyle(style: MapStyle): style is AerialStyle {
	return (AERIAL_STYLES as readonly MapStyle[]).includes(style);
}

/**
 * Métropole de Lyon orthophotos at 5 cm (Licence Ouverte 2.0, data.grandlyon.com),
 * four times sharper than IGN's 20 cm. Bounds come from the WMTS GetCapabilities,
 * so no tile is requested outside them.
 */
const METROPOLE_ORTHO = {
	'2023': { layer: 'ortho_2023', bounds: [4.678, 45.5495, 5.07, 45.9425] },
	'2022': { layer: 'ortho_2022', bounds: [4.6652, 45.5477, 5.1674, 45.9607] },
} as const;
type MetropoleOrthoYear = keyof typeof METROPOLE_ORTHO;

export const AERIAL_SOURCES = [
	{ id: '2023', label: 'Été 2023', description: 'Métropole de Lyon, 5 cm, la plus récente' },
	{ id: '2022', label: 'Hiver 2022', description: 'Métropole de Lyon, 5 cm, arbres nus' },
	{ id: 'ign', label: 'IGN', description: 'IGN BD ORTHO, 20 cm, toute la France' },
] as const;
export type AerialSource = (typeof AERIAL_SOURCES)[number]['id'];

/**
 * Overlays the Métropole orthophoto on top of the IGN one. It only kicks in from
 * zoom 17: below that IGN is just as sharp, and the Grand Lyon tile cache is slow
 * (~0.5 s per tile). That cache only serves JPEG (PNG is ~10x heavier), so just
 * outside the Métropole, within the bounds, its tiles are white.
 */
function withMetropoleOrtho(style: any, year: MetropoleOrthoYear) {
	const { layer, bounds } = METROPOLE_ORTHO[year];
	const orthoIndex = style.layers.findIndex((l: { id: string }) => l.id === 'ortho');
	return {
		...style,
		sources: {
			...style.sources,
			'metropole-ortho': {
				type: 'raster',
				tiles: [
					'https://imagerie.data.grandlyon.com/geoserver/grandlyon/gwc/service/wmts?SERVICE=WMTS&REQUEST=GetTile' +
						`&VERSION=1.0.0&LAYER=${layer}&STYLE=raster&TILEMATRIXSET=EPSG:900913` +
						'&TILEMATRIX=EPSG:900913:{z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg',
				],
				tileSize: 256,
				minzoom: 17,
				maxzoom: 21,
				bounds,
				attribution: attributionMetropoleOrtho(year),
			},
		},
		layers: [
			...style.layers.slice(0, orthoIndex + 1),
			{ id: 'metropole-ortho', type: 'raster', source: 'metropole-ortho' },
			...style.layers.slice(orthoIndex + 1),
		],
	};
}

// Built once so switching back and forth hands MapLibre the same objects.
const METROPOLE_STYLES: Record<AerialStyle, Record<MetropoleOrthoYear, any>> = {
	hybrid: {
		'2023': withMetropoleOrtho(hybridStyle, '2023'),
		'2022': withMetropoleOrtho(hybridStyle, '2022'),
	},
	satellite: {
		'2023': withMetropoleOrtho(satelliteStyle, '2023'),
		'2022': withMetropoleOrtho(satelliteStyle, '2022'),
	},
};

const AERIAL_SOURCE_STORAGE_KEY = 'aerialSource';
const DEFAULT_AERIAL_SOURCE: AerialSource = '2023';

function loadAerialSource(): AerialSource {
	if (typeof globalThis.localStorage === 'undefined') return DEFAULT_AERIAL_SOURCE;
	try {
		const stored = localStorage.getItem(AERIAL_SOURCE_STORAGE_KEY);
		const match = AERIAL_SOURCES.find((s) => s.id === stored);
		if (match) return match.id;
	} catch {}
	return DEFAULT_AERIAL_SOURCE;
}

// Shared by every map, so the choice follows the user from one page to another.
export const aerialSource = $state<{ id: AerialSource }>({ id: loadAerialSource() });

export function setAerialSource(source: AerialSource) {
	aerialSource.id = source;
	if (typeof globalThis.localStorage === 'undefined') return;
	try {
		localStorage.setItem(AERIAL_SOURCE_STORAGE_KEY, source);
	} catch {}
}

const DEFAULT_STYLE_STORAGE_KEY = 'defaultMapStyle';
const FALLBACK_DEFAULT_STYLE: MapStyle = 'cyclopolis';

export function loadDefaultMapStyle(): MapStyle {
	if (typeof globalThis.localStorage === 'undefined') return FALLBACK_DEFAULT_STYLE;
	try {
		const stored = localStorage.getItem(DEFAULT_STYLE_STORAGE_KEY);
		if (isMapStyle(stored)) return stored;
	} catch {}
	return FALLBACK_DEFAULT_STYLE;
}

export function saveDefaultMapStyle(style: MapStyle) {
	if (typeof globalThis.localStorage === 'undefined') return;
	try {
		localStorage.setItem(DEFAULT_STYLE_STORAGE_KEY, style);
	} catch {}
}

export function createMapStyleState(
	initialStyle: MapStyle = 'osm-bright',
	onChange?: (style: MapStyle) => void,
) {
	let mapStyle = $state<MapStyle>(initialStyle);

	function toggleMapStyle() {
		const currentIndex = MAP_STYLE_IDS.indexOf(mapStyle);
		mapStyle = MAP_STYLE_IDS[(currentIndex + 1) % MAP_STYLE_IDS.length];
		onChange?.(mapStyle);
	}

	function setMapStyle(style: MapStyle) {
		mapStyle = style;
		onChange?.(mapStyle);
	}

	function getMapStyleUrl() {
		if (isAerialStyle(mapStyle) && aerialSource.id !== 'ign') {
			return METROPOLE_STYLES[mapStyle][aerialSource.id];
		}
		return MAP_STYLES[mapStyle];
	}

	return {
		get mapStyle() {
			return mapStyle;
		},
		set mapStyle(value: MapStyle) {
			mapStyle = value;
		},
		toggleMapStyle,
		setMapStyle,
		getMapStyleUrl,
	};
}
