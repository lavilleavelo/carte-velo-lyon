export function createLineShieldIcon(lineNumber: number, color: string): HTMLCanvasElement {
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

	// line number
	ctx.fillStyle = '#ffffff';
	ctx.font = 'bold 28px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(String(lineNumber), centerX, centerY + 3);

	return canvas;
}

export function createCompositeLineShieldIcon(
	lineNumbers: number[],
	colors: string[]
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

export function generateCompositeIconCombinations(totalLines: number): Set<string> {
	const compositeIcons = new Set<string>();

	// Generate 2-line combinations
	for (let i = 1; i <= totalLines; i++) {
		for (let j = i + 1; j <= totalLines; j++) {
			compositeIcons.add(`${i}-${j}`);
		}
	}

	// Generate 3-line combinations
	for (let i = 1; i <= totalLines; i++) {
		for (let j = i + 1; j <= totalLines; j++) {
			for (let k = j + 1; k <= totalLines; k++) {
				compositeIcons.add(`${i}-${j}-${k}`);
			}
		}
	}

	// Generate 4-line combinations
	for (let i = 1; i <= totalLines; i++) {
		for (let j = i + 1; j <= totalLines; j++) {
			for (let k = j + 1; k <= totalLines; k++) {
				for (let l = k + 1; l <= totalLines; l++) {
					compositeIcons.add(`${i}-${j}-${k}-${l}`);
				}
			}
		}
	}

	return compositeIcons;
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
			index
		});
	});

	const processedFeatures = features.map((feature) => {
		if (feature.geometry.type === 'LineString') {
			return {
				...feature,
				geometry: {
					...feature.geometry,
					coordinates: normalizeLineDirection(feature.geometry.coordinates as [number, number][])
				}
			};
		}
		return { ...feature };
	});

	sectionGroups.forEach((group) => {
		group.sort((a, b) => a.line - b.line);

		const lineNumbers = group.map((item) => item.line).sort((a, b) => a - b);
		const compositeIconName = `line-shield-${lineNumbers.join('-')}`;

		group.forEach((item) => {
			const feature = item.feature;
			if (feature.geometry.type === 'LineString') {
				const currentFeature = processedFeatures[item.index];
				if (currentFeature && 'properties' in currentFeature) {
					processedFeatures[item.index] = {
						...currentFeature,
						properties: { ...currentFeature.properties, compositeIconName }
					};
				}
			}
		});
	});

	return processedFeatures;
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
	'#DBABB7' // Line 12
];

/**
 * Process Voies Lyonnaises data to add distances and composite icon names for shared sections
 */
export function processVoiesLyonnaisesData(
	voiesLyonnaises: Record<number, any>
): Record<number, any> {
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
							line: lineNumber
						}
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
				features: []
			};
		}
		processed[lineNumber].features.push(feature);
	});

	return processed;
}

/**
 * Load all shield icons (individual and composite) into the map
 */
export async function loadShieldIcons(mapInstance: any, totalLines: number = 12) {
	// Load individual line shield icons
	for (let line = 1; line <= totalLines; line++) {
		const color = vlColors[line - 1];
		const canvas = createLineShieldIcon(line, color);
		const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
		if (imageData && !mapInstance.hasImage(`line-shield-${line}`)) {
			mapInstance.addImage(`line-shield-${line}`, imageData);
		}
	}

	// Load composite icons for shared sections
	const compositeIcons = generateCompositeIconCombinations(totalLines);
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
