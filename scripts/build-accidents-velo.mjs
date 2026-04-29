#!/usr/bin/env node
// Build src/lib/data/accidents-velo.json from the official BAAC dataset on data.gouv.fr.
//
//   https://www.data.gouv.fr/datasets/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2024
//
// Output is a GeoJSON FeatureCollection of bicycle-involved accidents whose
// commune INSEE code is in the carte-velo-lyon perimeter (Métropole de Lyon
// + Lyon arrondissements).
//
// Usage:
//   pnpm accidents:build                # all configured years
//   pnpm accidents:build --refresh      # re-download cached CSVs
//   pnpm accidents:build --years=2023,2024
//
// CSVs are cached in scripts/.cache/baac/ to avoid re-downloading on iteration.

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { parse } from '@std/csv/parse';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CACHE_DIR = resolve(__dirname, '.cache/baac');
const COMMUNE_INDEX = resolve(ROOT, 'src/lib/data/communes/_index.json');
const OUT_PATH = resolve(ROOT, 'src/lib/data/accidents-velo.json');

const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const yearsArg = args.find((a) => a.startsWith('--years='));
const YEARS = yearsArg
	? yearsArg
			.slice('--years='.length)
			.split(',')
			.map((s) => Number(s.trim()))
			.filter((n) => Number.isFinite(n))
	: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

// Resource URLs sourced from the data.gouv.fr API on 2026-04-29.
const RESOURCES = {
	2017: {
		caract:
			'https://static.data.gouv.fr/resources/base-de-donnees-accidents-corporels-de-la-circulation/20180927-111012/caracteristiques-2017.csv',
		lieux:
			'https://static.data.gouv.fr/resources/base-de-donnees-accidents-corporels-de-la-circulation/20180927-111131/lieux-2017.csv',
		usagers:
			'https://static.data.gouv.fr/resources/base-de-donnees-accidents-corporels-de-la-circulation/20180927-111153/usagers-2017.csv',
		vehicules:
			'https://static.data.gouv.fr/resources/base-de-donnees-accidents-corporels-de-la-circulation/20191104-164430/vehicules-2017.csv',
	},
	2018: {
		caract:
			'https://static.data.gouv.fr/resources/base-de-donnees-accidents-corporels-de-la-circulation/20191014-111741/caracteristiques-2018.csv',
		lieux:
			'https://static.data.gouv.fr/resources/base-de-donnees-accidents-corporels-de-la-circulation/20191014-112036/lieux-2018.csv',
		usagers:
			'https://static.data.gouv.fr/resources/base-de-donnees-accidents-corporels-de-la-circulation/20191014-112100/usagers-2018.csv',
		vehicules:
			'https://static.data.gouv.fr/resources/base-de-donnees-accidents-corporels-de-la-circulation/20191014-112113/vehicules-2018.csv',
	},
	2019: {
		caract:
			'https://static.data.gouv.fr/resources/base-de-donnees-accidents-corporels-de-la-circulation/20201105-104400/caracteristiques-2019.csv',
		lieux:
			'https://static.data.gouv.fr/resources/base-de-donnees-accidents-corporels-de-la-circulation/20201105-104338/lieux-2019.csv',
		usagers:
			'https://static.data.gouv.fr/resources/base-de-donnees-accidents-corporels-de-la-circulation/20201105-104232/usagers-2019.csv',
		vehicules:
			'https://static.data.gouv.fr/resources/base-de-donnees-accidents-corporels-de-la-circulation/20201105-104310/vehicules-2019.csv',
	},
	2020: {
		caract:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2019/20211110-111202/caracteristiques-2020.csv',
		lieux:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2019/20211110-111603/lieux-2020.csv',
		usagers:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2019/20211110-111817/usagers-2020.csv',
		vehicules:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2019/20211110-111722/vehicules-2020.csv',
	},
	2021: {
		caract:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2020/20221024-113743/carcteristiques-2021.csv',
		lieux:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2020/20221024-113901/lieux-2021.csv',
		usagers:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2022/20231009-140337/usagers-2021.csv',
		vehicules:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2020/20221024-113925/vehicules-2021.csv',
	},
	2022: {
		caract:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2021/20231005-093927/carcteristiques-2022.csv',
		lieux:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2021/20231005-094112/lieux-2022.csv',
		usagers:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2021/20231005-094229/usagers-2022.csv',
		vehicules:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2021/20231005-094147/vehicules-2022.csv',
	},
	2023: {
		caract:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2023/20241028-103125/caract-2023.csv',
		lieux:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2023/20241023-153219/lieux-2023.csv',
		usagers:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2023/20241023-153328/usagers-2023.csv',
		vehicules:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2023/20241023-153253/vehicules-2023.csv',
	},
	2024: {
		caract:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2024/20251021-115900/caract-2024.csv',
		lieux:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2024/20251021-115812/lieux-2024.csv',
		usagers:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2024/20251021-115506/usagers-2024.csv',
		vehicules:
			'https://static.data.gouv.fr/resources/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2024/20251107-100240/vehicules-2024.csv',
	},
};

