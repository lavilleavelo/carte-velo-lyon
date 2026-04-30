export function createLineShieldIcon(label: string | number, color: string): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	const size = 64;

	canvas.width = size;
	canvas.height = size;

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return canvas;
	}

	const centerX = size / 2;
	const centerY = size / 2;
	const radius = size / 2 - 4;

	// circle background
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
	ctx.fill();

	// white border
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 3;
	ctx.stroke();

	// label
	ctx.fillStyle = '#ffffff';
	ctx.font = 'bold 28px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(String(label), centerX, centerY + 3);

	return canvas;
}

export async function loadTransportShieldIcons(mapInstance: any, features: any[], prefix: string) {
	const uniqueLines = new Map<string, string>(); // label -> color

	features.forEach((f) => {
		const label = f.properties.ligne;
		let color = f.properties.color;

		if (label && color) {
			uniqueLines.set(label, color);
		}
	});

	uniqueLines.forEach((color, label) => {
		const iconId = `${prefix}-shield-${label}`;
		if (!mapInstance.hasImage(iconId)) {
			const canvas = createLineShieldIcon(label, color);
			const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
			if (imageData) {
				mapInstance.addImage(iconId, imageData);
			}
		}
	});
}

/**
 * Layer ids of oneway-arrow layers baked into the various basemap styles.
 * These render arrows from vector tiles (versatiles-shortbread / openmaptiles
 * `transportation` / `streets` source layers) without our pair-detection or
 * boundary-clipping. We hide them so `OverpassOnewayArrowsLayer` is the single
 * source of truth for oneway arrows.
 */
const BASEMAP_ONEWAY_LAYER_IDS = [
	'oneway-arrows-major',
	'oneway-arrows-minor',
	'oneway-arrows-forward-major',
	'oneway-arrows-reverse-major',
	'oneway-arrows-forward-minor',
	'oneway-arrows-reverse-minor',
	'road_oneway',
	'road_oneway_opposite',
];

/**
 * Registers a `styleimagemissing` handler that lazily creates the
 * oneway / DSC arrow icons whenever a layer references them.
 * Also hides the basemap-baked oneway arrow layers (across all styles)
 * so our `OverpassOnewayArrowsLayer` remains the single source of truth.
 * Idempotent — safe to call multiple times on the same map.
 */
export function registerArrowIconsHandler(map: any): void {
	if (map.__arrowIconsHandlerRegistered) {
		return;
	}

	map.__arrowIconsHandlerRegistered = true;

	const handle = (e: { id: string }) => {
		if (!map.style) return;
		let canvas: HTMLCanvasElement | null = null;
		switch (e.id) {
			case 'oneway-arrow-forward':
				canvas = createOnewayArrowIcon('#000000', false);
				break;
			case 'oneway-arrow-reverse':
				canvas = createOnewayArrowIcon('#000000', true);
				break;
			case 'dsc-arrow-forward':
				canvas = createDscArrowIcon('#0369a1', '#000000');
				break;
			case 'dsc-arrow-reverse':
				canvas = createDscArrowIcon('#000000', '#0369a1');
				break;
		}
		if (!canvas) {
			return;
		}

		if (map.hasImage(e.id)) {
			return;
		}

		const ctx = canvas.getContext('2d');
		const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
		if (imageData) {
			map.addImage(e.id, imageData, { pixelRatio: window.devicePixelRatio || 1 });
		}
	};
	map.on('styleimagemissing', handle);

	const hideBasemapOnewayArrows = () => {
		for (const id of BASEMAP_ONEWAY_LAYER_IDS) {
			if (map.getLayer(id)) {
				map.setLayoutProperty(id, 'visibility', 'none');
			}
		}
	};
	hideBasemapOnewayArrows();
	map.on('styledata', hideBasemapOnewayArrows);

	const PLACE_LAYER_IDS = [
		'place-other',
		'place-island',
		'place-village',
		'place-town',
		'place-city',
		'place-city-capital',
		'place-state',
		'place-country-other',
		'place-country-3',
		'place-country-2',
		'place-country-1',
		'place-continent',
	];

	const movePlaceLabelsToTop = () => {
		for (const id of PLACE_LAYER_IDS) {
			if (map.getLayer(id)) {
				map.moveLayer(id);
			}
		}
	};

	movePlaceLabelsToTop();
	map.on('styledata', movePlaceLabelsToTop);
}

