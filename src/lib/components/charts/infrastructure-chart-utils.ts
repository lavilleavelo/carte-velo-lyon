import type * as Chart from '$lib/components/ui/chart/index.js';
import type { ChartContextValue } from 'layerchart';

export interface StackLabel {
	label: string;
	color: string;
	x: number;
	y: number;
	visible: boolean;
}

export function computeStackLabelPositions(
	context: ChartContextValue | undefined,
	chartData: Record<string, any>[],
	series: { key: string; label: string; color: string }[],
	minBandHeight: number = 14,
): StackLabel[] {
	if (!context || chartData.length === 0 || series.length === 0) return [];

	const lastDataPoint = chartData[chartData.length - 1];
	if (!lastDataPoint) return [];

	const xPos = context.xScale(lastDataPoint.year);
	const yScale = context.yScale;

	let cumulativeValue = 0;
	return series.map((s) => {
		const value = lastDataPoint[s.key] || 0;
		const bandBottom = yScale(cumulativeValue);
		const bandTop = yScale(cumulativeValue + value);
		const bandHeight = Math.abs(bandBottom - bandTop);
		cumulativeValue += value;

		return {
			label: s.label,
			color: s.color,
			x: xPos,
			y: (bandTop + bandBottom) / 2,
			visible: bandHeight >= minBandHeight,
		};
	});
}

export const typeColors: Record<string, string> = {
	'Piste Cyclable': 'var(--chart-1)',
	'Bande Cyclable': 'var(--chart-2)',
	'Voie verte': 'var(--chart-3)',
	'Double sens cyclable': 'var(--chart-4)',
	'Couloir bus vélo élargi': 'var(--chart-5)',
	'Couloir bus vélo non élargi': 'var(--chart-6)',
	'Chaussée à voie centrale banalisée (CVCB)': 'var(--chart-7)',
	'Goulotte ou rampe': 'var(--chart-8)',
	Autre: '#6b7280',
};

export const parkingTypeColors: Record<string, string> = {
	'Arceaux Wilmotte': 'var(--chart-1)',
	'Arceaux en U inversé': 'var(--chart-2)',
	'Consigne collective vélo sécurisé': 'var(--chart-3)',
	'Consigne individuelle vélo sécurisé': 'var(--chart-4)',
	'Box vélo sécurisé': 'var(--chart-5)',
	'Espace Vélo Sécurisé': 'var(--chart-6)',
	'Local vélo sécurisé': 'var(--chart-7)',
	Vélostation: 'var(--chart-8)',
	'Autre mobilier': '#6b7280',
};

export function createTypeChartConfig(facilityTypes: string[]): Chart.ChartConfig {
	return facilityTypes.reduce((acc, type) => {
		acc[type] = {
			label: type,
			color: typeColors[type] || 'var(--chart-1)',
		};
		acc[`cumulative_${type}`] = {
			label: type,
			color: typeColors[type] || 'var(--chart-1)',
		};
		return acc;
	}, {} as Chart.ChartConfig);
}

export function createParkingTypeChartConfig(parkingTypes: string[]): Chart.ChartConfig {
	return parkingTypes.reduce((acc, type) => {
		acc[`parking_${type}`] = {
			label: type,
			color: parkingTypeColors[type] || 'var(--chart-1)',
		};
		acc[`cumulative_parking_${type}`] = {
			label: type,
			color: parkingTypeColors[type] || 'var(--chart-1)',
		};
		return acc;
	}, {} as Chart.ChartConfig);
}

export function createTypeSeries(facilityTypes: string[], showCumulative: boolean) {
	return facilityTypes.map((type) => ({
		key: showCumulative ? `cumulative_${type}` : type,
		label: type,
		color: typeColors[type] || 'var(--chart-1)',
	}));
}

export function createParkingTypeSeries(parkingTypes: string[], showCumulative: boolean) {
	return parkingTypes.map((type) => ({
		key: showCumulative ? `cumulative_parking_${type}` : `parking_${type}`,
		label: type,
		color: parkingTypeColors[type] || 'var(--chart-1)',
	}));
}

