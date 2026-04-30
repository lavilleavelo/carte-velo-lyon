export type GravityKey = 'Tué' | 'Blessé hospitalisé' | 'Blessé léger' | 'Indemne';

export type AccidentProps = {
	id_accident: number;
	an: number;
	annee: string;
	adresse: string;
	libelle_commune: string;
	victime_type: string;
	victim_vehicle: 'Vélo' | 'VAE' | 'EDPM' | 'EDP non motorisé' | 'Piéton';
	categorie: string;
	gravite: GravityKey;
	age: number | null;
	sexe_victime: string;
	resume: string;
	tues: number;
	hospitalises: number;
	blesses_legers: number;
	indemnes: number;
	collision_type: string;
	other_vehicles: string[];
	manoeuvre: string;
	choc: string;
	collision_shape: string;
	lateral: boolean;
	intersection: string;
	at_intersection: boolean;
};

export type GravityDef = { id: GravityKey; slug: string; label: string; color: string };

export const GRAVITIES: readonly GravityDef[] = [
	{ id: 'Tué', slug: 'tue', label: 'Tué', color: '#111827' },
	{ id: 'Blessé hospitalisé', slug: 'hospitalise', label: 'Blessé hospitalisé', color: '#dc2626' },
	{ id: 'Blessé léger', slug: 'leger', label: 'Blessé léger', color: '#ca8a04' },
	{ id: 'Indemne', slug: 'indemne', label: 'Indemne', color: '#60a5fa' },
] as const;

export const DEFAULT_GRAVITIES: GravityKey[] = ['Tué', 'Blessé hospitalisé', 'Blessé léger'];

export const VICTIM_VEHICLES = ['Vélo', 'VAE', 'EDPM', 'EDP non motorisé', 'Piéton'] as const;

export const COLLISION_TYPES = [
	'Voiture',
	'Camion / VU',
	'Bus / Tram',
	'2 roues motorisé',
	'Vélo / VAE',
	'Trottinette / EDP',
	'Vélo + EDP',
	'Piéton',
	'Seul',
	'Autre',
] as const;

export const AGE_BUCKETS = [
	{ key: '0-15', min: 0, max: 15 },
	{ key: '16-29', min: 16, max: 29 },
	{ key: '30-49', min: 30, max: 49 },
	{ key: '50-64', min: 50, max: 64 },
	{ key: '65+', min: 65, max: 200 },
] as const;

export const VELO_INTENSITY: Record<number, number> = {
	2019: 100.0,
	2020: 107.3,
	2021: 129.8,
	2022: 141.6,
	2023: 153.8,
	2024: 158.5,
};
export const VELO_INTENSITY_AXIS_MAX = 180;

export type Breakdown = Record<GravityKey, number>;

export const emptyBreakdown = (): Breakdown => ({
	Tué: 0,
	'Blessé hospitalisé': 0,
	'Blessé léger': 0,
	Indemne: 0,
});

export function totalForBreakdown(b: Breakdown | undefined, selected: Set<string>): number {
	if (!b) return 0;
	let sum = 0;
	for (const g of GRAVITIES) {
		if (selected.has(g.id)) {
			sum += b[g.id];
		}
	}
	return sum;
}

export function shortCommuneLabel(name: string): string {
	return name.replace(/Arrondissement\b/g, 'Arr.');
}

// (e.g. "Avenue Felix Faure" vs "Avenue Félix
export function normalizeStreet(adresse: string | null | undefined): string {
	if (!adresse) {
		return '';
	}

	return adresse
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.trim()
		.replace(/\s+/g, ' ');
}