/**
 * Draws a single horizontal arrow pointing right (or left if `reverse`).
 * Style matches the right/left half of `createDscArrowIcon` so DSC and
 * regular oneway arrows look like the same visual family.
 */
export function createOnewayArrowIcon(color: string, reverse = false): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
	const width = 7;
	const height = 7;

	canvas.width = width * dpr;
	canvas.height = height * dpr;

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return canvas;
	}

	ctx.scale(dpr, dpr);

	const midY = height / 2;
	const headLen = 2.5;
	const headHalf = 2.5;
	const lineWidth = 1.2;

	ctx.strokeStyle = color;
	ctx.fillStyle = color;
	ctx.lineWidth = lineWidth;
	ctx.lineCap = 'butt';

	if (reverse) {
		// arrow pointing left
		ctx.beginPath();
		ctx.moveTo(width, midY);
		ctx.lineTo(headLen, midY);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(0, midY);
		ctx.lineTo(headLen, midY - headHalf);
		ctx.lineTo(headLen, midY + headHalf);
		ctx.closePath();
		ctx.fill();
	} else {
		// arrow pointing right
		ctx.beginPath();
		ctx.moveTo(0, midY);
		ctx.lineTo(width - headLen, midY);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(width, midY);
		ctx.lineTo(width - headLen, midY - headHalf);
		ctx.lineTo(width - headLen, midY + headHalf);
		ctx.closePath();
		ctx.fill();
	}

	return canvas;
}

/**
 * Draws a horizontal double-arrow icon split into two colored halves.
 * Used on DSC (double sens cyclable) streets: one half = bike contraflow direction,
 * the other half = car direction.
 *
 * @param leftColor color of the left-pointing arrow (left half)
 * @param rightColor color of the right-pointing arrow (right half)
 */
export function createDscArrowIcon(leftColor: string, rightColor: string): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
	const width = 14;
	const height = 7;

	canvas.width = width * dpr;
	canvas.height = height * dpr;

	const ctx = canvas.getContext('2d');
	if (!ctx) return canvas;
	ctx.scale(dpr, dpr);

	const midY = height / 2;
	const midX = width / 2;
	const headLen = 2.5;
	const headHalf = 2.5;
	const lineWidth = 1.2;

	// left half: arrow pointing left
	ctx.strokeStyle = leftColor;
	ctx.fillStyle = leftColor;
	ctx.lineWidth = lineWidth;
	ctx.lineCap = 'butt';
	ctx.beginPath();
	ctx.moveTo(midX, midY);
	ctx.lineTo(headLen, midY);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(0, midY);
	ctx.lineTo(headLen, midY - headHalf);
	ctx.lineTo(headLen, midY + headHalf);
	ctx.closePath();
	ctx.fill();

	// right half: arrow pointing right
	ctx.strokeStyle = rightColor;
	ctx.fillStyle = rightColor;
	ctx.beginPath();
	ctx.moveTo(midX, midY);
	ctx.lineTo(width - headLen, midY);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(width, midY);
	ctx.lineTo(width - headLen, midY - headHalf);
	ctx.lineTo(width - headLen, midY + headHalf);
	ctx.closePath();
	ctx.fill();

	return canvas;
}

export function createCompositeLineShieldIcon(
	lineNumbers: number[],
	colors: string[],
): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	const iconSize = 64;
	const radius = iconSize / 2 - 4;
	const overlapPercent = 0.3; // 30% overlap
	const spacing = iconSize - iconSize * overlapPercent; // Distance between circle centers

	canvas.width = iconSize + spacing * (lineNumbers.length - 1);
	canvas.height = iconSize;

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return canvas;
	}

	lineNumbers.forEach((lineNumber, index) => {
		const color = colors[index];
		const x = index * spacing + iconSize / 2;
		const centerY = iconSize / 2;

		// circle background
		ctx.fillStyle = color || '#000000';
		ctx.beginPath();
		ctx.arc(x, centerY, radius, 0, 2 * Math.PI);
		ctx.fill();

		// white border
		ctx.strokeStyle = '#ffffff';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(x, centerY, radius, 0, 2 * Math.PI);
		ctx.stroke();

		// line number
		ctx.fillStyle = '#ffffff';
		ctx.font = 'bold 28px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(String(lineNumber), x, centerY + 3);
	});

	return canvas;
}