export interface YearBikeLaneData {
	length: number;
	count: number;
	byType: Record<string, number>;
}

export interface YearParkingData {
	capacity: number;
	count: number;
	byType: Record<string, number>;
	countByType: Record<string, number>;
}

export function computeBikeLanesEvolution(
	features: any[],
	mergeUnknownToLastYear: boolean = true,
): Record<number, YearBikeLaneData> {
	const yearData: Record<number, YearBikeLaneData> = {};

	features.forEach((feature: any) => {
		const year = feature.properties?.anneelivraison;
		const length = feature.properties?.longueur || 0;
		const type = feature.properties?.typeamenagement || 'Autre';

		if (
			typeof year === 'number' &&
			!isNaN(year) &&
			year > 1900 &&
			year <= new Date().getFullYear()
		) {
			if (!yearData[year]) {
				yearData[year] = { length: 0, count: 0, byType: {} };
			}
			yearData[year].length += length;
			yearData[year].count += 1;
			yearData[year].byType[type] = (yearData[year].byType[type] || 0) + length;
		} else {
			if (!yearData[9999]) {
				yearData[9999] = { length: 0, count: 0, byType: {} };
			}
			yearData[9999].length += length;
			yearData[9999].count += 1;
			yearData[9999].byType[type] = (yearData[9999].byType[type] || 0) + length;
		}
	});

	if (yearData[9999]) {
		if (mergeUnknownToLastYear) {
			const maxYear = Math.max(
				...Object.keys(yearData)
					.filter((y) => y !== '9999')
					.map((y) => parseInt(y)),
			);
			if (maxYear && yearData[maxYear]) {
				yearData[maxYear].length += yearData[9999].length;
				yearData[maxYear].count += yearData[9999].count;
				for (const [type, length] of Object.entries(yearData[9999].byType)) {
					yearData[maxYear].byType[type] = (yearData[maxYear].byType[type] || 0) + length;
				}
			}
		}
		delete yearData[9999];
	}

	return yearData;
}

export function computeParkingEvolution(
	features: any[],
	filterFn?: (feature: any) => boolean,
): Record<number, YearParkingData> {
	const yearData: Record<number, YearParkingData> = {};

	const filteredFeatures = filterFn ? features.filter(filterFn) : features;

	filteredFeatures
		.filter((feature: any) => feature.properties?.validite === 'Validé')
		.forEach((feature: any) => {
			const year = feature.properties?.anneerealisation;
			const capacite = feature.properties?.capacite || 0;
			const type = feature.properties?.mobiliervelo || 'Autre';

			if (typeof year === 'number' && !isNaN(year)) {
				if (!yearData[year]) {
					yearData[year] = { capacity: 0, count: 0, byType: {}, countByType: {} };
				}
				yearData[year].capacity += capacite;
				yearData[year].count += 1;
				yearData[year].byType[type] = (yearData[year].byType[type] || 0) + capacite;
				yearData[year].countByType[type] = (yearData[year].countByType[type] || 0) + 1;
			}
		});

	return yearData;
}

export function computeBikeLanesWithoutYear(features: any[]): { length: number; count: number } {
	let length = 0;
	let count = 0;

	features.forEach((feature: any) => {
		const year = feature.properties?.anneelivraison;
		const len = feature.properties?.longueur || 0;

		if (
			typeof year !== 'number' ||
			isNaN(year) ||
			year <= 1900 ||
			year > new Date().getFullYear()
		) {
			length += len;
			count += 1;
		}
	});

	return { length, count };
}

export function computeParkingWithoutYear(
	features: any[],
	filterFn?: (feature: any) => boolean,
): { capacity: number; count: number } {
	let capacity = 0;
	let count = 0;

	const filteredFeatures = filterFn ? features.filter(filterFn) : features;

	filteredFeatures
		.filter((feature: any) => feature.properties?.validite === 'Validé')
		.forEach((feature: any) => {
			const year = feature.properties?.anneerealisation;
			const capacite = feature.properties?.capacite || 0;

			if (typeof year !== 'number' || isNaN(year)) {
				capacity += capacite;
				count += 1;
			}
		});

	return { capacity, count };
}

