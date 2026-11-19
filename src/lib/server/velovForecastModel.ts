import {
	VELOV_FORECAST_KINDS,
	VELOV_FORECAST_STEP_COUNT,
	VELOV_FORECAST_STEP_MS,
	type VelovForecastKind,
	type VelovForecastSeries,
	type VelovForecastState,
} from '$lib/utils/velovForecast';
import {
	VELOV_FORECAST_DAY_TYPES,
	VELOV_FORECAST_HABIT_KEYS,
	VELOV_FORECAST_HOURS_PER_DAY,
	VELOV_FORECAST_INPUTS,
	VELOV_FORECAST_SITE_KEYS,
	velovForecastRanges,
	velovForecastSeries,
	type VelovForecastForest,
	type VelovForecastPlan,
	type VelovForecastStation,
} from './velovForecastKernel';

type Tree = {
	f: number[];
	s: number[];
	d: number[];
	g: number[];
	r: number[];
	v: number[];
	racine: number;
};

type Forest = { objectif: string; arbres: Tree[] };

type Site = {
	id: number;
	altitude?: number | null;
	dist_metro_km?: number | null;
	dist_tram_km?: number | null;
	dist_gare_km?: number | null;
	lat?: number | null;
	lon?: number | null;
};

export type VelovForecastBundle = {
	format: number;
	version: string;
	variables: string[];
	deciles: number[];
	modeles: Record<string, Forest>;
	habitude?: Record<string, Record<string, (number | null)[]>>;
	stations?: Site[];
	calendrier?: { feries?: string[]; vacances?: number[][] };
	controle?: { sortes?: Record<string, { couv80?: number | null }> };
};

export type VelovForecastIndex = { format: number; version: string; verifie: number };

const FORMAT = 1;
const SHOWN_LEVELS = [10, 30, 50, 70, 90];
const CATEGORICAL_BIT = 1;
const DEFAULT_LEFT_BIT = 2;
const MISSING_ZERO = 1;
const MISSING_NAN = 2;

function isWellFormed(tree: Tree, variableCount: number): boolean {
	const nodes = tree.f.length;
	const isChild = (child: number, parent: number) =>
		child >= 0 ? child > parent && child < nodes : ~child < tree.v.length;

	if (
		tree.s.length !== nodes ||
		tree.d.length !== nodes ||
		tree.g.length !== nodes ||
		tree.r.length !== nodes
	) {
		return false;
	}

	if (!isChild(tree.racine, -1)) {
		return false;
	}

	for (let node = 0; node < nodes; node += 1) {
		if (
			tree.f[node] < 0 ||
			tree.f[node] >= variableCount ||
			(tree.d[node] & CATEGORICAL_BIT) !== 0 ||
			!isChild(tree.g[node], node) ||
			!isChild(tree.r[node], node)
		) {
			return false;
		}
	}

	return true;
}

function missingOf(flags: number): number {
	return (flags >> 2) & 3;
}

function flatten(forest: Forest, variableCount: number): VelovForecastForest {
	const trees = forest.arbres;
	const nodeCount = trees.reduce((count, tree) => count + tree.f.length, 0);
	const leafCount = trees.reduce((count, tree) => count + tree.v.length, 0);
	const flat: VelovForecastForest = {
		binary: forest.objectif === 'binary' || forest.objectif === 'cross_entropy',
		roots: new Int32Array(trees.length),
		column: new Int32Array(nodeCount),
		missingLeft: new Uint8Array(nodeCount),
		left: new Int32Array(nodeCount),
		right: new Int32Array(nodeCount),
		threshold: new Float64Array(nodeCount),
		leaf: new Float64Array(leafCount),
	};
	let nodeAt = 0;
	let leafAt = 0;

	trees.forEach((tree, rank) => {
		const child = (at: number) => (at >= 0 ? at + nodeAt : ~(~at + leafAt));
		flat.roots[rank] = child(tree.racine);
		for (let node = 0; node < tree.f.length; node += 1) {
			const missing = missingOf(tree.d[node]);
			const defaultLeft = (tree.d[node] & DEFAULT_LEFT_BIT) !== 0;
			flat.column[nodeAt + node] = tree.f[node] + (missing === MISSING_ZERO ? variableCount : 0);
			flat.missingLeft[nodeAt + node] = (
				missing === MISSING_ZERO || missing === MISSING_NAN ? defaultLeft : 0 <= tree.s[node]
			)
				? 1
				: 0;
			flat.threshold[nodeAt + node] = tree.s[node];
			flat.left[nodeAt + node] = child(tree.g[node]);
			flat.right[nodeAt + node] = child(tree.r[node]);
		}
		flat.leaf.set(tree.v, leafAt);
		nodeAt += tree.f.length;
		leafAt += tree.v.length;
	});

	return flat;
}