export function normalizeLineDirection(coordinates: [number, number][]): [number, number][] {
	if (coordinates.length < 2) {
		return coordinates;
	}

	const start = coordinates[0];
	const end = coordinates[coordinates.length - 1];

	if (!start || !end) {
		return coordinates;
	}

	const [startLon, startLat] = start;
	const [endLon, endLat] = end;

	const latDiff = endLat - startLat;
	const lonDiff = endLon - startLon;

	const shouldReverse =
		Math.abs(lonDiff) > 0.0000001
			? lonDiff < 0 // If going west (negative lonDiff), reverse
			: latDiff > 0; // If going north (positive latDiff), reverse

	return shouldReverse ? [...coordinates].reverse() : coordinates;
}

export function getUsedCompositeIcons(features: any[]): Set<string> {
	const sectionGroups = new Map<string, number[]>();

	for (const feature of features) {
		if (
			feature.geometry.type !== 'LineString' ||
			!('id' in feature.properties) ||
			!feature.properties.id
		) {
			continue;
		}

		const sectionId = feature.properties.id;
		if (!sectionGroups.has(sectionId)) {
			sectionGroups.set(sectionId, []);
		}
		sectionGroups.get(sectionId)!.push(feature.properties.line);
	}

	const compositeIcons = new Set<string>();
	for (const lines of sectionGroups.values()) {
		const uniqueLines = [...new Set(lines)].sort((a, b) => a - b);
		if (uniqueLines.length > 1) {
			compositeIcons.add(uniqueLines.join('-'));
		}
	}
	return compositeIcons;
}

export function addCompositeIconNames(features: any[]) {
	const sectionGroups = new Map<string, { line: number; feature: any; index: number }[]>();

	features.forEach((feature, index) => {
		if (
			feature.geometry.type !== 'LineString' ||
			!('id' in feature.properties) ||
			!feature.properties.id
		) {
			return;
		}

		const sectionId = feature.properties.id;
		if (!sectionGroups.has(sectionId)) {
			sectionGroups.set(sectionId, []);
		}
		sectionGroups.get(sectionId)!.push({
			line: feature.properties.line,
			feature,
			index,
		});
	});

	const processedFeatures = features.map((feature) => {
		if (feature.geometry.type === 'LineString') {
			return {
				...feature,
				geometry: {
					...feature.geometry,
					coordinates: normalizeLineDirection(feature.geometry.coordinates as [number, number][]),
				},
			};
		}
		return { ...feature };
	});

	const compositeNamesByIndex = new Map<number, string>();

	sectionGroups.forEach((group) => {
		const uniqueLines = [...new Set(group.map((item) => item.line))].sort((a, b) => a - b);

		if (uniqueLines.length <= 1) {
			return;
		}

		const compositeIconName = `line-shield-${uniqueLines.join('-')}`;

		group.forEach((item) => {
			compositeNamesByIndex.set(item.index, compositeIconName);
		});
	});

	return processedFeatures.map((feature, index) => {
		const compositeIconName = compositeNamesByIndex.get(index);
		if (compositeIconName) {
			return {
				...feature,
				properties: {
					...feature.properties,
					compositeIconName,
				},
			};
		}
		return feature;
	});
}

export function calculateLineDistance(coordinates: [number, number][]): number {
	let distance = 0;
	for (let i = 1; i < coordinates.length; i++) {
		const [lon1, lat1] = coordinates[i - 1];
		const [lon2, lat2] = coordinates[i];
		const dx = (lon2 - lon1) * 111320 * Math.cos((lat1 * Math.PI) / 180);
		const dy = (lat2 - lat1) * 110540;
		distance += Math.sqrt(dx * dx + dy * dy);
	}
	return distance;
}

