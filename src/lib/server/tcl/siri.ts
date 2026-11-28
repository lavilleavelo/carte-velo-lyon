type Json = Record<string, unknown>;

function object(value: unknown): Json {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
}

function list(value: unknown): unknown[] {
	if (Array.isArray(value)) {
		return value;
	}
	return value === undefined || value === null ? [] : [value];
}

function text(value: unknown): string | null {
	if (typeof value === 'string') {
		return value;
	}
	const inner = object(value).value;
	return typeof inner === 'string' ? inner : null;
}

function serviceDelivery(data: unknown): Json {
	return object(object(object(data).Siri).ServiceDelivery);
}

export function responseTimestamp(data: unknown): string | null {
	return text(serviceDelivery(data).ResponseTimestamp);
}

export function vehicleActivities(data: unknown): Json[] {
	return list(serviceDelivery(data).VehicleMonitoringDelivery)
		.flatMap((delivery) => list(object(delivery).VehicleActivity))
		.map(object);
}

export function estimatedJourneys(data: unknown): Json[] {
	return list(serviceDelivery(data).EstimatedTimetableDelivery)
		.flatMap((delivery) => list(object(delivery).EstimatedJourneyVersionFrame))
		.flatMap((frame) => list(object(frame).EstimatedVehicleJourney))
		.map(object);
}

export function situations(data: unknown): Json[] {
	return list(serviceDelivery(data).SituationExchangeDelivery)
		.flatMap((delivery) => list(object(object(delivery).Situations).PtSituationElement))
		.map(object);
}

export function lineCode(item: Json): string | null {
	const ref = text(object(item.MonitoredVehicleJourney ?? item).LineRef);
	return ref ? (ref.match(/::([^:]+):/)?.[1] ?? ref).toUpperCase() : null;
}

export function lineRef(code: string): string {
	return `ActIV:Line::${code}:SYTRAL`;
}

export function vehicleKey(activity: Json): string | null {
	return (
		text(activity.VehicleMonitoringRef) ??
		text(object(activity.MonitoredVehicleJourney).VehicleRef) ??
		null
	);
}

export function journeyKey(journey: Json): string | null {
	return text(object(journey.FramedVehicleJourneyRef).DatedVehicleJourneyRef);
}

export function recordedAt(item: Json): string | null {
	return text(item.RecordedAtTime);
}

export function directionOf(item: Json): string {
	return text(item.DirectionRef) ?? '';
}

export function stopIdOf(call: Json): number | null {
	const match = text(call.StopPointRef)?.match(/SP:(\d+):/);
	return match ? Number(match[1]) : null;
}

export function estimatedCalls(journey: Json): Json[] {
	return list(object(journey.EstimatedCalls).EstimatedCall).map(object);
}

export function parseDuration(value: unknown): number | null {
	if (typeof value !== 'string') {
		return null;
	}
	const match = value.match(/^(-)?P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
	if (!match) {
		return null;
	}
	const [, sign, days, hours, minutes, seconds] = match;
	const total =
		Number(days ?? 0) * 86400 +
		Number(hours ?? 0) * 3600 +
		Number(minutes ?? 0) * 60 +
		Number(seconds ?? 0);
	return sign ? -total : total;
}
