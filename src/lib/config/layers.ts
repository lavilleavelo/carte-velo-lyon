export interface LayerConfig {
	id: string;
	label: string;
	category: 'cycling' | 'parking' | 'transport' | 'services' | 'voies-lyonnaises';
	interactableLayerIds: string[];
	featureType: string;
	defaultEnabled?: boolean;
}

export const layerConfigs: LayerConfig[] = [
	// Cycling infrastructure
	{
		id: 'cycleways',
		label: 'Aménagements cyclables',
		category: 'cycling',
		interactableLayerIds: ['cycleways-layer-hitarea'],
		featureType: 'cycleway',
		defaultEnabled: true,
	},

	// Parking
	{
		id: 'parking-arceaux',
		label: 'Arceaux vélo',
		category: 'parking',
		interactableLayerIds: ['parking-layer-circles-hitarea'],
		featureType: 'parking',
	},
	{
		id: 'parking-couverts',
		label: 'Arceaux couverts',
		category: 'parking',
		interactableLayerIds: ['parking-layer-roof-hitarea'],
		featureType: 'parking',
	},
	{
		id: 'parking-box',
		label: 'Box sécurisés',
		category: 'parking',
		interactableLayerIds: ['parking-layer-box-hitarea'],
		featureType: 'parking',
	},
	{
		id: 'parking-velostation',
		label: 'Vélostation',
		category: 'parking',
		interactableLayerIds: ['parking-layer-velostation-hitarea'],
		featureType: 'parking',
	},
	{
		id: 'parking-lpa',
		label: 'Parking LPA',
		category: 'parking',
		interactableLayerIds: ['parking-layer-lpa-hitarea'],
		featureType: 'parking',
	},

	// Velov
	{
		id: 'velov',
		label: "Stations Vélo'v",
		category: 'services',
		interactableLayerIds: ['velov-stations-layer-hitarea'],
		featureType: 'velov',
	},

	// Transport
	{
		id: 'metro',
		label: 'Métro',
		category: 'transport',
		interactableLayerIds: ['metro-layer-hitarea'],
		featureType: 'metro',
	},
	{
		id: 'tram',
		label: 'Tramway',
		category: 'transport',
		interactableLayerIds: ['tram-layer-hitarea'],
		featureType: 'tram',
	},
	{
		id: 'bus-tb',
		label: 'Bus (lignes fortes)',
		category: 'transport',
		interactableLayerIds: ['bus-layer-tb-hitarea'],
		featureType: 'bus',
	},
	{
		id: 'bus-std',
		label: 'Bus (standard)',
		category: 'transport',
		interactableLayerIds: ['bus-layer-std-hitarea'],
		featureType: 'bus',
	},

	// Services
	{
		id: 'pumps',
		label: 'Pompes à vélo',
		category: 'services',
		interactableLayerIds: ['pumps-layer-hitarea'],
		featureType: 'pump',
	},
	{
		id: 'water-fountains',
		label: "Fontaines d'eau",
		category: 'services',
		interactableLayerIds: ['fountains-layer-hitarea'],
		featureType: 'water-fountain',
	},
];

export function getVoiesLyonnaisesConfigs(): LayerConfig[] {
	return Array.from({ length: 12 }, (_, i) => i + 1).map((num) => ({
		id: `vl-${num}`,
		label: `Voie Lyonnaise ${num}`,
		category: 'voies-lyonnaises' as const,
		interactableLayerIds: [`vl-${num}-line-hitarea`],
		featureType: `vl-${num}`,
	}));
}

export function getAllLayerConfigs(): LayerConfig[] {
	return [...layerConfigs, ...getVoiesLyonnaisesConfigs()];
}

export function getInteractableLayerIds(isLayerVisible: (id: string) => boolean): string[] {
	const allConfigs = getAllLayerConfigs();
	const interactableIds: string[] = [];

	for (const config of allConfigs) {
		if (isLayerVisible(config.id)) {
			interactableIds.push(...config.interactableLayerIds);
		}
	}

	return interactableIds;
}

export function createLayerToFeatureTypeMap(): Map<string, string> {
	const map = new Map<string, string>();
	const allConfigs = getAllLayerConfigs();

	for (const config of allConfigs) {
		for (const layerId of config.interactableLayerIds) {
			map.set(layerId, config.featureType);
			map.set(layerId.replace('-hitarea', ''), config.featureType);
		}
	}

	return map;
}
