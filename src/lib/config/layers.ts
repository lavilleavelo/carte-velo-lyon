import { Icons } from './icons';
import { vlColors } from '$lib/utils/mapUtils';
import { isPavedSurface } from '$lib/utils/osmCycleway';
import { SPEED_BUCKET_COLORS, bucketForSpeed } from '$lib/utils/speedLimits';
import {
	getItineraires,
	getItineraireColor,
	getItineraireLabel,
	itineraireLayerId,
} from './itineraires';

export interface PopupContext {
	isLayerVisible?: (id: string) => boolean;
}

export interface LayerConfig {
	id: string;
	label: string;
	category:
		| 'cycling'
		| 'osm-cycling'
		| 'parking'
		| 'transport'
		| 'services'
		| 'voies-lyonnaises'
		| 'osm-vl'
		| 'projects'
		| 'communes'
		| 'schools'
		| 'local'
		| 'comfort'
		| 'safety'
		| 'voirie'
		| 'itineraires';
	interactableLayerIds: string[];
	featureType: string;
	defaultEnabled?: boolean;
	formatPopup?: (properties: any, context?: PopupContext) => string;
	minZoomPopup?: number;
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
			const isPiste = p.typeamenagement === 'Piste Cyclable';
			const bidir = p.senscirculation === 'Double';
			const label = isPiste
				? `${p.typeamenagement} (${bidir ? 'bidirectionnelle' : 'unidirectionnelle'})`
				: p.typeamenagement;
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.bike('#15803d')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">${label}</span>
						${p.localisation ? `<span class="text-xs">${p.localisation}</span>` : ''}
					</div>
				</div>`;
		},
		minZoomPopup: 14,
	},

	// Cycling infrastructure (OSM)
	{
		id: 'osm-cycleways',
		label: 'Aménagements cyclables (OSM)',
		category: 'osm-cycling',
		interactableLayerIds: ['osm-cycleways-layer-hitarea'],
		featureType: 'osm-cycleway',
		formatPopup: (p, ctx) => {
			const name = p.name ? `<span class="text-xs">${p.name}</span>` : '';
			const showSource = ctx?.isLayerVisible?.('cycleways') === true;
			const source = showSource
				? `<span class="text-xs text-gray-500">Source: OpenStreetMap</span>`
				: '';
			const isPiste = p.typeamenagement === 'Piste Cyclable';
			const isVoieVerte = p.typeamenagement === 'Voie verte';
			const label = isPiste
				? `${p.typeamenagement} (${p.bidirectional ? 'bidir.' : 'unidir.'})`
				: p.typeamenagement || 'Aménagement cyclable';
			let surfaceLine = '';
			if (isVoieVerte) {
				const rawSurface = typeof p.surface === 'string' ? p.surface : '';
				if (rawSurface) {
					const paved = isPavedSurface(rawSurface);
					const tone = paved ? 'text-emerald-700' : 'text-amber-700';
					surfaceLine = `<span class="text-xs ${tone}"><span class="text-gray-400">(${rawSurface})</span></span>`;
				} else {
					surfaceLine = `<span class="text-xs text-gray-500">Revêtement non renseigné</span>`;
				}
			}
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.bike('#0369a1')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">${label}</span>
						${name}
						${surfaceLine}
						${source}
					</div>
				</div>`;
		},
		minZoomPopup: 14,
	},

	// Speed limits (GrandLyon pvochausseetrottoir)
	{
		id: 'speed-limits',
		label: 'Limitations de vitesse',
		category: 'voirie',
		interactableLayerIds: ['speed-limits-hitarea'],
		featureType: 'speed-limit',
		formatPopup: (p) => {
			const raw = p.limitationvitesse;
			const bucket = bucketForSpeed(raw);
			const color = SPEED_BUCKET_COLORS[bucket];
			const street = p.nomvoie1 || p.nomvoie || p.nomvoie2 || '';
			const streetLine = street
				? `<span class="text-xs text-gray-700">${street}</span>`
				: `<span class="text-xs text-gray-400 italic">Voie sans nom</span>`;
			const speedLine =
				raw !== undefined && raw !== null && raw !== ''
					? `<span class="text-xs"><span class="text-gray-500">Limite :</span> <span class="font-semibold">${raw}&nbsp;km/h</span></span>`
					: `<span class="text-xs text-gray-500 italic">Limite de vitesse inconnue</span>`;
			const zone = p.reglementationzca
				? `<span class="text-xs"><span class="text-gray-500">Zone :</span> ${p.reglementationzca}</span>`
				: '';
			const lengthMeters = Number(p.longueurcalculee);
			const lengthLine =
				Number.isFinite(lengthMeters) && lengthMeters > 0
					? `<span class="text-xs"><span class="text-gray-500">Longueur :</span> ${Math.round(lengthMeters).toLocaleString('fr-FR')}&nbsp;m</span>`
					: '';

			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.gauge(color)}</div>
					<div class="flex flex-col gap-0.5">
						${streetLine}
						${speedLine}
						${zone}
						${lengthLine}
					</div>
				</div>`;
		},
		minZoomPopup: 13,
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
		label: 'Tram-Bus (BHNS)',
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
		id: 'bus-main',
		label: 'Bus (lignes C)',
		category: 'transport',
		interactableLayerIds: ['bus-layer-main-hitarea'],
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
		id: 'bus-other',
		label: 'Bus (autres lignes)',
		category: 'transport',
		interactableLayerIds: ['bus-layer-other-hitarea'],
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
		id: 'toilets',
		label: 'Toilettes publiques',
		category: 'services',
		interactableLayerIds: ['toilets-layer-hitarea'],
		featureType: 'toilet',
		formatPopup: (p) => {
			const details = [p.wheelchair ? '♿ Accessible' : null, p.fee ? '💰 Payant' : '✅ Gratuit']
				.filter(Boolean)
				.join(' · ');
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.toilet('#7c3aed')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">${p.name || 'Toilettes publiques'}</span>
						${p.operator ? `<span class="text-xs">${p.operator}</span>` : ''}
						${details ? `<span class="text-xs mt-0.5">${details}</span>` : ''}
					</div>
				</div>`;
		},
	},

	// Counters
	{
		id: 'counters-velo',
		label: 'Compteurs vélo',
		category: 'projects',
		interactableLayerIds: ['counters-velo-hitarea'],
		featureType: 'counter',
		formatPopup: (p) => {
			const lastCount = p.lastCount != null ? Number(p.lastCount).toLocaleString('fr-FR') : '?';
			const lastMonth = p.lastMonth
				? new Date(p.lastMonth).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
				: '';
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.bike('#1e3a5f')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">${p.name}</span>
						${p.arrondissement ? `<span class="text-xs text-gray-500">${p.arrondissement}</span>` : ''}
						${lastMonth ? `<span class="text-xs mt-1">${lastCount} vélos/mois en ${lastMonth}</span>` : ''}
					</div>
				</div>`;
		},
	},
	{
		id: 'counters-voiture',
		label: 'Compteurs voiture',
		category: 'projects',
		interactableLayerIds: ['counters-voiture-hitarea'],
		featureType: 'counter',
		formatPopup: (p) => {
			const lastCount = p.lastCount != null ? Number(p.lastCount).toLocaleString('fr-FR') : '?';
			const lastMonth = p.lastMonth
				? new Date(p.lastMonth).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
				: '';
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.bus('#dc2626')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">${p.name}</span>
						${p.arrondissement ? `<span class="text-xs text-gray-500">${p.arrondissement}</span>` : ''}
						${lastMonth ? `<span class="text-xs mt-1">${lastCount} voitures/mois en ${lastMonth}</span>` : ''}
					</div>
				</div>`;
		},
	},

	{
		id: 'target-network',
		label: 'Réseau Cible LVV 2040',
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
		label: 'Voies Lyonnaises (wip)',
		category: 'projects',
		interactableLayerIds: Array.from({ length: 12 }, (_, i) => `vl-project-${i + 1}-line-hitarea`),
		featureType: 'project-vl',
		minZoomPopup: 13,
		formatPopup: (p) => {
			return `
			<div class="flex items-center gap-2">
				<div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-xs" style="background-color: ${vlColors[p.line - 1]}">
					${p.line}
				</div>
				<span class="font-bold text-sm">Voie Lyonnaise ${p.line}</span>
			</div>
			<div class="text-xs text-gray-600">${p.status === 'wip' ? 'En travaux' : 'Prévu pour 2026'}</span>`;
		},
	},

	{
		id: 'metropole',
		label: 'Métropole de Lyon',
		category: 'communes',
		interactableLayerIds: [],
		featureType: 'commune',
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

	// Schools
	{
		id: 'schools-maternelle',
		label: 'Écoles maternelles',
		category: 'schools',
		interactableLayerIds: ['schools-maternelle-hitarea'],
		featureType: 'school',
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.school('#f59e0b')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">${p.name || 'École maternelle'}</span>
						<span class="text-xs text-gray-500">Maternelle</span>
						${p.operator ? `<span class="text-xs">${p.operator}</span>` : ''}
					</div>
				</div>`;
		},
	},
	{
		id: 'schools-elementaire',
		label: 'Écoles élémentaires',
		category: 'schools',
		interactableLayerIds: ['schools-elementaire-hitarea'],
		featureType: 'school',
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.school('#3b82f6')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">${p.name || 'École élémentaire'}</span>
						<span class="text-xs text-gray-500">Élémentaire</span>
						${p.operator ? `<span class="text-xs">${p.operator}</span>` : ''}
					</div>
				</div>`;
		},
	},
	{
		id: 'schools-college',
		label: 'Collèges',
		category: 'schools',
		interactableLayerIds: ['schools-college-hitarea'],
		featureType: 'school',
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.school('#8b5cf6')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">${p.name || 'Collège'}</span>
						<span class="text-xs text-gray-500">Collège</span>
						${p.operator ? `<span class="text-xs">${p.operator}</span>` : ''}
					</div>
				</div>`;
		},
	},
	{
		id: 'schools-lycee',
		label: 'Lycées',
		category: 'schools',
		interactableLayerIds: ['schools-lycee-hitarea'],
		featureType: 'school',
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.school('#ef4444')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">${p.name || 'Lycée'}</span>
						<span class="text-xs text-gray-500">Lycée</span>
						${p.operator ? `<span class="text-xs">${p.operator}</span>` : ''}
					</div>
				</div>`;
		},
	},

	// Local — bike commerce & services
	{
		id: 'local-veloecole',
		label: 'Véloécole',
		category: 'local',
		interactableLayerIds: ['local-veloecole-hitarea'],
		featureType: 'local',
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.school('#1e5a8a')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">${p.name || 'Véloécole'}</span>
						${p.operator ? `<span class="text-xs">${p.operator}</span>` : ''}
					</div>
				</div>`;
		},
	},
	{
		id: 'local-atelier',
		label: "Atelier d'autoréparation",
		category: 'local',
		interactableLayerIds: ['local-atelier-hitarea'],
		featureType: 'local',
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.wrench('#1e5a8a')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">${p.name || "Atelier d'autoréparation"}</span>
						${p.operator ? `<span class="text-xs">${p.operator}</span>` : ''}
					</div>
				</div>`;
		},
	},
	{
		id: 'local-revendeur',
		label: 'Revendeur cycle',
		category: 'local',
		interactableLayerIds: ['local-revendeur-hitarea'],
		featureType: 'local',
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.bike('#1e5a8a')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">${p.name || 'Revendeur cycle'}</span>
						${p.opening_hours ? `<span class="text-xs">${p.opening_hours}</span>` : ''}
					</div>
				</div>`;
		},
	},
	{
		id: 'local-loueur',
		label: 'Loueur de vélos',
		category: 'local',
		interactableLayerIds: ['local-loueur-hitarea'],
		featureType: 'local',
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.key('#1e5a8a')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">${p.name || 'Loueur de vélos'}</span>
						${p.operator ? `<span class="text-xs">${p.operator}</span>` : ''}
					</div>
				</div>`;
		},
	},

	// Comfort & rest
	{
		id: 'poi-bench',
		label: 'Bancs',
		category: 'comfort',
		interactableLayerIds: ['poi-bench-hitarea'],
		featureType: 'poi',
		minZoomPopup: 16,
		formatPopup: (p) => {
			return `
				<div class="flex items-center gap-2">
					<div class="mt-0.5 shrink-0">${Icons.bench('#78716c')}</div>
					<span class="font-bold text-sm">${p.name || 'Banc'}</span>
				</div>`;
		},
	},
	{
		id: 'poi-picnic-table',
		label: 'Tables de pique-nique',
		category: 'comfort',
		interactableLayerIds: ['poi-picnic-table-hitarea'],
		featureType: 'poi',
		formatPopup: (p) => {
			return `
				<div class="flex items-center gap-2">
					<div class="mt-0.5 shrink-0">${Icons.picnicTable('#65a30d')}</div>
					<span class="font-bold text-sm">${p.name || 'Table de pique-nique'}</span>
				</div>`;
		},
	},

	// Safety
	{
		id: 'poi-pharmacy',
		label: 'Pharmacies',
		category: 'safety',
		interactableLayerIds: ['poi-pharmacy-hitarea'],
		featureType: 'poi',
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.pharmacy('#16a34a')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">${p.name || 'Pharmacie'}</span>
						${p.opening_hours ? `<span class="text-xs">${p.opening_hours}</span>` : ''}
					</div>
				</div>`;
		},
	},
	{
		id: 'poi-defibrillator',
		label: 'Défibrillateurs',
		category: 'safety',
		interactableLayerIds: ['poi-defibrillator-hitarea'],
		featureType: 'poi',
		formatPopup: (p) => {
			return `
				<div class="flex items-start gap-2">
					<div class="mt-0.5 shrink-0">${Icons.heartPulse('#dc2626')}</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">Défibrillateur</span>
						${p.access ? `<span class="text-xs">Accès : ${p.access}</span>` : ''}
						${p.indoor ? `<span class="text-xs">${p.indoor === 'yes' ? 'Intérieur' : 'Extérieur'}</span>` : ''}
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
		minZoomPopup: 13.5,
	}));
}