export function extractFacilityTypes(features: any[]): string[] {
	const types = new Set<string>();
	features.forEach((feature: any) => {
		const type = feature.properties?.typeamenagement;
		if (type) types.add(type);
	});
	return Array.from(types).sort();
}

export function extractParkingTypes(
	features: any[],
	filterFn?: (feature: any) => boolean,
): string[] {
	const types = new Set<string>();
	const filteredFeatures = filterFn ? features.filter(filterFn) : features;
	filteredFeatures
		.filter((feature: any) => feature.properties?.validite === 'Validé')
		.forEach((feature: any) => {
			const type = feature.properties?.mobiliervelo;
			if (type) types.add(type);
		});
	return Array.from(types).sort();
}

export function buildChartData(
	bikeLanesEvolution: Record<number, YearBikeLaneData>,
	parkingEvolution: Record<number, YearParkingData>,
	facilityTypes: string[],
	parkingTypes: string[],
	startYear: number = 2010,
): Record<string, any>[] {
	const allYears = new Set<number>();

	Object.keys(bikeLanesEvolution).forEach((year) => allYears.add(parseInt(year)));
	Object.keys(parkingEvolution).forEach((year) => allYears.add(parseInt(year)));

	const currentYear = new Date().getFullYear();
	for (let year = startYear; year <= currentYear; year++) {
		allYears.add(year);
	}

	const sortedYears = Array.from(allYears).sort((a, b) => a - b);

	let cumulativeBikeLanes = 0;
	let cumulativeParking = 0;
	let cumulativeParkingCount = 0;
	const cumulativeByType: Record<string, number> = {};
	const cumulativeByParkingType: Record<string, number> = {};
	const cumulativeCountByParkingType: Record<string, number> = {};

	return sortedYears.map((year) => {
		const bikeLaneData = bikeLanesEvolution[year];
		const parkingData = parkingEvolution[year];

		cumulativeBikeLanes += bikeLaneData?.length || 0;
		cumulativeParking += parkingData?.capacity || 0;
		cumulativeParkingCount += parkingData?.count || 0;

		if (bikeLaneData?.byType) {
			for (const [type, length] of Object.entries(bikeLaneData.byType)) {
				cumulativeByType[type] = (cumulativeByType[type] || 0) + length;
			}
		}

		if (parkingData?.byType) {
			for (const [type, capacity] of Object.entries(parkingData.byType)) {
				cumulativeByParkingType[type] = (cumulativeByParkingType[type] || 0) + capacity;
			}
		}

		if (parkingData?.countByType) {
			for (const [type, count] of Object.entries(parkingData.countByType)) {
				cumulativeCountByParkingType[type] = (cumulativeCountByParkingType[type] || 0) + count;
			}
		}

		const dataPoint: Record<string, any> = {
			year,
			bikeLanesKm: Math.round((bikeLaneData?.length || 0) / 10) / 100,
			cumulativeBikeLanesKm: Math.round(cumulativeBikeLanes / 10) / 100,
			parkingPlaces: parkingData?.capacity || 0,
			cumulativeParkingPlaces: cumulativeParking,
			parkingCount: parkingData?.count || 0,
			cumulativeParkingCount: cumulativeParkingCount,
		};

		for (const type of facilityTypes) {
			const yearlyLength = bikeLaneData?.byType?.[type] || 0;
			dataPoint[type] = Math.round(yearlyLength / 10) / 100;
			dataPoint[`cumulative_${type}`] = Math.round((cumulativeByType[type] || 0) / 10) / 100;
		}

		for (const type of parkingTypes) {
			dataPoint[`parking_${type}`] = parkingData?.byType?.[type] || 0;
			dataPoint[`cumulative_parking_${type}`] = cumulativeByParkingType[type] || 0;
			dataPoint[`parking_count_${type}`] = parkingData?.countByType?.[type] || 0;
			dataPoint[`cumulative_parking_count_${type}`] = cumulativeCountByParkingType[type] || 0;
		}

		return dataPoint;
	});
}
