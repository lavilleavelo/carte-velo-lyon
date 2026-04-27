import { vlColors } from '$lib/utils/mapUtils';

import parkingCoveredIcon from '$lib/assets/icons/arceau_couvert.png';
import parkingVelostationIcon from '$lib/assets/icons/parking-velostation.png';
import parkingSecureIcon from '$lib/assets/icons/box_securisee_velo.png';
import parkingLpaIcon from '$lib/assets/icons/parking-lpa.png';
import pumpIcon from '$lib/assets/icons/pump.png';
import fountainIcon from '$lib/assets/icons/fontaine.png';

export interface LayerCatalogEntry {
	id: string;
	label: string;
	color: string;
	category: string;
	icon?: string;
	shape?: 'square';
	hasSubFilters?: boolean;
}

export const availableLayers: readonly LayerCatalogEntry[] = [
	{
		id: 'osm-cycleways',
		label: 'Aménagements cyclables',
		color: '#0369a1',
		category: 'Infrastructures Cyclables',
	},
	{
		id: 'cycleways',
		label: 'Aménagements (Grand Lyon)',
		color: '#19181a',
		category: 'Aménagements (Grand Lyon)',
		hasSubFilters: true,
	},
	{
		id: 'parking-arceaux',
		label: 'Arceaux',
		color: '#4ade80',
		category: 'Stationnements',
	},
	{
		id: 'parking-couverts',
		label: 'Arceaux couverts',
		color: '#4ade80',
		icon: parkingCoveredIcon,
		category: 'Stationnements',
	},
	{
		id: 'parking-box',
		label: 'Box sécurisée vélo',
		color: '#4ade80',
		icon: parkingSecureIcon,
		category: 'Stationnements',
	},
	{
		id: 'parking-velostation',
		label: 'Vélostations',
		color: '#10b981',
		icon: parkingVelostationIcon,
		category: 'Stationnements',
	},
	{
		id: 'parking-lpa',
		label: 'Parking LPA / En ouvrage',
		color: '#3b82f6',
		icon: parkingLpaIcon,
		category: 'Stationnements',
	},
	{
		id: 'velov',
		label: 'Stations Velov',
		color: '#EA2127FF',
		icon: '/velov-station.png',
		category: 'Vélov',
	},
	...Array.from({ length: 12 }, (_, i) => ({
		id: `vl-${i + 1}`,
		label: `${i + 1}`,
		color: vlColors[i],
		category: 'Voies Lyonnaises',
	})),
	...Array.from({ length: 12 }, (_, i) => ({
		id: `osm-vl-${i + 1}`,
		label: `${i + 1}`,
		color: vlColors[i],
		category: 'Voies Lyonnaises (OSM)',
	})),
	{
		id: 'local-veloecole',
		label: 'Véloécole',
		color: '#1e5a8a',
		category: 'Local',
		shape: 'square',
	},
	{
		id: 'local-atelier',
		label: "Atelier d'autoréparation",
		color: '#1e5a8a',
		category: 'Local',
		shape: 'square',
	},
	{
		id: 'local-revendeur',
		label: 'Revendeur cycle',
		color: '#1e5a8a',
		category: 'Local',
		shape: 'square',
	},
	{
		id: 'local-loueur',
		label: 'Loueur de vélos',
		color: '#1e5a8a',
		category: 'Local',
		shape: 'square',
	},
	{
		id: 'pumps',
		label: 'Pompe',
		color: '#e11d48',
		icon: pumpIcon,
		category: 'Aires de service',
	},
	{
		id: 'water-fountains',
		label: 'Borne fontaine à eau',
		color: '#3b82f6',
		icon: fountainIcon,
		category: 'Aires de service',
	},
	{
		id: 'toilets',
		label: 'Toilettes publiques',
		color: '#60a5fa',
		category: 'Aires de service',
	},
	{
		id: 'metro',
		label: 'Métro',
		color: '#D53032',
		category: 'Métro / Tram',
	},
	{
		id: 'tram',
		label: 'Tramway',
		color: '#933591',
		category: 'Métro / Tram',
	},
	{
		id: 'bus-tb',
		label: 'Tram-Bus (BHNS)',
		color: '#933591',
		category: 'Métro / Tram',
	},
	{
		id: 'bus-main',
		label: 'Bus (lignes C)',
		color: '#E0C233',
		category: 'Bus',
	},
	{
		id: 'bus-other',
		label: 'Bus (autres)',
		color: '#a3a3a3',
		category: 'Bus',
	},
	{
		id: 'poi-bench',
		label: 'Bancs',
		color: '#78716c',
		category: 'Confort & Repos',
	},
	{
		id: 'poi-picnic-table',
		label: 'Tables de pique-nique',
		color: '#65a30d',
		category: 'Confort & Repos',
	},
	{
		id: 'poi-pharmacy',
		label: 'Pharmacies',
		color: '#16a34a',
		category: 'Santé & Sécurité',
	},
	{
		id: 'poi-defibrillator',
		label: 'Défibrillateurs',
		color: '#dc2626',
		category: 'Santé & Sécurité',
	},
	{
		id: 'metropole',
		label: 'Métropole de Lyon',
		color: '#1e3a5f',
		category: 'Communes',
	},
	{
		id: 'communes',
		label: 'Limites des communes',
		color: '#6b7280',
		category: 'Communes',
	},
	{
		id: 'counters-velo',
		label: 'Compteurs vélo',
		color: '#2563eb',
		category: 'Compteurs',
	},
	{
		id: 'counters-voiture',
		label: 'Compteurs voiture',
		color: '#dc2626',
		category: 'Compteurs',
	},
	{
		id: 'schools-maternelle',
		label: 'Écoles maternelles',
		color: '#f59e0b',
		category: 'Établissements scolaires',
	},
	{
		id: 'schools-elementaire',
		label: 'Écoles élémentaires',
		color: '#3b82f6',
		category: 'Établissements scolaires',
	},
	{
		id: 'schools-college',
		label: 'Collèges',
		color: '#8b5cf6',
		category: 'Établissements scolaires',
	},
	{
		id: 'schools-lycee',
		label: 'Lycées',
		color: '#ef4444',
		category: 'Établissements scolaires',
	},
	{
		id: 'speed-limit-5',
		label: '≤ 5 km/h',
		color: '#648FFF',
		category: 'Limitations de vitesse',
	},
	{
		id: 'speed-limit-30',
		label: '≤ 30 km/h',
		color: '#785EF0',
		category: 'Limitations de vitesse',
	},
	{
		id: 'speed-limit-50',
		label: '50 km/h',
		color: '#FFB000',
		category: 'Limitations de vitesse',
	},
	{
		id: 'speed-limit-70',
		label: '70+ km/h',
		color: '#ff0000',
		category: 'Limitations de vitesse',
	},
	{
		id: 'speed-limit-unknown',
		label: 'Inconnu',
		color: '#6b7280',
		category: 'Limitations de vitesse',
	},
	{
		id: 'target-network',
		label: 'Réseau Cible LVV 2040',
		color: '#9333ea',
		category: 'Projets',
		hasSubFilters: true,
	},
	{
		id: 'project-vl',
		label: 'Voies Lyonnaises (WIP)',
		color: '#19181a',
		category: 'Projets',
		hasSubFilters: true,
	},
] as const;