export function getOsmVLConfigs(): LayerConfig[] {
	return Array.from({ length: 12 }, (_, i) => i + 1).map((num) => ({
		id: `osm-vl-${num}`,
		label: `Voie Lyonnaise ${num} (OSM)`,
		category: 'osm-vl' as const,
		interactableLayerIds: [`osm-vl-${num}-line-hitarea`],
		featureType: `osm-vl-${num}`,
		formatPopup: (p) => {
			const name = p.name || `Voie Lyonnaise ${num}`;
			return `
				<div class="flex items-start gap-2">
					<div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-xs" style="background-color: ${vlColors[num - 1]}">
						${num}
					</div>
					<div class="flex flex-col">
						<span class="font-bold text-sm">${name}</span>
						<span class="text-xs text-gray-500">Source: OpenStreetMap</span>
						${p.surface ? `<span class="text-xs">Surface: ${p.surface}</span>` : ''}
						${p.width ? `<span class="text-xs">Largeur: ${p.width}</span>` : ''}
					</div>
				</div>`;
		},
		minZoomPopup: 13,
	}));
}

const ACCIDENT_META = {
	'accidents-tue': { label: 'Tué', color: '#111827', badgeBg: 'bg-gray-900 text-white' },
	'accidents-hospitalise': {
		label: 'Blessé hospitalisé',
		color: '#dc2626',
		badgeBg: 'bg-red-600 text-white',
	},
	'accidents-leger': {
		label: 'Blessé léger',
		color: '#facc15',
		badgeBg: 'bg-yellow-400 text-gray-900',
	},
	'accidents-indemne': {
		label: 'Indemne',
		color: '#60a5fa',
		badgeBg: 'bg-blue-500 text-white',
	},
} as const;

