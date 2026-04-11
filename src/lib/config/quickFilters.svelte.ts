export interface QuickFilter {
	id: string;
	label: string;
	color: string;
	layerIds: readonly string[] | string[];
}

export const presetQuickFilters: QuickFilter[] = [
	{
		id: 'qf-vl',
		label: 'VL',
		color: '#152B68',
		layerIds: Array.from({ length: 12 }, (_, i) => `vl-${i + 1}`),
	},
	{ id: 'qf-pistes', label: 'Pistes', color: '#15803d', layerIds: ['cycleways'] },
	{ id: 'qf-velov', label: "Vélo'v", color: '#EA2127', layerIds: ['velov'] },
	{
		id: 'qf-parking',
		label: 'Parking',
		color: '#4ade80',
		layerIds: [
			'parking-arceaux',
			'parking-couverts',
			'parking-box',
			'parking-velostation',
			'parking-lpa',
		],
	},
	{
		id: 'qf-transport',
		label: 'Transport',
		color: '#933591',
		layerIds: ['metro', 'tram', 'bus-tb'],
	},
	{
		id: 'qf-pumps',
		label: 'Pompes',
		color: '#e11d48',
		layerIds: ['pumps'],
	},
	{
		id: 'qf-fountains',
		label: 'Fontaines',
		color: '#3b82f6',
		layerIds: ['water-fountains'],
	},
	{
		id: 'qf-communes',
		label: 'Communes',
		color: '#6b7280',
		layerIds: ['communes'],
	},
	{
		id: 'qf-osm-vl',
		label: 'VL OSM',
		color: '#e74c3c',
		layerIds: Array.from({ length: 12 }, (_, i) => `osm-vl-${i + 1}`),
	},
];

const shortLabels: Record<string, string> = {
	'parking-arceaux': 'Arceaux',
	'parking-couverts': 'Couverts',
	'parking-box': 'Box vélo',
	'parking-velostation': 'Vélostations',
	'parking-lpa': 'Parking LPA',
	velov: "Vélo'v",
	metro: 'Métro',
	tram: 'Tram',
	'bus-tb': 'Tram-Bus',
	'bus-main': 'Bus C',
	'bus-other': 'Autres bus',
	pumps: 'Pompes',
	'water-fountains': 'Fontaines',
	communes: 'Communes',
	'target-network': 'Réseau 2040',
	'project-vl': 'VL projet',
	cycleways: 'Pistes',
};

const DEFAULT_QF_IDS = [
	'qf-vl',
	'qf-pistes',
	'qf-velov',
	'qf-parking',
	'qf-transport',
	'qf-pumps',
	'qf-fountains',
];
const QF_STORAGE_KEY = 'quickFilterIds';

export function buildExtraQuickFilters(
	availableLayers: readonly { id: string; label: string; color: string }[],
): QuickFilter[] {
	return availableLayers
		.filter((l) => {
			if (/^(vl|osm-vl)-\d+$/.test(l.id)) return false;
			if (presetQuickFilters.some((qf) => qf.layerIds.length === 1 && qf.layerIds[0] === l.id))
				return false;
			return true;
		})
		.map((l) => ({
			id: `qf-layer-${l.id}`,
			label: shortLabels[l.id] || l.label,
			color: l.color,
			layerIds: [l.id],
		}));
}

export function createQuickFilterState(
	availableLayers: readonly { id: string; label: string; color: string }[],
	visibleLayersFn: () => Set<string>,
	setLayersFn: (layers: string[]) => void,
) {
	const extraQuickFilters = buildExtraQuickFilters(availableLayers);
	const allQuickFilterMap = new Map<string, QuickFilter>(
		[...presetQuickFilters, ...extraQuickFilters].map((qf) => [qf.id, qf]),
	);

	function loadIds(): string[] {
		if (typeof globalThis.localStorage === 'undefined') return DEFAULT_QF_IDS;
		try {
			const stored = localStorage.getItem(QF_STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored) as string[];
				const filtered = parsed.filter((id) => allQuickFilterMap.has(id));
				return filtered.length > 0 ? filtered : DEFAULT_QF_IDS;
			}
		} catch {}
		return DEFAULT_QF_IDS;
	}

	function saveIds(ids: string[]) {
		if (typeof globalThis.localStorage === 'undefined') return;
		try {
			localStorage.setItem(QF_STORAGE_KEY, JSON.stringify(ids));
		} catch {}
	}

	let activeIds = $state(loadIds());

	const activeFilters = $derived(
		activeIds.map((id) => allQuickFilterMap.get(id)).filter((qf): qf is QuickFilter => qf != null),
	);

	const availableExtras = $derived(extraQuickFilters.filter((qf) => !activeIds.includes(qf.id)));

	function toggleVisibility(id: string) {
		if (activeIds.includes(id)) {
			activeIds = activeIds.filter((qfId) => qfId !== id);
		} else {
			activeIds = [...activeIds, id];
		}
		saveIds(activeIds);
	}

	function addCustom(id: string) {
		if (!activeIds.includes(id)) {
			activeIds = [...activeIds, id];
			saveIds(activeIds);
		}
	}

	function remove(id: string) {
		activeIds = activeIds.filter((qfId) => qfId !== id);
		saveIds(activeIds);
	}

	function resetToDefaults() {
		activeIds = [...DEFAULT_QF_IDS];
		saveIds(activeIds);
	}

	function isActive(qf: QuickFilter): boolean {
		return qf.layerIds.some((id) => visibleLayersFn().has(id));
	}

	function toggle(qf: QuickFilter) {
		const currentLayers = new Set(visibleLayersFn());
		const allActive = qf.layerIds.every((id) => currentLayers.has(id));

		if (allActive) {
			qf.layerIds.forEach((id) => currentLayers.delete(id));
		} else {
			qf.layerIds.forEach((id) => currentLayers.add(id));
		}
		setLayersFn(Array.from(currentLayers));
	}

	return {
		get presets() {
			return presetQuickFilters;
		},
		get activeIds() {
			return activeIds;
		},
		get activeFilters() {
			return activeFilters;
		},
		get availableExtras() {
			return availableExtras;
		},
		allQuickFilterMap,
		toggleVisibility,
		addCustom,
		remove,
		resetToDefaults,
		isActive,
		toggle,
	};
}
