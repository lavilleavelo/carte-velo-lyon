import { Icons } from './icons';
import { vlColors } from '$lib/utils/mapUtils';

export interface LayerConfig {
	id: string;
	label: string;
	category:
		| 'cycling'
		| 'parking'
		| 'transport'
		| 'services'
		| 'voies-lyonnaises'
		| 'projects'
		| 'communes';
	interactableLayerIds: string[];
	featureType: string;
	defaultEnabled?: boolean;
	formatPopup?: (properties: any) => string;
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
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.bike('#15803d')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">${p.typeamenagement}</span>
						${p.localisation ? `<span class="text-xs">${p.localisation}</span>` : ''}
					</div>
				</div>`;
		},
	},

	// Parking
	{
		id: 'parking-arceaux',
		label: 'Arceaux vélo',
		category: 'parking',
		interactableLayerIds: ['parking-layer-circles-hitarea'],
		featureType: 'parking',
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.parking('#6b7280')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">Arceaux</span>
						<span class="text-xs">Capacité: ${p.capacite ?? '?'}</span>
					</div>
				</div>`;
		},
	},
	{
		id: 'parking-couverts',
		label: 'Arceaux couverts',
		category: 'parking',
		interactableLayerIds: ['parking-layer-roof-hitarea'],
		featureType: 'parking',
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.parking('#6b7280')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">Arceaux couverts</span>
						<span class="text-xs">Capacité: ${p.capacite ?? '?'}</span>
					</div>
				</div>`;
		},
	},
	{
		id: 'parking-box',
		label: 'Box sécurisés',
		category: 'parking',
		interactableLayerIds: ['parking-layer-box-hitarea'],
		featureType: 'parking',
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.parking('#6b7280')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">Box sécurisé</span>
						<span class="text-xs">Capacité: ${p.capacite ?? '?'}</span>
					</div>
				</div>`;
		},
	},
	{
		id: 'parking-velostation',
		label: 'Vélostation',
		category: 'parking',
		interactableLayerIds: ['parking-layer-velostation-hitarea'],
		featureType: 'parking',
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.parking('#6b7280')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">Vélostation</span>
						<span class="text-xs">Capacité: ${p.capacite ?? '?'}</span>
					</div>
				</div>`;
		},
	},
	{
		id: 'parking-lpa',
		label: 'Parking LPA',
		category: 'parking',
		interactableLayerIds: ['parking-layer-lpa-hitarea'],
		featureType: 'parking',
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.parking('#6b7280')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">Parking LPA</span>
						<span class="text-xs">Capacité: ${p.capacite ?? '?'}</span>
					</div>
				</div>`;
		},
	},

	// Velov
	{
		id: 'velov',
		label: "Stations Vélo'v",
		category: 'services',
		interactableLayerIds: ['velov-stations-layer-hitarea'],
		featureType: 'velov',
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<img src="/velov-station.png" class="h-5 w-5 object-contain" alt="Logo Vélo'v" />
					<div class="flex flex-col">
						<span class="font-bold text-sm">${p.nom}</span>
						<span class="text-xs">${p.adresse1}${p.commune ? `, ${p.commune}` : ''}</span>
						<span class="text-xs mt-1">🚲 ${p.available_bikes ?? '?'} - 🅿️ ${p.available_stands ?? '?'}</span>
					</div>
				</div>`;
		},
	},

	// Transport
	{
		id: 'metro',
		label: 'Métro',
		category: 'transport',
		interactableLayerIds: ['metro-layer-hitarea'],
		featureType: 'metro',
		formatPopup: (p) => {
			return `
				<div class="flex items-center gap-2">
					<div class="shrink-0 flex items-center justify-center font-bold text-xs h-5 w-5 rounded-full text-white" style="background-color: ${p.color}">M</div>
					<span class="font-bold text-sm" style="color: ${p.color}">Métro ${p.ligne}</span>
				</div>`;
		},
	},
	{
		id: 'tram',
		label: 'Tramway',
		category: 'transport',
		interactableLayerIds: ['tram-layer-hitarea'],
		featureType: 'tram',
		formatPopup: (p) => {
			return `
				<div class="flex items-center gap-2">
					<div class="shrink-0 flex items-center justify-center font-bold text-xs h-5 w-5 rounded-full text-white" style="background-color: ${p.color}">T</div>
					<span class="font-bold text-sm" style="color: ${p.color}">Tram ${p.ligne}</span>
				</div>`;
		},
	},
	{
		id: 'bus-tb',
		label: 'Bus (lignes fortes)',
		category: 'transport',
		interactableLayerIds: ['bus-layer-tb-hitarea'],
		featureType: 'bus',
		formatPopup: (p) => {
			return `
				<div class="flex items-center gap-2">
					<div class="shrink-0">${Icons.bus(p.color)}</div>
					<span class="font-bold text-sm" style="color: ${p.color}">Bus ${p.ligne}</span>
				</div>`;
		},
	},
	{
		id: 'bus-std',
		label: 'Bus (standard)',
		category: 'transport',
		interactableLayerIds: ['bus-layer-std-hitarea'],
		featureType: 'bus',
		formatPopup: (p) => {
			return `
				<div class="flex items-center gap-2">
					<div class="shrink-0">${Icons.bus(p.color)}</div>
					<span class="font-bold text-sm" style="color: ${p.color}">Bus ${p.ligne}</span>
				</div>`;
		},
	},

	// Services
	{
		id: 'pumps',
		label: 'Pompes à vélo',
		category: 'services',
		interactableLayerIds: ['pumps-layer-hitarea'],
		featureType: 'pump',
		formatPopup: () => {
			return `
				<div class="flex items-center gap-2">
					<div class="mt-0.5 shrink-0">${Icons.pump('#e11d48')}</div>
					<span class="font-bold text-sm">Pompe à vélo</span>
				</div>`;
		},
	},
	{
		id: 'water-fountains',
		label: "Fontaines d'eau",
		category: 'services',
		interactableLayerIds: ['fountains-layer-hitarea'],
		featureType: 'water-fountain',
		formatPopup: () => {
			return `
				<div class="flex items-center gap-2">
					<div class="mt-0.5 shrink-0">${Icons.water('#2563eb')}</div>
					<span class="font-bold text-sm">Fontaine à eau</span>
				</div>`;
		},
	},

	{
		id: 'target-network',
		label: 'Réseau Cible 2040',
		category: 'projects',
		interactableLayerIds: ['target-network-hitarea'],
		featureType: 'target-network',
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<img src="/logo_lvv.png" class="h-5 w-5 object-contain" alt="Logo La Ville à Vélo" />
					<div class="flex flex-col">
						<span class="font-bold text-sm">${p.displayName}</span>
						${p.description ? `<span class="text-xs text-gray-600 mt-1">${p.description}</span>` : ''}
					</div>
				</div>`;
		},
	},
	{
		id: 'project-vl',
		label: 'Voies Lyonnaises (Projet)',
		category: 'projects',
		interactableLayerIds: Array.from({ length: 12 }, (_, i) => `vl-project-${i + 1}-line-hitarea`),
		featureType: 'project-vl',
		formatPopup: () => {
			return `
				<div class="flex items-center gap-2">
					<div class="mt-0.5 shrink-0">${Icons.construction('#eab308')}</div>
					<span class="font-bold text-sm">Projet Voie Lyonnaise</span>
				</div>`;
		},
	},

	{
		id: 'communes',
		label: 'Limites des communes',
		category: 'communes',
		interactableLayerIds: ['communes-layer-hitarea'],
		featureType: 'commune',
		formatPopup: (p) => {
			return `
				<div class="flex items-center gap-2">
					<div class="mt-0.5 shrink-0">${Icons.commune('#6b7280')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">${p.nom}</span>
						<span class="text-xs text-gray-600">${p.insee}</span>
					</div>
				</div>`;
		},
	},
];

export function getVoiesLyonnaisesConfigs(): LayerConfig[] {
	return Array.from({ length: 12 }, (_, i) => i + 1).map((num) => ({
		id: `vl-${num}`,
		label: `Voie Lyonnaise ${num}`,
		category: 'voies-lyonnaises' as const,
		interactableLayerIds: [`vl-${num}-line-hitarea`],
		featureType: `vl-${num}`,
		formatPopup: (p) => {
			let content = `
				<div class="flex items-start gap-2">
					<div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-xs" style="background-color: ${vlColors[num - 1]}">
						${num}
					</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">Voie Lyonnaise ${p.line}</span>
						${
							p.status === 'wip'
								? `<span class="text-xs text-blue-800 font-medium">En travaux</span>`
								: p.status === 'planned'
									? `<span class="text-xs text-purple-800 font-medium">Prévu pour 2026</span>`
									: p.status === 'variante'
										? `<span class="text-xs text-purple-800 font-medium">Variante (Prévu)</span>`
										: ''
						}
					</div>
				</div>`;
			return content;
		},
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
