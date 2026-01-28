import hybridStyle from '$lib/components/map/hybrid-style.json';

export type MapStyle = 'positron' | 'osm-bright' | 'hybrid';

export const MAP_STYLES: Record<MapStyle, any> = {
	positron: 'https://tiles.openfreemap.org/styles/positron',
	'osm-bright': 'https://openmaptiles.geo.data.gouv.fr/styles/osm-bright/style.json',
	hybrid: hybridStyle,
};

export function createMapStyleState(initialStyle: MapStyle = 'osm-bright') {
	let mapStyle = $state<MapStyle>(initialStyle);

	function toggleMapStyle() {
		mapStyle =
			mapStyle === 'positron' ? 'osm-bright' : mapStyle === 'osm-bright' ? 'hybrid' : 'positron';
	}

	function getMapStyleUrl() {
		return MAP_STYLES[mapStyle];
	}

	return {
		get mapStyle() {
			return mapStyle;
		},
		toggleMapStyle,
		getMapStyleUrl,
	};
}