export const layerGroups: Record<string, string[]> = {
	vl: Array.from({ length: 12 }, (_, i) => `vl-${i + 1}`),
	'osm-vl': Array.from({ length: 12 }, (_, i) => `osm-vl-${i + 1}`),
	'speed-limits': [
		'speed-limit-5',
		'speed-limit-30',
		'speed-limit-50',
		'speed-limit-70',
		'speed-limit-unknown',
	],
	parking: [
		'parking-arceaux',
		'parking-couverts',
		'parking-box',
		'parking-velostation',
		'parking-lpa',
	],
	fountains: ['water-fountains'],
};

export function expandLayers(layers: readonly string[]): string[] {
	const expanded: string[] = [];
	for (const id of layers) {
		if (layerGroups[id]) {
			expanded.push(...layerGroups[id]);
		} else {
			expanded.push(id);
		}
	}
	return expanded;
}

export function compactLayers(layers: readonly string[]): string[] {
	const set = new Set(layers);
	const result: string[] = [];
	const consumed = new Set<string>();

	for (const [group, members] of Object.entries(layerGroups)) {
		if (group === 'fountains') continue; // legacy-only alias, never emit
		if (members.every((m) => set.has(m))) {
			result.push(group);
			members.forEach((m) => consumed.add(m));
		}
	}

	for (const id of layers) {
		if (!consumed.has(id)) {
			result.push(id);
		}
	}

	return result;
}