const MONTHS_FR = [
	'janvier',
	'février',
	'mars',
	'avril',
	'mai',
	'juin',
	'juillet',
	'août',
	'septembre',
	'octobre',
	'novembre',
	'décembre',
];

function formatDateFr(iso: string): string {
	const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!m) return iso;
	const day = Number(m[3]);
	const monthIdx = Number(m[2]) - 1;
	const year = Number(m[1]);
	if (monthIdx < 0 || monthIdx > 11) return iso;
	const dayLabel = day === 1 ? '1ᵉʳ' : String(day);
	return `${dayLabel} ${MONTHS_FR[monthIdx]} ${year}`;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

// Match the role inference used by the click-popup `AccidentDetails` so the
// hover tooltip never says "Cycliste" for a Piéton victim.
function buildVictimLine(p: {
	categorie?: string;
	sexe_victime?: string;
	age?: number | null;
	victim_vehicle?: string;
}): string {
	const isPassenger = p.categorie === 'Passager';
	const vehicle = String(p.victim_vehicle ?? 'Vélo');
	let role: string;
	if (vehicle === 'Piéton') role = 'Piéton·ne';
	else if (vehicle === 'EDPM' || vehicle === 'EDP non motorisé')
		role = isPassenger ? `Passager·ère ${vehicle}` : vehicle;
	else if (vehicle === 'VAE') role = isPassenger ? 'Passager·ère VAE' : 'Cycliste (VAE)';
	else role = isPassenger ? 'Passager·ère vélo' : 'Cycliste';
	const parts = [role];
	if (p.sexe_victime) parts.push(p.sexe_victime.toLowerCase());
	if (Number.isFinite(p.age)) parts.push(`${p.age} ans`);
	return parts.join(' · ');
}

