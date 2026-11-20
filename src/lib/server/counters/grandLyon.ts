import { BIKE_PRACTICE, SCOOTER_PRACTICE, type EcoCounter } from './ecoCounter';
import { fetchJson, type FetchOptions } from './http';

const RDATA_URL = 'https://data.grandlyon.com/fr/datapusher/ws/rdata/pvo_patrimoine_voirie';
const MEASURES_URL =
	'https://download.data.grandlyon.com/ws/timeseries/pvo_patrimoine_voirie.pvocomptagemeasure/all.json';

const PRACTICES = new Map([
	['BIKE', BIKE_PRACTICE],
	['E-SCOOTER', SCOOTER_PRACTICE],
]);

export type GrandLyonCounter = Omit<EcoCounter, 'photos'> & { firstDay: string | null };

export type GrandLyonMeasure = {
	channelId: number;
	day: string;
	hour: number;
	count: number | null;
};

type Rows<T> = { values: T[] };

type SiteItem = { site_name: string; lat: number | null; lon: number | null };

type ChannelItem = { channel_id: string; mobility_type: string; started_at: string | null };

type MeasureItem = { channel_id: string; start_datetime: string; count: number | null };

function fetchSiteRows<T>(layer: string, siteId: number): Promise<Rows<T>> {
	const params = new URLSearchParams({
		maxfeatures: '-1',
		start: '1',
		field: 'site_id',
		value: String(siteId),
	});
	return fetchJson<Rows<T>>(`${RDATA_URL}.${layer}/all.json?${params}`);
}

export async function fetchGrandLyonCounter(siteId: number): Promise<GrandLyonCounter | null> {
	const [sites, channels] = await Promise.all([
		fetchSiteRows<SiteItem>('pvocomptagesite', siteId),
		fetchSiteRows<ChannelItem>('pvocomptagechannel', siteId),
	]);
	const site = sites.values[0];
	const counted = channels.values.flatMap((channel) => {
		const practice = PRACTICES.get(channel.mobility_type);
		return practice === undefined ? [] : [{ ...channel, practice }];
	});
	if (!site || counted.length === 0) {
		return null;
	}

	const flows = counted.map((channel) => ({
		id: Number(channel.channel_id),
		practice: channel.practice,
	}));
	return {
		idPdc: siteId,
		name: site.site_name,
		flowIds: flows.map((flow) => flow.id).join(';'),
		flows,
		lat: site.lat ?? null,
		lon: site.lon ?? null,
		firstDay:
			counted
				.flatMap((channel) => (channel.started_at ? [channel.started_at.slice(0, 10)] : []))
				.sort()[0] ?? null,
	};
}

export async function fetchGrandLyonMeasures(
	channelIds: number[],
	from: string,
	to: string,
	options?: FetchOptions,
): Promise<GrandLyonMeasure[]> {
	const params = new URLSearchParams({
		maxfeatures: '-1',
		start: '1',
		channel_id__in: channelIds.join(','),
		start_datetime__gte: from,
		start_datetime__lt: to,
	});
	const { values } = await fetchJson<Rows<MeasureItem>>(`${MEASURES_URL}?${params}`, options);
	return values
		.toSorted((a, b) => a.start_datetime.localeCompare(b.start_datetime))
		.map((item) => ({
			channelId: Number(item.channel_id),
			day: item.start_datetime.slice(0, 10),
			hour: Number(item.start_datetime.slice(11, 13)),
			count: item.count,
		}));
}

export function groupHours(measures: GrandLyonMeasure[]): Map<string, (number | null)[]> {
	const days = new Map<string, (number | null)[]>();
	for (const { day, hour, count } of measures) {
		const hours = days.get(day) ?? Array<number | null>(24).fill(null);
		if (count !== null) {
			hours[hour] = (hours[hour] ?? 0) + count;
		}
		days.set(day, hours);
	}
	return days;
}
