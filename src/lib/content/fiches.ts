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

export interface FicheMeta {
	slug: string;
	title: string;
	subtitle?: string;
	type: string;
	summary?: string;
	cover?: string;
	address?: string;
	lng?: number;
	lat?: number;
	zoom?: number;
	osmId?: string;
	panoramax?: string;
	ogImage?: string;
	ogImageAlt?: string;
	photos?: FichePhoto[];
	links?: FicheLink[];
	parkingGid?: number | number[];
	updated?: string | Date;
}

export interface Fiche extends FicheMeta {
	body: Component;
}

interface MdsvexModule {
	default: Component;
	metadata: Partial<FicheMeta>;
}

const rawModules = import.meta.glob<MdsvexModule>('./fiches/*.md', { eager: true });

interface BuiltIndex {
	bySlug: Map<string, Fiche>;
	parkingByGid: Map<number, Fiche>;
}

function buildIndex(): BuiltIndex {
	const bySlug = new Map<string, Fiche>();
	const parkingByGid = new Map<number, Fiche>();

	for (const [path, mod] of Object.entries(rawModules)) {
		const fileSlug = path.split('/').pop()!.replace(/\.md$/, '');
		const meta = mod.metadata ?? {};
		const slug = (meta.slug as string) ?? fileSlug;

		if (!meta.title || !meta.type) {
			console.warn(`[fiches] ${fileSlug}: missing required title or type`);
			continue;
		}

		const fiche: Fiche = { ...(meta as FicheMeta), slug, body: mod.default };
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
