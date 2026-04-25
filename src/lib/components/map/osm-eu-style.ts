const osmAttribution =
	'<a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

const onewayArrowFont = ['Noto Sans Regular'];
const onewayArrowPaint = {
	'text-color': '#5b6470',
	'text-halo-color': '#ffffff',
	'text-halo-width': 1.5,
};
const onewayMajorClasses = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];

const osmEuStyle = {
	version: 8,
	id: 'osm-eu',
	name: 'OSM-eu',
	sources: {
		'raster-tiles': {
			type: 'raster',
			tiles: ['https://tile.openstreetmap.bzh/eu/{z}/{x}/{y}.png'],
			tileSize: 256,
			attribution: [
				'<a href="https://tile.openstreetmap.bzh" target="_blank">OpenStreetMap.bzh</a>',
				osmAttribution,
			].join(' | '),
		},
		openmaptiles: {
			type: 'vector',
			url: 'https://tiles.openfreemap.org/planet',
		},
	},
	glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
	layers: [
		{
			id: 'simple-tiles',
			type: 'raster',
			source: 'raster-tiles',
			minzoom: 0,
			maxzoom: 22,
		},
		{
			id: 'oneway-arrows-forward-major',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'transportation',
			minzoom: 14,
			filter: [
				'all',
				['==', ['get', 'oneway'], 1],
				['in', ['get', 'class'], ['literal', onewayMajorClasses]],
			],
			layout: {
				'symbol-placement': 'line',
				'symbol-spacing': 180,
				'text-font': onewayArrowFont,
				'text-size': 36,
				'text-rotation-alignment': 'map',
				'text-pitch-alignment': 'viewport',
				'text-keep-upright': false,
				'text-field': '→',
			},
			paint: onewayArrowPaint,
		},
		{
			id: 'oneway-arrows-reverse-major',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'transportation',
			minzoom: 14,
			filter: [
				'all',
				['==', ['get', 'oneway'], -1],
				['in', ['get', 'class'], ['literal', onewayMajorClasses]],
			],
			layout: {
				'symbol-placement': 'line',
				'symbol-spacing': 180,
				'text-font': onewayArrowFont,
				'text-size': 36,
				'text-rotation-alignment': 'map',
				'text-pitch-alignment': 'viewport',
				'text-keep-upright': false,
				'text-field': '←',
			},
			paint: onewayArrowPaint,
		},
		{
			id: 'oneway-arrows-forward-minor',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'transportation',
			minzoom: 14,
			filter: [
				'all',
				['==', ['get', 'oneway'], 1],
				['!', ['in', ['get', 'class'], ['literal', onewayMajorClasses]]],
			],
			layout: {
				'symbol-placement': 'line',
				'symbol-spacing': 180,
				'text-font': onewayArrowFont,
				'text-size': 36,
				'text-rotation-alignment': 'map',
				'text-pitch-alignment': 'viewport',
				'text-keep-upright': false,
				'text-field': '→',
			},
			paint: onewayArrowPaint,
		},
		{
			id: 'oneway-arrows-reverse-minor',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'transportation',
			minzoom: 14,
			filter: [
				'all',
				['==', ['get', 'oneway'], -1],
				['!', ['in', ['get', 'class'], ['literal', onewayMajorClasses]]],
			],
			layout: {
				'symbol-placement': 'line',
				'symbol-spacing': 180,
				'text-font': onewayArrowFont,
				'text-size': 36,
				'text-rotation-alignment': 'map',
				'text-pitch-alignment': 'viewport',
				'text-keep-upright': false,
				'text-field': '←',
			},
			paint: onewayArrowPaint,
		},
	],
	bearing: 0,
	pitch: 0,
	center: [0, 0],
	zoom: 1,
};

export default osmEuStyle;
