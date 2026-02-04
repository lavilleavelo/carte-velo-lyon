import hybridStyle from '$lib/components/map/hybrid-style.json';

export type MapStyle = 'positron' | 'osm-bright' | 'hybrid' | 'cyclosm';

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

export const MAP_STYLES: Record<MapStyle, any> = {
	positron: 'https://tiles.openfreemap.org/styles/positron',
	'osm-bright': 'https://openmaptiles.geo.data.gouv.fr/styles/osm-bright/style.json',
	hybrid: hybridStyle,
	cyclosm: cyclosmStyle,
};

export function createMapStyleState(
	initialStyle: MapStyle = 'osm-bright',
	onChange?: (style: MapStyle) => void,
) {
	let mapStyle = $state<MapStyle>(initialStyle);

	function toggleMapStyle() {
		const styles: MapStyle[] = ['positron', 'osm-bright', 'hybrid', 'cyclosm'];
		const currentIndex = styles.indexOf(mapStyle);
		mapStyle = styles[(currentIndex + 1) % styles.length];
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