// BAAC enums (subset used in resume + UI mapping)
const GRAVITE = { 1: 'Indemne', 2: 'Tué', 3: 'Blessé hospitalisé', 4: 'Blessé léger' };
const SEXE = { 1: 'Masculin', 2: 'Féminin' };
const AGG = { 1: 'Hors agglomération', 2: 'En agglomération' };
const LUM = {
	1: 'Plein jour',
	2: 'Crépuscule ou aube',
	3: 'Nuit sans éclairage public',
	4: 'Nuit avec éclairage public non allumé',
	5: 'Nuit avec éclairage public allumé',
};

const ATM = {
	1: 'Normale',
	2: 'Pluie légère',
	3: 'Pluie forte',
	4: 'Neige - grêle',
	5: 'Brouillard - fumée',
	6: 'Vent fort - tempête',
	7: 'Temps éblouissant',
	8: 'Temps couvert',
	9: 'Autre',
};

const SURF = {
	1: 'Normale',
	2: 'Mouillée',
	3: 'Flaques',
	4: 'Inondée',
	5: 'Enneigée',
	6: 'Boue',
	7: 'Verglacée',
	8: 'Corps gras - huile',
	9: 'Autre',
};

const INT = {
	1: 'Hors intersection',
	2: 'Intersection en X',
	3: 'Intersection en T',
	4: 'Intersection en Y',
	5: 'Intersection à plus de 4 branches',
	6: 'Giratoire',
	7: 'Place',
	8: 'Passage à niveau',
	9: 'Autre intersection',
};

const CATR = {
	1: 'Autoroute',
	2: 'Route Nationale',
	3: 'Route Départementale',
	4: 'Voie Communale',
	5: 'Hors réseau public',
	6: 'Parc de stationnement ouvert à la circulation publique',
	7: 'Routes de métropole urbaine',
	9: 'Autre',
};

// Friendly French labels (shown in popups). The original BAAC jargon ("VL seul",
// "PL seul", etc.) is intentionally simplified: "seul" in BAAC just means "not
// towing", which is rarely interesting to a non-expert reader.
const CATV = {
	0: 'Véhicule indéterminé',
	1: 'Vélo',
	2: 'Cyclomoteur',
	3: 'Voiturette',
	7: 'Voiture',
	10: 'Véhicule utilitaire',
	13: 'Camion (3,5 - 7,5 T)',
	14: 'Camion (> 7,5 T)',
	15: 'Camion avec remorque',
	16: 'Tracteur routier',
	17: 'Semi-remorque',
	30: 'Scooter (< 50cm³)',
	31: 'Moto (50 - 125cm³)',
	32: 'Scooter (50 - 125cm³)',
	33: 'Moto (> 125cm³)',
	34: 'Scooter (> 125cm³)',
	35: 'Quad léger',
	36: 'Quad lourd',
	37: 'Bus',
	38: 'Autocar',
	39: 'Train',
	40: 'Tramway',
	41: '3 roues motorisé (< 50cm³)',
	42: '3 roues motorisé (50 - 125cm³)',
	43: '3 roues motorisé (> 125cm³)',
	50: 'EDPM',
	60: 'EDP non motorisé',
	80: 'Vélo électrique (VAE)',
	99: 'Autre véhicule',
};

const GRAV_SUFFIX = {
	2: 'tué',
	3: 'blessé hospitalisé',
	4: 'blessé léger',
	1: 'indemne',
};

