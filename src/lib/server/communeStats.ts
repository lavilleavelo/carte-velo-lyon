import type { FeatureCollection } from 'geojson';
import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
import { getCachedGrandLyonData } from '$lib/server/cache';
import { buildBoundary, expandInsee, featureByInsee } from '$lib/server/communeBoundary';
import communeMetadataJson from '$lib/data/communeMetadata.json';
import {
	buildChartData,
	computeBikeLanesEvolution,
	computeBikeLanesWithoutYear,
	computeParkingEvolution,
	computeParkingWithoutYear,
	extractFacilityTypes,
	extractParkingTypes,
} from '$lib/components/charts/infrastructure-chart-utils';
import {
	LYON_ARRONDISSEMENT_INSEE,
	LYON_ARRONDISSEMENT_INSEE_SET,
	LYON_INSEE,
	isLyonArrondissementInsee,
} from '$lib/config/lyon';

export type RankingTier = 'top' | 'good' | 'mid' | 'low';
export type RankingScope = 'metropole' | 'arrondissements';

export interface CommuneRanking {
	rank: number;
	total: number;
	tier: RankingTier;
	scope: RankingScope;
}

export interface CommuneRankings {
	bikeInfraPer100kmRoadway: CommuneRanking | null;
	recentBikeLanesPer100kmRoadway: CommuneRanking | null;
	parkingPer1000: CommuneRanking | null;
	recentParkingPer1000: CommuneRanking | null;
}

export interface CommuneInfraChart {
	chartDataExcludingUnknowns: Record<string, number>[];
	chartDataIncludingUnknowns: Record<string, number>[];
	facilityTypes: string[];
	parkingTypes: string[];
	bikeLanesWithoutYear: { length: number; count: number };
	parkingWithoutYear: { capacity: number; count: number };
}

interface CommuneCoreMetrics {
	totalBikeLanesKm: number;
	parkingPlaces: number;
	parkingFeatures: number;
	population: number | null;
	populationYear: number | null;
	parkingPer1000: number | null;
	eligibleRoadwayKm: number | null;
	bikeInfraPer100kmRoadway: number | null;
	recentBikeLanesKm: number;
	recentBikeLanesPer100kmRoadway: number | null;
	recentParkingPlaces: number;
	recentParkingFeatures: number;
	recentParkingPer1000: number | null;
	recentYearFrom: number;
}

export interface CommuneStats extends CommuneCoreMetrics {
	chart: CommuneInfraChart;
	rankings: CommuneRankings | null;
}

interface CommuneMetadataEntry {
	population?: number | null;
	populationYear?: number | null;
}

const metadataByInsee = communeMetadataJson as Record<string, CommuneMetadataEntry>;

function pickPopulation(insees: readonly string[]): {
	value: number | null;
	year: number | null;
} {
	let total = 0;
	let year: number | null = null;
	for (const insee of insees) {
		const md = metadataByInsee[insee];
		if (md?.population == null) {
			return { value: null, year: null };
		}
		total += md.population;
		if (year === null && md.populationYear != null) {
			year = md.populationYear;
		}
	}
	return total > 0 ? { value: total, year } : { value: null, year: null };
}

const RECENT_WINDOW_YEARS = 3;

interface FilteredData {
	voirieInside: FeatureCollection;
	parkingInside: FeatureCollection;
	speedLimitsInside: FeatureCollection;
}

function filterAll(
	insees: readonly string[],
	voirie: FeatureCollection,
	parking: FeatureCollection,
	speedLimits: FeatureCollection,
): FilteredData | null {
	const boundary = buildBoundary(insees);
	if (!boundary) {
		return null;
	}

	return {
		voirieInside: filterFeaturesInsideBoundary(voirie, boundary),
		parkingInside: filterFeaturesInsideBoundary(parking, boundary),
		speedLimitsInside: filterFeaturesInsideBoundary(speedLimits, boundary),
	};
}