export const vlColors = [
	'#60A75B', // Line 1
	'#AC4D35', // Line 2
	'#3B7B64', // Line 3
	'#DC8953', // Line 4
	'#AF7392', // Line 5
	'#396083', // Line 6
	'#75BCAE', // Line 7
	'#7E6D98', // Line 8
	'#EAAB50', // Line 9
	'#9A8A4B', // Line 10
	'#4DADC9', // Line 11
	'#DBABB7', // Line 12
];

export function processVoiesLyonnaisesData(voiesLyonnaises: Record<number, any>): {
	grouped: Record<number, any>;
	allFeatures: any[];
} {
	const processed: Record<number, any> = {};
	const allFeatures: any[] = [];

	Object.entries(voiesLyonnaises).forEach(([lineNum, vlData]) => {
		const lineNumber = Number(lineNum);
		if (
			vlData &&
			typeof vlData === 'object' &&
			'features' in vlData &&
			Array.isArray(vlData.features)
		) {
			vlData.features.forEach((feature: any) => {
				if (feature.geometry.type === 'LineString') {
					const distance = calculateLineDistance(feature.geometry.coordinates);
					allFeatures.push({
						...feature,
						properties: {
							...feature.properties,
							distance,
							line: lineNumber,
						},
					});
				}
			});
		}
	});

	const processedFeatures = addCompositeIconNames(allFeatures);

	processedFeatures.forEach((feature: any) => {
		const lineNumber = feature.properties.line;
		if (!processed[lineNumber]) {
			processed[lineNumber] = {
				type: 'FeatureCollection',
				features: [],
			};
		}
		processed[lineNumber].features.push(feature);
	});

	return { grouped: processed, allFeatures: processedFeatures };
}

export async function loadShieldIcons(mapInstance: any, features: any[], totalLines: number = 12) {
	for (let line = 1; line <= totalLines; line++) {
		const color = vlColors[line - 1];
		const canvas = createLineShieldIcon(line, color);
		const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
		if (imageData && !mapInstance.hasImage(`line-shield-${line}`)) {
			mapInstance.addImage(`line-shield-${line}`, imageData);
		}
	}

	const compositeIcons = getUsedCompositeIcons(features);
	compositeIcons.forEach((combo) => {
		const lineNumbers = combo.split('-').map(Number);
		const colors = lineNumbers.map((line) => vlColors[line - 1]);
		const canvas = createCompositeLineShieldIcon(lineNumbers, colors);
		const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
		if (imageData && !mapInstance.hasImage(`line-shield-${combo}`)) {
			mapInstance.addImage(`line-shield-${combo}`, imageData);
		}
	});
}

// TCL "Lignes C" (main bus corridors): C1–C26 plus E variants like C15E, C20E, C22E.
// Excludes interurban C200-series.
const BUS_MAIN_LINE_PATTERN = /^C\d{1,2}E?$/;

export function processBusData(features: any[]) {
	return {
		type: 'FeatureCollection',
		features: features.map((f) => {
			const ligne = f.properties.ligne || '';
			const isTB = ligne.startsWith('TB');
			const isMain = !isTB && BUS_MAIN_LINE_PATTERN.test(ligne);
			const type = isTB ? 'bus-tb' : isMain ? 'bus-main' : 'bus-other';
			const color = isTB ? '#933591' : isMain ? '#E0C233' : '#a3a3a3';

			return {
				...f,
				properties: {
					...f.properties,
					color,
					type,
				},
			};
		}),
	};
}

export function processTransportData(features: any[]) {
	return {
		type: 'FeatureCollection',
		features: features.map((f) => {
			let color = null;
			if (f.properties && f.properties.couleur) {
				const c = f.properties.couleur.split(' ').join(', ');
				color = `rgb(${c})`;
			}
			return {
				...f,
				properties: {
					...f.properties,
					color,
				},
			};
		}),
	};
}