// BAAC `manv` (manoeuvre principale avant l'accident) codes from the 2019+ codebook.
// Pre-2019 files use the same codes 1-26.
const MANV = {
	1: 'Sans changement de direction',
	2: 'Même sens, même file',
	3: 'Entre 2 files',
	4: 'En marche arrière',
	5: 'À contresens',
	6: 'En franchissant le terre-plein central',
	7: 'Dans le couloir bus, même sens',
	8: 'Dans le couloir bus, sens inverse',
	9: 'En s’insérant',
	10: 'En faisant demi-tour',
	11: 'Changement de file à gauche',
	12: 'Changement de file à droite',
	13: 'Déporté à gauche',
	14: 'Déporté à droite',
	15: 'Tournant à gauche',
	16: 'Tournant à droite',
	17: 'Dépassant à gauche',
	18: 'Dépassant à droite',
	19: 'Traversant la chaussée',
	20: 'Manœuvre de stationnement',
	21: 'Manœuvre d’évitement',
	22: 'Ouverture de porte',
	23: 'Arrêté (hors stationnement)',
	24: 'En stationnement',
	25: 'Circulant sur trottoir',
	26: 'Autre manœuvre',
};

// BAAC `choc` (point de choc initial sur le véhicule victime) codes.
const CHOC = {
	1: 'Avant',
	2: 'Avant droit',
	3: 'Avant gauche',
	4: 'Arrière',
	5: 'Arrière droit',
	6: 'Arrière gauche',
	7: 'Côté droit',
	8: 'Côté gauche',
	9: 'Chocs multiples (carambolage)',
};

// BAAC `col` (type de collision, accident-level).
const COL = {
	1: 'Frontale',
	2: 'Par l’arrière',
	3: 'Par le côté',
	4: 'En chaîne',
	5: 'Collisions multiples',
	6: 'Autre',
	7: 'Sans collision',
};

const GRAV_HEAD = {
	2: 'Accident mortel',
	3: 'Accident grave non mortel',
	4: 'Accident léger non mortel',
};

async function ensureFile(url, dest) {
	if (!refresh) {
		try {
			await stat(dest);
			return dest;
		} catch {}
	}
	process.stdout.write(`  ↓ ${url.split('/').pop()} ... `);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
	await mkdir(dirname(dest), { recursive: true });
	await pipeline(res.body, createWriteStream(dest));
	console.log('done');
	return dest;
}

function detectSeparator(headerLine) {
	return headerLine.includes(';') ? ';' : ',';
}

async function loadCsv(path) {
	// Pre-2019 BAAC files are Latin1 / windows-1252; 2019+ are UTF-8.
	const buf = await readFile(path);
	let text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
	if (text.includes('�')) {
		text = new TextDecoder('windows-1252').decode(buf);
	}
	const firstLine = text.split(/\r?\n/, 1)[0];
	const separator = detectSeparator(firstLine);
	const rows = parse(text, { skipFirstRow: true, separator, strip: true });
	// 2022 caract renamed Num_Acc → Accident_Id; normalize so downstream lookups work.
	for (const row of rows) {
		if (row.Accident_Id && !row.Num_Acc) row.Num_Acc = row.Accident_Id;
	}
	return rows;
}

// Pre-2019 dep is "690", post-2019 is "069".  Normalize to canonical INSEE 2-char.
function normalizeDep(rawDep) {
	if (rawDep == null) return '';
	const d = String(rawDep).trim();
	if (!d) {
		return '';
	}

	// Corsica: "201" → "2A", "202" → "2B"
	if (d === '201' || d === '2A') return '2A';
	if (d === '202' || d === '2B') return '2B';
	if (d.length === 3 && d.startsWith('0')) return d.slice(1); // "069" → "69"
	if (d.length === 3 && d.endsWith('0') && /^\d{3}$/.test(d)) return d.slice(0, 2); // "690" → "69"
	if (d.length === 2) return d;
	if (d.length === 1) return '0' + d;
	return d;
}

// Pre-2019: com is 3 last digits.  Post-2019: full 5-char INSEE.
function normalizeCom(rawCom, dep) {
	if (rawCom == null) return '';
	const c = String(rawCom).trim();
	if (!c) return '';
	if (c.length === 5) return c;
	const padded = c.padStart(3, '0');
	return dep + padded;
}