export interface PinnedItem {
	key: string;
	label: string;
	color: string;
	yearIncompatible?: boolean;
	kind: 'fine' | 'category';
	target: string;
	gateCategory?: string;
}

export const COMMUNE_PINNED: PinnedItem[] = [
	{
		key: 'pin-cycleways',
		label: 'Aménagements (Grand Lyon)',
		color: '#19181a',
		kind: 'fine',
		target: 'cycleways',
		gateCategory: 'Aménagements (Grand Lyon)',
	},
	{
		key: 'pin-osm-cycleways',
		label: 'Aménagements cyclables',
		color: '#15803d',
		yearIncompatible: true,
		kind: 'fine',
		target: 'osm-cycleways',
	},
	{
		key: 'pin-vl',
		label: 'Voies Lyonnaises',
		color: '#152B68',
		kind: 'category',
		target: 'Voies Lyonnaises',
	},
	{
		key: 'pin-parking',
		label: 'Stationnement',
		color: '#4ade80',
		kind: 'category',
		target: 'Stationnements',
	},
	{
		key: 'pin-velov',
		label: 'Vélo’v',
		color: '#EA2127',
		yearIncompatible: true,
		kind: 'fine',
		target: 'velov',
	},
	{
		key: 'pin-metro',
		label: 'Métro / Tram',
		color: '#933591',
		yearIncompatible: true,
		kind: 'category',
		target: 'Métro / Tram',
	},
	{
		key: 'pin-bus',
		label: 'Bus',
		color: '#933591',
		yearIncompatible: true,
		kind: 'category',
		target: 'Bus',
	},
	{
		key: 'pin-speed',
		label: 'Limitations de vitesse',
		color: '#785EF0',
		yearIncompatible: true,
		kind: 'category',
		target: 'Limitations de vitesse',
	},
];

export const optionalCategories = [
	'Aménagements (Grand Lyon)',
	'Voies Lyonnaises (OSM)',
	'Compteurs',
	'Confort & Repos',
	'Santé & Sécurité',
	'Établissements scolaires',
	'Projets',
] as const;

const OPTIONAL_CATEGORIES_KEY = 'visibleOptionalCategories';

export function loadVisibleOptionalCategories(): Set<string> {
	if (typeof globalThis.localStorage === 'undefined') return new Set<string>();
	try {
		const stored = localStorage.getItem(OPTIONAL_CATEGORIES_KEY);
		if (stored) {
			const parsed = JSON.parse(stored) as string[];
			return new Set(parsed.filter((c) => (optionalCategories as readonly string[]).includes(c)));
		}
	} catch {}
	return new Set<string>();
}

export function saveVisibleOptionalCategories(categories: Set<string>) {
	if (typeof globalThis.localStorage === 'undefined') return;
	try {
		localStorage.setItem(OPTIONAL_CATEGORIES_KEY, JSON.stringify([...categories]));
	} catch {}
}

export function groupLayersByCategory<T extends { category: string }>(
	layers: readonly T[],
): Map<string, T[]> {
	const grouped = new Map<string, T[]>();
	for (const layer of layers) {
		const list = grouped.get(layer.category);
		if (list) {
			list.push(layer);
		} else {
			grouped.set(layer.category, [layer]);
		}
	}
	return grouped;
}
