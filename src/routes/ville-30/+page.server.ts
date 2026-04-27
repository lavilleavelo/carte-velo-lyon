import type { PageServerLoad } from './$types';
import communeMetadataJson from '$lib/data/communeMetadata.json';
import communesIndex from '$lib/data/communes/_index.json';

interface MetadataEntry {
	insee: string;
	name: string;
	ville30?: { adoptedAt?: string; partial?: boolean; partialNote?: string };
}

export interface Ville30CommuneSummary {
	insee: string;
	slug: string | null;
	name: string;
	adoptedAt: string | null;
	partial: boolean;
}

export interface CommuneLink {
	insee: string;
	slug: string;
	name: string;
}

const metadataByInsee = communeMetadataJson as Record<string, MetadataEntry>;
const slugByInsee = new Map<string, string>(
	(communesIndex as { slug: string; insee: string }[]).map((c) => [c.insee, c.slug]),
);

const LYON_ARRONDISSEMENT_INSEE = new Set([
	'69381',
	'69382',
	'69383',
	'69384',
	'69385',
	'69386',
	'69387',
	'69388',
	'69389',
]);

export const prerender = true;

export const load: PageServerLoad = async () => {
	const ville30: Ville30CommuneSummary[] = [];
	const fullInsees: string[] = [];
	const partialInsees: string[] = [];

	for (const [insee, entry] of Object.entries(metadataByInsee)) {
		if (!entry.ville30) continue;
		if (LYON_ARRONDISSEMENT_INSEE.has(insee)) {
			fullInsees.push(insee);
			continue;
		}

		const partial = !!entry.ville30.partial;
		if (partial) {
			partialInsees.push(insee);
		} else {
			fullInsees.push(insee);
		}

		ville30.push({
			insee,
			slug: slugByInsee.get(insee) ?? (insee === '69123' ? 'lyon' : null),
			name: entry.name,
			adoptedAt: entry.ville30.adoptedAt ?? null,
			partial,
		});
	}

	ville30.sort((a, b) => {
		if (a.adoptedAt && b.adoptedAt) {
			return a.adoptedAt.localeCompare(b.adoptedAt);
		}

		if (a.adoptedAt) return -1;
		if (b.adoptedAt) return 1;
		return a.name.localeCompare(b.name, 'fr');
	});

	const totalCommunes = Object.keys(metadataByInsee).filter(
		(insee) => !LYON_ARRONDISSEMENT_INSEE.has(insee),
	).length;

	const allCommuneLinks: CommuneLink[] = (
		communesIndex as { slug: string; insee: string; name: string }[]
	).map((c) => ({ insee: c.insee, slug: c.slug, name: c.name }));
	allCommuneLinks.push({ insee: '69123', slug: 'lyon', name: 'Lyon' });

	return {
		ville30,
		ville30FullInsees: fullInsees,
		ville30PartialInsees: partialInsees,
		allCommuneLinks,
		totalCommunes,
		seo: {
			title: 'Ville 30 dans la Métropole de Lyon – Carte vélo',
			description:
				'Carte des communes de la Métropole de Lyon ayant adopté le statut Ville 30 : la vitesse y est limitée à 30 km/h par défaut sur la majorité des rues.',
		},
	};
};
