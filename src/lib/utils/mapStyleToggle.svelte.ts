import hybridStyle from '$lib/components/map/hybrid-style.json';
import cyclopolisStyle from '$lib/components/map/cyclopolis-style.json';
import osmBrightStyle from '$lib/components/map/osm-bright-style.json';
import neutrinoStyle from '$lib/components/map/neutrino-style.json';
import positronStyle from '$lib/components/map/positron-style.json';
import osmEuStyle from '$lib/components/map/osm-eu-style';

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

const cyclosmAttribution =
	'<a href="https://cyclosm.org" target="_blank">CyclOSM</a> (<a href="https://www.cyclosm.org/legend.html" target="_blank">Legende</a>)';
const osmAttribution =
	'<a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

const cyclosmStyle = {
	version: 8,
	id: 'cyclosm',
	name: 'CyclOSM',
	sources: {
		'raster-tiles': {
			type: 'raster',
			tiles: ['https://c.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png'],
			tileSize: 256,
			attribution: [cyclosmAttribution, osmAttribution].join(' | '),
		},
		openmaptiles: {
			type: 'vector',
			url: 'https://openmaptiles.data.gouv.fr/data/planet-vector.json',
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
			attribution: 'IGN - BD ORTHO',
		},
	},
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