function computeCoreMetrics(insees: readonly string[], data: FilteredData): CommuneCoreMetrics {
	const currentYear = new Date().getFullYear();
	const recentYearFrom = currentYear - (RECENT_WINDOW_YEARS - 1);

	let totalLengthM = 0;
	let recentLengthM = 0;
	for (const f of data.voirieInside.features) {
		const props = (f.properties ?? {}) as Record<string, unknown>;
		const length = Number(props.longueur) || 0;
		totalLengthM += length;
		const year = Number(props.anneelivraison);
		if (Number.isFinite(year) && year >= recentYearFrom && year <= currentYear) {
			recentLengthM += length;
		}
	}

	let eligibleRoadwayM = 0;
	for (const f of data.speedLimitsInside.features) {
		const props = (f.properties ?? {}) as Record<string, unknown>;
		const numericSpeed = Number(props.limitationvitesse);
		if (!Number.isFinite(numericSpeed) || numericSpeed <= 5 || numericSpeed >= 70) {
			continue;
		}

		eligibleRoadwayM += Number(props.longueurcalculee) || 0;
	}

	let parkingPlaces = 0;
	let parkingFeatures = 0;
	let recentParkingPlaces = 0;
	let recentParkingFeatures = 0;
	for (const f of data.parkingInside.features) {
		const props = (f.properties ?? {}) as Record<string, unknown>;
		if (props.validite !== 'Validé') {
			continue;
		}

		const capacity = Number(props.capacite) || 0;
		parkingPlaces += capacity;
		parkingFeatures += 1;
		const year = Number(props.anneerealisation);
		if (Number.isFinite(year) && year >= recentYearFrom && year <= currentYear) {
			recentParkingPlaces += capacity;
			recentParkingFeatures += 1;
		}
	}

	const totalBikeLanesKm = totalLengthM / 1000;
	const recentBikeLanesKm = recentLengthM / 1000;
	const eligibleRoadwayKm = eligibleRoadwayM / 1000;
	const hasRoadwayData = eligibleRoadwayKm > 0;
	const { value: population, year: populationYear } = pickPopulation(insees);
	const popK = population ? population / 1000 : null;

	return {
		totalBikeLanesKm,
		parkingPlaces,
		parkingFeatures,
		population,
		populationYear,
		parkingPer1000: popK ? parkingPlaces / popK : null,
		eligibleRoadwayKm: hasRoadwayData ? eligibleRoadwayKm : null,
		bikeInfraPer100kmRoadway: hasRoadwayData ? (totalBikeLanesKm / eligibleRoadwayKm) * 100 : null,
		recentBikeLanesKm,
		recentBikeLanesPer100kmRoadway: hasRoadwayData
			? (recentBikeLanesKm / eligibleRoadwayKm) * 100
			: null,
		recentParkingPlaces,
		recentParkingFeatures,
		recentParkingPer1000: popK ? recentParkingPlaces / popK : null,
		recentYearFrom,
	};
}

function computeChart(data: FilteredData): CommuneInfraChart {
	const facilityTypes = extractFacilityTypes(data.voirieInside.features);
	const parkingTypes = extractParkingTypes(data.parkingInside.features);
	const parkingEvolution = computeParkingEvolution(data.parkingInside.features);
	const bikeLanesEvolutionExcluding = computeBikeLanesEvolution(data.voirieInside.features, false);
	const bikeLanesEvolutionIncluding = computeBikeLanesEvolution(data.voirieInside.features, true);
	const bikeLanesWithoutYearAgg = computeBikeLanesWithoutYear(data.voirieInside.features);
	const parkingWithoutYearAgg = computeParkingWithoutYear(data.parkingInside.features);

	return {
		chartDataExcludingUnknowns: buildChartData(
			bikeLanesEvolutionExcluding,
			parkingEvolution,
			facilityTypes,
			parkingTypes,
			2010,
		) as Record<string, number>[],
		chartDataIncludingUnknowns: buildChartData(
			bikeLanesEvolutionIncluding,
			parkingEvolution,
			facilityTypes,
			parkingTypes,
			2010,
		) as Record<string, number>[],
		facilityTypes,
		parkingTypes,
		bikeLanesWithoutYear: {
			length: bikeLanesWithoutYearAgg.length,
			count: bikeLanesWithoutYearAgg.count,
		},
		parkingWithoutYear: {
			capacity: parkingWithoutYearAgg.capacity,
			count: parkingWithoutYearAgg.count,
		},
	};
}

function tierForRatio(ratio: number): RankingTier {
	if (ratio <= 0.25) return 'top';
	if (ratio <= 0.5) return 'good';
	if (ratio <= 0.75) return 'mid';
	return 'low';
}

function rankWithin(
	value: number | null,
	allValues: (number | null)[],
	scope: RankingScope,
): CommuneRanking | null {
	if (value === null || !Number.isFinite(value)) return null;
	const valid = allValues.filter((v): v is number => v !== null && Number.isFinite(v));
	if (valid.length === 0) {
		return null;
	}

	const better = valid.filter((v) => v > value).length;
	const rank = better + 1;
	const total = valid.length;

	return { rank, total, tier: tierForRatio(rank / total), scope };
}