function normalizeCoord(rawLat, rawLong) {
	if (rawLat == null || rawLong == null) return null;
	const cleanLat = String(rawLat).trim();
	const cleanLong = String(rawLong).trim();
	if (!cleanLat || !cleanLong || cleanLat === '0' || cleanLong === '0') return null;

	// 2019+ format: "47,56277000" decimal with comma
	if (cleanLat.includes(',') || cleanLat.includes('.')) {
		const lat = Number(cleanLat.replace(',', '.'));
		const lng = Number(cleanLong.replace(',', '.'));
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
		if (lat === 0 && lng === 0) return null;
		return [lng, lat];
	}

	// Pre-2019 format: integer string scaled by 1e5, optional sign for South / West.
	// E.g. "5051326" → 50.51326, "0292191" → 02.92191
	const sign = (s) => (s.startsWith('-') ? -1 : 1);
	const digits = (s) => s.replace(/^[-+]/, '');
	const latNum = (Number(digits(cleanLat)) / 1e5) * sign(cleanLat);
	const lngNum = (Number(digits(cleanLong)) / 1e5) * sign(cleanLong);
	if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;
	if (latNum === 0 && lngNum === 0) return null;
	return [lngNum, latNum];
}

function pad2(n) {
	return String(n).padStart(2, '0');
}

function isoDate(year, mois, jour) {
	const m = Number(mois);
	const d = Number(jour);
	if (!Number.isFinite(m) || !Number.isFinite(d)) return '';
	return `${year}-${pad2(m)}-${pad2(d)}`;
}

function buildResume({ caract, lieu, vehicles, usagers, focusUsager, focusVehicle }) {
	const grav = Number(focusUsager.grav);
	const head = GRAV_HEAD[grav] || 'Accident corporel';
	const aggLabel = AGG[Number(caract.agg)] || '';
	const intLabel = INT[Number(caract.int)] || '';
	const lumLabel = LUM[Number(caract.lum)] || '';
	const atmLabel = ATM[Number(caract.atm)] || '';
	const surfLabel = SURF[Number(lieu?.surf)] || '';

	const intro = [head, aggLabel, intLabel, lumLabel].filter(Boolean).join(', ');
	const meteo = atmLabel
		? `, avec une météo ${atmLabel}${surfLabel ? ` et une surface chaussée : ${surfLabel}` : ''}.`
		: '.';

	// One sentence per vehicle: "1 Bicyclette circulant sur Voie Communale (VMA à 30) conduit par 1 usager Masculin de 22 ans (BL)..."
	const sentences = [];
	for (const v of vehicles) {
		const catv = Number(v.catv);
		const catvLabel = CATV[catv] || `Véhicule (${catv})`;
		const catr = Number(lieu?.catr);
		const catrLabel = CATR[catr] || '';
		const vma = lieu?.vma && Number(lieu.vma) > 0 ? ` (VMA à ${Number(lieu.vma)})` : '';
		const conducteurs = usagers.filter((u) => u.num_veh === v.num_veh && Number(u.catu) === 1);
		const passagers = usagers.filter((u) => u.num_veh === v.num_veh && Number(u.catu) === 2);
		const pietons = usagers.filter((u) => Number(u.catu) === 3);

		const conductorPart = conducteurs.length
			? conducteurs
					.map((u) => {
						const sex = SEXE[Number(u.sexe ?? u.sex)] || '';
						const age = ageFromYear(u.an_nais, caract.year);
						const ageStr = age != null ? `de ${age} ans ` : '';
						const suffix = GRAV_SUFFIX[Number(u.grav)] || '';
						return `1 usager ${sex} ${ageStr}(${suffix})`;
					})
					.join(' et ')
			: '';
		const passengerPart = passagers.length
			? ` avec ${passagers.length} passager(s)`
			: '';
		let sentence = `1 ${catvLabel} circulant sur ${catrLabel}${vma} conduit par ${conductorPart}${passengerPart}`;

		if (pietons.length && v === focusVehicle) {
			const pieton = pietons
				.map((p) => {
					const sex = SEXE[Number(p.sexe ?? p.sex)] || '';
					const age = ageFromYear(p.an_nais, caract.year);
					const suffix = GRAV_SUFFIX[Number(p.grav)] || '';
					return `${sex}${age != null ? ` ${age} ans` : ''} ${suffix}`;
				})
				.join(', ');
			sentence += `  heurte ${pietons.length} piéton(s) (${pieton})`;
		}
		sentences.push(sentence);
	}

	return `${intro}${meteo} ${sentences.join('. ')}`.replace(/\s+/g, ' ').trim() + '  ';
}

