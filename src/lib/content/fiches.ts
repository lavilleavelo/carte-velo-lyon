import type { Component } from 'svelte';

export interface FicheLink {
	label: string;
	url: string;
}

export interface FichePhoto {
	url: string;
	alt?: string;
	caption?: string;
	credit?: string;
	creditUrl?: string;
}

export interface FicheGeometryRef {
	osmRelation?: number;
}

interface FicheCommon {
	slug: string;
	title: string;
	subtitle?: string;
	summary?: string;
	cover?: string;
	ogImage?: string;
	ogImageAlt?: string;
	photos?: FichePhoto[];
	links?: FicheLink[];
	updated?: string | Date;
	address?: string;
	panoramax?: string;
}

export interface ParkingFicheMeta extends FicheCommon {
	type: 'parking';
	lng?: number;
	lat?: number;
	zoom?: number;
	osmId?: string;
	parkingGid?: number | number[];
}

export interface ItineraireFicheMeta extends FicheCommon {
	type: 'itineraire';
	ref?: string;
	color?: string;
	geometry?: FicheGeometryRef;
	endpoints?: string;
	totalLengthKm?: number;
}

export type FicheMeta = ParkingFicheMeta | ItineraireFicheMeta;
export type FicheType = FicheMeta['type'];

interface FicheRuntime {
	body: Component;
	basename: string;
	hasGeometry: boolean;
}

export type Fiche = FicheMeta & FicheRuntime;
export type ParkingFiche = ParkingFicheMeta & FicheRuntime;
export type ItineraireFiche = ItineraireFicheMeta & FicheRuntime;

interface MdsvexModule {
	default: Component;
	metadata: Partial<FicheMeta>;
}

const rawModules = import.meta.glob<MdsvexModule>('./fiches/*.md', { eager: true });

const geojsonPaths = import.meta.glob('./fiches/*.geojson', { query: '?url' });
const geojsonBasenames = new Set(
	Object.keys(geojsonPaths).map((p) =>
		p
			.split('/')
			.pop()!
			.replace(/\.geojson$/, ''),
	),
);

interface BuiltIndex {
	bySlug: Map<string, Fiche>;
	parkingByGid: Map<number, Fiche>;
}

function buildIndex(): BuiltIndex {
	const bySlug = new Map<string, Fiche>();
	const parkingByGid = new Map<number, Fiche>();

	for (const [path, mod] of Object.entries(rawModules)) {
		const basename = path.split('/').pop()!.replace(/\.md$/, '');
		const meta = mod.metadata ?? {};
		const slug = (meta.slug as string) ?? basename;

		if (!meta.title || !meta.type) {
			console.warn(`[fiches] ${basename}: missing required title or type`);
			continue;
		}

		const fiche = {
			...(meta as FicheMeta),
			slug,
			body: mod.default,
			basename,
			hasGeometry: geojsonBasenames.has(basename),
		} as Fiche;
		bySlug.set(slug, fiche);

		if (fiche.type === 'parking' && fiche.parkingGid !== undefined) {
			const gids = Array.isArray(fiche.parkingGid) ? fiche.parkingGid : [fiche.parkingGid];
			for (const gid of gids) {
				if (typeof gid !== 'number') {
					continue;
				}
				parkingByGid.set(gid, fiche);
			}
		}
	}

	return { bySlug, parkingByGid };
}

const index = buildIndex();

export function getAllFiches(): Fiche[] {
	return [...index.bySlug.values()];
}

export function getFiche(slug: string): Fiche | undefined {
	return index.bySlug.get(slug);
}

export function findParkingFicheByGid(gid: number | string | undefined | null): Fiche | undefined {
	if (gid === undefined || gid === null) {
		return undefined;
	}

	const n = typeof gid === 'number' ? gid : Number(gid);
	if (!Number.isFinite(n)) {
		return undefined;
	}

	return index.parkingByGid.get(n);
}

export function getFichesByType<T extends FicheType>(type: T): Extract<Fiche, { type: T }>[] {
	const out: Extract<Fiche, { type: T }>[] = [];

	for (const f of index.bySlug.values()) {
		if (f.type === type) {
			out.push(f as Extract<Fiche, { type: T }>);
		}
	}

	return out;
}