let cachedVoirie: FeatureCollection | null = null;
let cachedParking: FeatureCollection | null = null;
let cachedSpeedLimits: FeatureCollection | null = null;
const coreMetricsCache = new Map<string, CommuneCoreMetrics | null>();
const statsCache = new Map<string, CommuneStats | null>();
const inflight = new Map<string, Promise<CommuneStats | null>>();
let allMetricsComputed = false;

function ensureAllCoreMetrics(
	voirie: FeatureCollection,
	parking: FeatureCollection,
	speedLimits: FeatureCollection,
): void {
	if (allMetricsComputed) {
		return;
	}

	for (const insee of featureByInsee.keys()) {
		if (coreMetricsCache.has(insee)) continue;
		const data = filterAll([insee], voirie, parking, speedLimits);
		coreMetricsCache.set(insee, data ? computeCoreMetrics([insee], data) : null);
	}

	if (!coreMetricsCache.has(LYON_INSEE)) {
		const data = filterAll(LYON_ARRONDISSEMENT_INSEE, voirie, parking, speedLimits);
		coreMetricsCache.set(
			LYON_INSEE,
			data ? computeCoreMetrics(LYON_ARRONDISSEMENT_INSEE, data) : null,
		);
	}
	allMetricsComputed = true;
}

const METROPOLE_RANKING_INSEES: readonly string[] = [
	...[...featureByInsee.keys()].filter((i) => !LYON_ARRONDISSEMENT_INSEE_SET.has(i)),
	LYON_INSEE,
];

function buildRankings(insee: string): CommuneRankings | null {
	const target = coreMetricsCache.get(insee);
	if (!target) {
		return null;
	}

	const isArrondissement = isLyonArrondissementInsee(insee);
	const universeInsees = isArrondissement ? LYON_ARRONDISSEMENT_INSEE : METROPOLE_RANKING_INSEES;
	const scope: RankingScope = isArrondissement ? 'arrondissements' : 'metropole';
	const universe = universeInsees.map((i) => coreMetricsCache.get(i) ?? null);

	return {
		bikeInfraPer100kmRoadway: rankWithin(
			target.bikeInfraPer100kmRoadway,
			universe.map((m) => m?.bikeInfraPer100kmRoadway ?? null),
			scope,
		),
		recentBikeLanesPer100kmRoadway: rankWithin(
			target.recentBikeLanesPer100kmRoadway,
			universe.map((m) => m?.recentBikeLanesPer100kmRoadway ?? null),
			scope,
		),
		parkingPer1000: rankWithin(
			target.parkingPer1000,
			universe.map((m) => m?.parkingPer1000 ?? null),
			scope,
		),
		recentParkingPer1000: rankWithin(
			target.recentParkingPer1000,
			universe.map((m) => m?.recentParkingPer1000 ?? null),
			scope,
		),
	};
}

export async function getCommuneStatsForInsee(insee: string): Promise<CommuneStats | null> {
	const insees = expandInsee(insee);

	const [voirie, parking, speedLimits] = (await Promise.all([
		getCachedGrandLyonData('voirie'),
		getCachedGrandLyonData('parking'),
		getCachedGrandLyonData('speedLimits'),
	])) as [FeatureCollection, FeatureCollection, FeatureCollection];

	if (cachedVoirie !== voirie || cachedParking !== parking || cachedSpeedLimits !== speedLimits) {
		statsCache.clear();
		coreMetricsCache.clear();
		allMetricsComputed = false;
		cachedVoirie = voirie;
		cachedParking = parking;
		cachedSpeedLimits = speedLimits;
	}

	if (statsCache.has(insee)) {
		return statsCache.get(insee) ?? null;
	}

	const existing = inflight.get(insee);
	if (existing) return existing;

	const promise = (async () => {
		try {
			ensureAllCoreMetrics(voirie, parking, speedLimits);

			const data = filterAll(insees, voirie, parking, speedLimits);
			if (!data) {
				statsCache.set(insee, null);
				return null;
			}

			const core = coreMetricsCache.get(insee) ?? computeCoreMetrics(insees, data);
			const chart = computeChart(data);
			const rankings = buildRankings(insee);

			const stats: CommuneStats = { ...core, chart, rankings };
			statsCache.set(insee, stats);
			return stats;
		} catch (error) {
			console.error(`Failed to compute commune stats for INSEE ${insee}:`, error);
			statsCache.set(insee, null);
			return null;
		} finally {
			inflight.delete(insee);
		}
	})();

	inflight.set(insee, promise);
	return promise;
}