// BAAC stores addresses inconsistently: fixed-width caps with trailing
// suffix codes ("MORELLET (R )"), inverted forms ("HUILES (PLACE AUX)"),
// or modern title case ("Allée des Tilleuls").  Normalize them all to a
// French-styled "Type De Particule Nom" form.
const STREET_TYPE_MAP = {
	R: 'Rue', RUE: 'Rue', RU: 'Ruelle', RUELLE: 'Ruelle',
	AV: 'Avenue', AVE: 'Avenue', AVENUE: 'Avenue',
	BD: 'Boulevard', BLD: 'Boulevard', BOULEVARD: 'Boulevard',
	PL: 'Place', PLACE: 'Place',
	IMP: 'Impasse', IMPASSE: 'Impasse',
	CH: 'Chemin', CHM: 'Chemin', CHEM: 'Chemin', CHEMIN: 'Chemin',
	AL: 'Allée', ALL: 'Allée', ALLEE: 'Allée',
	PAS: 'Passage', PASSAGE: 'Passage',
	Q: 'Quai', QU: 'Quai', QUAI: 'Quai',
	CR: 'Cours', CO: 'Cours', CRS: 'Cours', COURS: 'Cours',
	RTE: 'Route', ROUTE: 'Route',
	SQ: 'Square', SQUARE: 'Square',
	RO: 'Rond-point', RP: 'Rond-point', RDPT: 'Rond-point',
	ROCADE: 'Rocade',
	PT: 'Pont', PONT: 'Pont',
	CHAUSSEE: 'Chaussée',
	VO: 'Voie', VOIE: 'Voie',
	CARREFOUR: 'Carrefour',
	CITE: 'Cité',
	MO: 'Montée', MTE: 'Montée', MONT: 'Montée', MONTEE: 'Montée',
	VC: 'Voie Communale',
	GR: 'Grande Rue',
	TR: 'Traverse', TRAVERSE: 'Traverse',
	VLA: 'Villa', VILLA: 'Villa',
};

const LOWERCASE_PARTICLES = new Set([
	'de', 'du', 'des', 'la', 'le', 'les', "l", "d", 'à', 'au', 'aux',
	'et', 'sur', 'sous', 'en', 'lès', 'sainte', // last is a stretch but rarely matters here
]);

function titleCaseFr(s) {
	const lower = s.toLowerCase();
	return lower.replace(/[\p{L}]+/gu, (word, offset) => {
		if (offset > 0 && LOWERCASE_PARTICLES.has(word)) return word;
		return word.charAt(0).toUpperCase() + word.slice(1);
	});
}

function cleanAddress(raw) {
	if (raw == null) return '';
	let s = String(raw).replace(/\s+/g, ' ').trim();
	if (!s) {
		return '';
	}

	// Strip BAAC placeholder punctuation prefix (e.g. "., Antonin Perrin (R")
	s = s.replace(/^[.,\s]+/, '').trim();
	if (!s) return '';

	// Optional leading street number with bis/ter (pre-2019 format "01, Name")
	let numberPrefix = '';
	const numMatch = s.match(/^(\d[\dA-Za-z]*(?:\s+(?:Bis|Ter|B|T))?)\s*,\s*/i);
	if (numMatch) {
		numberPrefix = numMatch[1];
		s = s.slice(numMatch[0].length);
	}

	// Inverted form: "NAME (TYPE PARTICLES)".  Several variants in the wild:
	//   - close paren may be missing ("Antonin Perrin (R")
	//   - multiple parens ("Forts (des) (Mo)")
	//   - parens with only particles ("Etats Unis (des)")
	// Walk all parens right-to-left and use the first one whose head matches a
	// known street type.  Drop particle-only parens silently.
	let typeWord = '';
	let particles = '';
	const parenRegex = /\s*\(([^)]*)\)?/g;
	const matches = [...s.matchAll(parenRegex)];
	if (matches.length > 0) {
		for (let i = matches.length - 1; i >= 0; i--) {
			const m = matches[i];
			const insideWords = m[1].trim().split(/\s+/).filter(Boolean);
			const typeKey = (insideWords[0] || '').toUpperCase().replace(/[.,]/g, '');
			const expanded = STREET_TYPE_MAP[typeKey];
			if (expanded) {
				typeWord = expanded;
				particles = insideWords.slice(1).join(' ');
				s = s.replace(parenRegex, ' ').replace(/\s+/g, ' ').trim();
				break;
			}
		}
		if (!typeWord) {
			// All parens are particle-only or unknown: strip them entirely so we
			// don't surface "(des)" or "(d')" in the rendered popup.
			const isParticle = (w) => {
				const stripped = w.toLowerCase().replace(/['']$/, '');
				return LOWERCASE_PARTICLES.has(stripped);
			};
			const allParticles = matches.every((m) =>
				m[1]
					.trim()
					.split(/\s+/)
					.filter(Boolean)
					.every(isParticle),
			);
			if (allParticles) {
				s = s.replace(parenRegex, ' ').replace(/\s+/g, ' ').trim();
			}
		}
	}

	// Prefix form: "BD PERIPHERIQUE" → "Boulevard PERIPHERIQUE"
	if (!typeWord) {
		const words = s.split(/\s+/);
		const headKey = (words[0] || '').toUpperCase().replace(/[.,]/g, '');
		const expanded = STREET_TYPE_MAP[headKey];
		if (expanded) {
			typeWord = expanded;
			s = words.slice(1).join(' ');
		}
	}

	const parts = [numberPrefix, typeWord, particles, s].filter(Boolean);
	return titleCaseFr(parts.join(' '));
}

