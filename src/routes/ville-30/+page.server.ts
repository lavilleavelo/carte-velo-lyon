import type { PageServerLoad } from './$types';
import communeMetadataJson from '$lib/data/communeMetadata.json';
import communesIndex from '$lib/data/communes/_index.json';
import { LYON_INSEE, LYON_SLUG, isLyonArrondissementInsee } from '$lib/config/lyon';
import { expandInsee, getCommuneBoundary } from '$lib/server/communeBoundary';
import { countStreetInseesInCommune, getVille30StatsForCommune } from '$lib/server/ville30Stats';
import { bboxOfGeom } from '$lib/utils/geoFilter';
import { bucketForSpeed, emptyStats } from '$lib/utils/speedLimits';
import type { Ville30CommuneRow, Ville30Status } from '$lib/utils/ville30';

interface MetadataEntry {
	insee: string;
	name: string;
	ville30?: { adoptedAt?: string; partial?: boolean; partialNote?: string };
}

const metadataByInsee = communeMetadataJson as Record<string, MetadataEntry>;

export const prerender = true;

const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

function communeBbox(insee: string): [number, number, number, number] | null {
	const boundary = getCommuneBoundary(insee);
	if (!boundary) return null;

	const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
	for (const feature of boundary.features) {
		const [minX, minY, maxX, maxY] = bboxOfGeom(feature.geometry);
		bbox[0] = Math.min(bbox[0], minX);
		bbox[1] = Math.min(bbox[1], minY);
		bbox[2] = Math.max(bbox[2], maxX);
		bbox[3] = Math.max(bbox[3], maxY);
	}

	return bbox.map((v) => round(v, 5)) as [number, number, number, number];
}

async function buildRow(
	insee: string,
	slug: string,
	streetInsees: string[],
): Promise<Ville30CommuneRow> {
	const metadata = metadataByInsee[insee];
	const ville30 = metadata?.ville30;
	const status: Ville30Status = !ville30 ? 'none' : ville30.partial ? 'partial' : 'full';

	const stats = await getVille30StatsForCommune(insee);
	const kmByBucket = emptyStats();
	for (const [speed, { km }] of Object.entries(stats?.bySpeedLimit ?? {})) {
		kmByBucket[bucketForSpeed(speed)] += km;
	}

	return {
		insee,
		slug,
		name: metadata?.name ?? slug,
		status,
		adoptedAt: ville30?.adoptedAt ?? null,
		partialNote: ville30?.partialNote ?? null,
		pct: stats && stats.eligibleKm > 0 ? round(stats.eligibleUnder30KmPercentage, 1) : null,
		eligibleKm: round(stats?.eligibleKm ?? 0),
		eligibleUnder30Km: round(stats?.eligibleUnder30Km ?? 0),
		kmByBucket: Object.fromEntries(
			Object.entries(kmByBucket).map(([k, v]) => [k, round(v)]),
		) as Ville30CommuneRow['kmByBucket'],
		bbox: communeBbox(insee),
		featureInsees: [...expandInsee(insee)],
		streetInsees,
	};
}

export const load: PageServerLoad = async () => {
	const entries = (communesIndex as { slug: string; insee: string }[])
		.filter((c) => !isLyonArrondissementInsee(c.insee))
		.map((c) => ({ insee: c.insee, slug: c.slug }));
	entries.push({ insee: LYON_INSEE, slug: LYON_SLUG });

	// Assign each street INSEE code to the commune holding most of its streets, so that streets
	// still tagged with a former commune code are drawn with the commune they now belong to.
	const streetCounts = await Promise.all(entries.map((e) => countStreetInseesInCommune(e.insee)));
	const owners = new Map<string, { index: number; count: number }>();
	streetCounts.forEach((counts, index) => {
		for (const [code, count] of counts) {
			const current = owners.get(code);
			if (!current || count > current.count) owners.set(code, { index, count });
		}
	});
	const streetInsees = entries.map(() => [] as string[]);
	for (const [code, { index }] of owners) streetInsees[index].push(code);

	const communes = await Promise.all(
		entries.map((e, i) => buildRow(e.insee, e.slug, streetInsees[i].sort())),
	);
	communes.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

	const eligibleKm = communes.reduce((sum, c) => sum + c.eligibleKm, 0);
	const eligibleUnder30Km = communes.reduce((sum, c) => sum + c.eligibleUnder30Km, 0);

	return {
		communes,
		metropole: {
			ville30Count: communes.filter((c) => c.status !== 'none').length,
			partialCount: communes.filter((c) => c.status === 'partial').length,
			totalCommunes: communes.length,
			pct: eligibleKm > 0 ? round((eligibleUnder30Km / eligibleKm) * 100, 1) : null,
			eligibleUnder30Km: Math.round(eligibleUnder30Km),
		},
		seo: {
			title: 'Ville 30 dans la Métropole de Lyon – Carte vélo',
			description:
				'Carte des communes de la Métropole de Lyon ayant adopté le statut Ville 30 et part des rues limitées à 30 km/h dans chaque commune.',
		},
	};
};