function accidentsLayerConfigs(): LayerConfig[] {
	return (Object.keys(ACCIDENT_META) as (keyof typeof ACCIDENT_META)[]).map((id) => {
		const meta = ACCIDENT_META[id];
		return {
			id,
			label: `Accident vélo - ${meta.label}`,
			category: 'safety' as const,
			interactableLayerIds: [`${id}-hitarea`],
			featureType: 'accident',
			// Hover tooltip: short summary. Click panel (AccidentDetails) covers the
			// full breakdown (resume, bilan total, source, etc.).
			formatPopup: (p: any) => {
				const date = formatDateFr(String(p.annee ?? ''));
				const adresse = p.adresse ? escapeHtml(String(p.adresse).trim()) : '';
				const commune = p.libelle_commune ? escapeHtml(String(p.libelle_commune).trim()) : '';
				const victim = escapeHtml(buildVictimLine(p));
				const collision = p.collision_type ? escapeHtml(String(p.collision_type)) : '';
				const locationLine = adresse
					? `<div class="text-xs text-gray-600">${adresse}${commune ? `, ${commune}` : ''}</div>`
					: commune
						? `<div class="text-xs text-gray-600">${commune}</div>`
						: '';
				return `
					<div class="flex flex-col gap-1 max-w-[260px]">
						<div class="flex items-center gap-2 flex-wrap">
							<span class="inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${meta.badgeBg}">${meta.label}</span>
							${date ? `<span class="text-[10px] text-gray-500">${date}</span>` : ''}
						</div>
						<div class="text-sm font-semibold text-gray-900">${victim}</div>
						${locationLine}
						${collision ? `<div class="text-[10px] text-gray-500"><span class="text-gray-400">Collision&nbsp;:</span> ${collision}</div>` : ''}
					</div>`;
			},
		};
	});
}