function ageFromYear(an_nais, accidentYear) {
	const n = Number(String(an_nais ?? '').trim());
	if (!Number.isFinite(n) || n < 1900) return null;
	return accidentYear - n;
}

// Categorize the OTHER party in the collision, from the victim's perspective.
// Labels are deliberately victim-agnostic ("Voiture" instead of "Vélo + Voiture")
// because the page covers cyclists, EDP riders and pedestrian victims alike.
function deriveCollision(accVehicles, accUsagers) {
	const catv = accVehicles.map((v) => Number(v.catv));
	const hasPedestrian = accUsagers.some((u) => Number(u.catu) === 3);
	// "Self-like" = vehicles in the victim catalog (bike, VAE, EDP). Anything
	// else is the "other party". Multiple self-like vehicles still count as
	// "Vélo / VAE" / "Trottinette / EDP" depending on what they are.
	const isSelfLike = (c) => c === 1 || c === 80 || c === 50 || c === 60;
	const isBikeLike = (c) => c === 1 || c === 80;
	const isEDPLike = (c) => c === 50 || c === 60;
	const others = catv.filter((c) => !isSelfLike(c));
	const selfLikeCount = catv.filter(isSelfLike).length;

	const isCar = (c) => c === 7 || c === 3;
	const isVan = (c) => c === 10;
	const isTruck = (c) => c === 13 || c === 14 || c === 15 || c === 16 || c === 17;
	const isBus = (c) => c === 37 || c === 38;
	const isTram = (c) => c === 40 || c === 39;
	const isMotorbike = (c) =>
		c === 2 || c === 30 || c === 31 || c === 32 || c === 33 || c === 34 || c === 41 || c === 42 || c === 43;

	const otherLabels = others.map((c) => CATV[c] || `Véhicule (${c})`);

	let type;
	if (others.length === 0) {
		// Only victim-side vehicles. Sub-cases:
		if (hasPedestrian && selfLikeCount >= 1) type = 'Piéton';
		else if (selfLikeCount > 1) {
			// Two bikes / two EDP / mixed.  Prefer the more representative label.
			if (catv.some(isEDPLike) && !catv.some(isBikeLike)) type = 'Trottinette / EDP';
			else if (catv.some(isBikeLike) && catv.some(isEDPLike)) type = 'Vélo + EDP';
			else type = 'Vélo / VAE';
		} else type = 'Seul';
	} else if (others.some(isCar)) type = 'Voiture';
	else if (others.some(isVan) || others.some(isTruck)) type = 'Camion / VU';
	else if (others.some(isBus) || others.some(isTram)) type = 'Bus / Tram';
	else if (others.some(isMotorbike)) type = '2 roues motorisé';
	else type = 'Autre';

	return { type, otherLabels, hasPedestrian };
}

function tallyGravity(usagers) {
	let tues = 0;
	let blesses_legers = 0;
	let hospitalises = 0;
	let indemnes = 0;
	for (const u of usagers) {
		const g = Number(u.grav);
		if (g === 2) tues++;
		else if (g === 3) hospitalises++;
		else if (g === 4) blesses_legers++;
		else if (g === 1) indemnes++;
	}
	return { tues, blesses_legers, hospitalises, indemnes };
}