function compactHabits(habits: VelovForecastBundle['habitude']): Map<number, Float64Array> {
	const out = new Map<number, Float64Array>();

	for (const [stationId, slots] of Object.entries(habits ?? {})) {
		const id = Number.parseInt(stationId, 10);
		if (!Number.isInteger(id)) {
			continue;
		}

		const table = new Float64Array(
			VELOV_FORECAST_DAY_TYPES * VELOV_FORECAST_HOURS_PER_DAY * VELOV_FORECAST_HABIT_KEYS.length,
		).fill(NaN);
		for (const [slot, averages] of Object.entries(slots)) {
			const [dayType, hour] = slot.split('_').map((part) => Number.parseInt(part, 10));
			if (
				!(
					dayType >= 0 &&
					dayType < VELOV_FORECAST_DAY_TYPES &&
					hour >= 0 &&
					hour < VELOV_FORECAST_HOURS_PER_DAY
				)
			) {
				continue;
			}

			const offset =
				(dayType * VELOV_FORECAST_HOURS_PER_DAY + hour) * VELOV_FORECAST_HABIT_KEYS.length;
			for (
				let rank = 0;
				rank < Math.min(VELOV_FORECAST_HABIT_KEYS.length, averages.length);
				rank += 1
			) {
				const value = averages[rank];
				if (value !== null && value !== undefined) {
					table[offset + rank] = value;
				}
			}
		}
		out.set(id, table);
	}

	return out;
}

function compactSite(site: Site): Float64Array {
	return Float64Array.from(VELOV_FORECAST_SITE_KEYS, (key) => {
		const value = site[key];
		return value === null || value === undefined ? NaN : value;
	});
}

export class VelovForecastModel {
	readonly version: string;
	readonly coverage: Partial<Record<VelovForecastKind, number>> = {};
	readonly plan: VelovForecastPlan;

	constructor(bundle: VelovForecastBundle) {
		if (bundle.format !== FORMAT) {
			throw new Error(`Format ${bundle.format} inconnu`);
		}

		const deciles = bundle.deciles;
		const symmetric = deciles.every(
			(level, rank) => level === 100 - deciles[deciles.length - 1 - rank],
		);
		const ascending = deciles.every((level, rank) => rank === 0 || level > deciles[rank - 1]);
		if (!SHOWN_LEVELS.every((level) => deciles.includes(level)) || !symmetric || !ascending) {
			throw new Error(`Déciles ${deciles} inutilisables`);
		}

		const forest = (name: string): VelovForecastForest => {
			const found = bundle.modeles[name];
			if (!found) {
				throw new Error(`Modèle ${name} absent`);
			}

			if (!found.arbres.every((tree) => isWellFormed(tree, bundle.variables.length))) {
				throw new Error(`Arbre illisible dans ${name}`);
			}

			return flatten(found, bundle.variables.length);
		};

		this.version = bundle.version;
		this.plan = {
			kinds: VELOV_FORECAST_KINDS,
			stepMs: VELOV_FORECAST_STEP_MS,
			slots: bundle.variables.map((name) => {
				const slot = (VELOV_FORECAST_INPUTS as readonly string[]).indexOf(name);
				return slot < 0 ? VELOV_FORECAST_INPUTS.length : slot;
			}),
			blanked: Object.values(bundle.modeles).some((found) =>
				found.arbres.some((tree) => tree.d.some((flags) => missingOf(flags) === MISSING_ZERO)),
			),
			shownRanks: SHOWN_LEVELS.map((level) => deciles.indexOf(level)),
			decileForests: {
				velos: deciles.map((level) => forest(`velos_q${level}`)),
				elec: deciles.map((level) => forest(`elec_q${level}`)),
				meca: deciles.map((level) => forest(`meca_q${level}`)),
			},
			anyForests: {
				velos: forest('velos_p1'),
				elec: forest('elec_p1'),
				meca: forest('meca_p1'),
				bornes: forest('bornes_p1'),
			},
			sites: new Map((bundle.stations ?? []).map((site) => [site.id, compactSite(site)])),
			habits: compactHabits(bundle.habitude),
			holidays: new Set(bundle.calendrier?.feries ?? []),
			schoolHolidays: (bundle.calendrier?.vacances ?? []).filter((span) => span.length === 2),
		};

		for (const kind of VELOV_FORECAST_KINDS) {
			const coverage = bundle.controle?.sortes?.[kind]?.couv80;
			if (typeof coverage === 'number') {
				this.coverage[kind] = coverage;
			}
		}
	}

	knows(stationId: number): boolean {
		return this.plan.sites.has(stationId);
	}

	forecast(
		stationId: number,
		state: VelovForecastState,
		originMs: number,
	): Record<VelovForecastKind, VelovForecastSeries> {
		return velovForecastSeries(
			this.plan,
			{ id: stationId, state },
			originMs,
			VELOV_FORECAST_STEP_COUNT,
		);
	}

	rangesAt(stations: VelovForecastStation[], originMs: number, steps: number[]): number[][] {
		return velovForecastRanges(this.plan, stations, originMs, steps);
	}
}