function itinerairesLayerConfigs(): LayerConfig[] {
	return getItineraires().map((fiche) => {
		const color = getItineraireColor(fiche);
		const refBadge = fiche.ref
			? `<span class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-700">${fiche.ref}</span>`
			: '';

		const dot = `<span class="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full" style="background-color:${color}"></span>`;
		const subtitle = fiche.subtitle
			? `<span class="text-xs text-gray-600">${fiche.subtitle}</span>`
			: '';

		const hoverHtml = `
			<div class="flex flex-col gap-1 max-w-[280px]">
				<div class="flex items-center gap-1.5">
					${dot}
					<span class="text-sm font-bold">${fiche.title}</span>
					${refBadge}
				</div>
				${subtitle}
			</div>`;

		return {
			id: itineraireLayerId(fiche.slug),
			label: getItineraireLabel(fiche),
			category: 'itineraires' as const,
			interactableLayerIds: [`itineraire-${fiche.slug}-hitarea`],
			featureType: 'itineraire',
			formatPopup: () => hoverHtml,
		};
	});
}

export function getAllLayerConfigs(): LayerConfig[] {
	return [
		...layerConfigs,
		...getVoiesLyonnaisesConfigs(),
		...getOsmVLConfigs(),
		...accidentsLayerConfigs(),
		...itinerairesLayerConfigs(),
	];
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