async function main() {
	console.log(`Building accidents-velo dataset for ${YEARS.length} year(s): ${YEARS.join(', ')}`);

	// Load commune INSEE → name lookup
	const communeIndex = JSON.parse(await readFile(COMMUNE_INDEX, 'utf8'));
	const inseeToName = new Map();
	for (const c of communeIndex) {
		if (c.insee) inseeToName.set(c.insee, c.name);
	}
	console.log(`Perimeter: ${inseeToName.size} commune(s)`);
	const inseeSet = new Set(inseeToName.keys());

	const features = [];
	let totalAccidents = 0;

	for (const year of YEARS) {
		const urls = RESOURCES[year];
		if (!urls) {
			console.warn(`No resource URLs for year ${year}, skipping.`);
			continue;
		}
		console.log(`\n[${year}] downloading…`);
		await mkdir(CACHE_DIR, { recursive: true });
		const paths = {};
		for (const key of ['caract', 'lieux', 'usagers', 'vehicules']) {
			paths[key] = await ensureFile(urls[key], resolve(CACHE_DIR, `${key}-${year}.csv`));
		}

		console.log(`[${year}] parsing…`);
		const [caracts, lieux, vehicules, usagers] = await Promise.all([
			loadCsv(paths.caract),
			loadCsv(paths.lieux),
			loadCsv(paths.vehicules),
			loadCsv(paths.usagers),
		]);

		// Index lookups
		const caractByAcc = new Map();
		for (const row of caracts) {
			const dep = normalizeDep(row.dep);
			const com = normalizeCom(row.com, dep);
			if (!inseeSet.has(com)) continue;
			caractByAcc.set(row.Num_Acc, { ...row, dep, com, year });
		}
		if (caractByAcc.size === 0) {
			console.log(`[${year}] no accidents within perimeter`);
			continue;
		}

		const lieuByAcc = new Map();
		for (const row of lieux) {
			if (caractByAcc.has(row.Num_Acc)) lieuByAcc.set(row.Num_Acc, row);
		}

		const vehiclesByAcc = new Map();
		for (const row of vehicules) {
			if (!caractByAcc.has(row.Num_Acc)) continue;
			const list = vehiclesByAcc.get(row.Num_Acc) ?? [];
			list.push(row);
			vehiclesByAcc.set(row.Num_Acc, list);
		}

		const usagersByAcc = new Map();
		for (const row of usagers) {
			if (!caractByAcc.has(row.Num_Acc)) continue;
			const list = usagersByAcc.get(row.Num_Acc) ?? [];
			list.push(row);
			usagersByAcc.set(row.Num_Acc, list);
		}

		// For each accident in perimeter that involves at least one bicycle, emit
		// one feature per cyclist usager
		let yearCount = 0;
		for (const [numAcc, caract] of caractByAcc) {
			const accVehicles = vehiclesByAcc.get(numAcc) ?? [];
			const accUsagers = usagersByAcc.get(numAcc) ?? [];
			const lieu = lieuByAcc.get(numAcc);
			// Bikes + VAE + EDP (engins de déplacement personnel: trottinettes etc).
			// Each victim feature carries `victim_vehicle` so the UI can filter on it.
			const VICTIM_VEHICLE_LABELS = { 1: 'Vélo', 80: 'VAE', 50: 'EDPM', 60: 'EDP non motorisé' };
			const bikeVehicles = accVehicles.filter((v) => {
				const c = Number(v.catv);
				return VICTIM_VEHICLE_LABELS[c] !== undefined;
			});
			if (bikeVehicles.length === 0) continue;

			const coords = normalizeCoord(caract.lat, caract.long);
			if (!coords) continue;

			const tally = tallyGravity(accUsagers);
			const collision = deriveCollision(accVehicles, accUsagers);
			const isoDateStr = isoDate(caract.year, caract.mois, caract.jour);
			const adresse = cleanAddress(caract.adr);
			const communeName = inseeToName.get(caract.com) || caract.com;
			const idAccident = Number(numAcc);


			const intCode = Number(caract.int);
			const intersectionLabel = INT[intCode] || '';
			const atIntersection = Number.isFinite(intCode) && intCode > 1; // 1 = "Hors intersection"

			const colCode = Number(caract.col);
			const collisionShape = COL[colCode] || '';
			const isLateral = colCode === 3;

			for (const bv of bikeVehicles) {
				const cyclistUsagers = accUsagers.filter(
					(u) => u.num_veh === bv.num_veh && (Number(u.catu) === 1 || Number(u.catu) === 2),
				);
				for (const u of cyclistUsagers) {
					const grav = Number(u.grav);
					const gravLabel = GRAVITE[grav];
					if (!gravLabel) continue;
					const sexe = SEXE[Number(u.sexe ?? u.sex)] || '';
					const age = ageFromYear(u.an_nais, caract.year);
					const resume = buildResume({
						caract,
						lieu,
						vehicles: accVehicles,
						usagers: accUsagers,
						focusUsager: u,
						focusVehicle: bv,
					});

					const vehicleLabel = VICTIM_VEHICLE_LABELS[Number(bv.catv)] || 'Vélo';
					// Victim-vehicle manoeuvre and point of impact (informative).
					const manvCode = Number(bv.manv);
					const chocCode = Number(bv.choc);
					const manvLabel = MANV[manvCode] || '';
					const chocLabel = CHOC[chocCode] || '';
					features.push({
						type: 'Feature',
						geometry: { type: 'Point', coordinates: coords },
						properties: {
							id_accident: idAccident,
							an: caract.year,
							adresse,
							annee: isoDateStr,
							libelle_commune: communeName,
							victime_type: 'Vélo',
							victim_vehicle: vehicleLabel,
							categorie: Number(u.catu) === 1 ? 'Conducteur' : 'Passager',
							gravite: gravLabel,
							age,
							sexe_victime: sexe,
							resume,
							tues: tally.tues,
							blesses_legers: tally.blesses_legers,
							hospitalises: tally.hospitalises,
							indemnes: tally.indemnes,
							collision_type: collision.type,
							other_vehicles: collision.otherLabels,
							manoeuvre: manvLabel,
							choc: chocLabel,
							collision_shape: collisionShape,
							lateral: isLateral,
							intersection: intersectionLabel,
							at_intersection: atIntersection,
						},
					});
				}
			}

			// Pedestrians (catu=3) struck during a bike-involved accident: emit one
			// feature per pedestrian victim so they're filterable as "Piéton".
			const pedestrianUsagers = accUsagers.filter((u) => Number(u.catu) === 3);
			for (const u of pedestrianUsagers) {
				const grav = Number(u.grav);
				const gravLabel = GRAVITE[grav];
				if (!gravLabel) continue;
				const sexe = SEXE[Number(u.sexe ?? u.sex)] || '';
				const age = ageFromYear(u.an_nais, caract.year);
				const resume = buildResume({
					caract,
					lieu,
					vehicles: accVehicles,
					usagers: accUsagers,
					focusUsager: u,
					focusVehicle: bikeVehicles[0],
				});

				// Pedestrian victims have no own vehicle, so manoeuvre/choc are
				// inherited from the colliding bike for context.
				const focusBike = bikeVehicles[0];
				const manvCode = Number(focusBike?.manv);
				const chocCode = Number(focusBike?.choc);
				const manvLabel = MANV[manvCode] || '';
				const chocLabel = CHOC[chocCode] || '';
				features.push({
					type: 'Feature',
					geometry: { type: 'Point', coordinates: coords },
					properties: {
						id_accident: idAccident,
						an: caract.year,
						adresse,
						annee: isoDateStr,
						libelle_commune: communeName,
						victime_type: 'Piéton',
						victim_vehicle: 'Piéton',
						categorie: 'Piéton',
						gravite: gravLabel,
						age,
						sexe_victime: sexe,
						resume,
						tues: tally.tues,
						blesses_legers: tally.blesses_legers,
						hospitalises: tally.hospitalises,
						indemnes: tally.indemnes,
						collision_type: collision.type,
						other_vehicles: collision.otherLabels,
						manoeuvre: manvLabel,
						choc: chocLabel,
						collision_shape: collisionShape,
						lateral: isLateral,
						intersection: intersectionLabel,
						at_intersection: atIntersection,
					},
				});
			}
			yearCount++;
		}
		totalAccidents += yearCount;
		console.log(
			`[${year}] ${yearCount} bicycle accident(s) in perimeter, ${features.length} feature(s) cumulated`,
		);
	}

	const fc = { type: 'FeatureCollection', features };
	await writeFile(OUT_PATH, JSON.stringify(fc));
	console.log(
		`\n✓ wrote ${features.length} features (${totalAccidents} unique accidents) → ${OUT_PATH}`,
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
