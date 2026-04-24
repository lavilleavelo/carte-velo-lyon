<script lang="ts">
	import { GeoJSONSource, LineLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import type { FeatureCollection } from 'geojson';
	import { filterFeaturesInsideBoundary } from '$lib/utils/geoFilter';
	import { speedLimitsQueryOptions } from '$lib/queries/cyclewayQueries';
	import { SPEED_BUCKET_COLORS, type SpeedBucket } from '$lib/utils/speedLimits';

	let {
		isLayerVisible,
		boundary,
		selectedBuckets = [],
		enabledBuckets,
	}: {
		isLayerVisible: (id: string) => boolean;
		boundary?: FeatureCollection;
		selectedBuckets?: SpeedBucket[];
		enabledBuckets?: SpeedBucket[];
	} = $props();

	const enabled = $derived(isLayerVisible('speed-limits'));
	const query = createQuery(() => speedLimitsQueryOptions(enabled));

	const visibility = $derived(enabled ? 'visible' : 'none');

	const sourceData = $derived.by<FeatureCollection>(() => {
		const data = query.data;
		if (!data) return { type: 'FeatureCollection', features: [] };
		if (!boundary) return data;
		return filterFeaturesInsideBoundary(data, boundary);
	});

	const speedNum: any = ['to-number', ['get', 'limitationvitesse'], 999];

	const isBucket5: any = ['<=', speedNum, 5];
	const isBucket30: any = ['all', ['>', speedNum, 5], ['<=', speedNum, 30]];
	const isBucket50: any = ['==', speedNum, 50];
	const isBucket70: any = ['>=', speedNum, 70];
	const isBucketUnknown: any = [
		'any',
		['!', ['has', 'limitationvitesse']],
		['==', ['get', 'limitationvitesse'], null],
		['==', ['get', 'limitationvitesse'], ''],
		['==', speedNum, 999],
	];

	const lineColor: any = [
		'case',
		isBucket5,
		SPEED_BUCKET_COLORS['5'],
		isBucket30,
		SPEED_BUCKET_COLORS['30'],
		isBucket50,
		SPEED_BUCKET_COLORS['50'],
		isBucket70,
		SPEED_BUCKET_COLORS['70'],
		SPEED_BUCKET_COLORS.unknown,
	];

	function bucketsToExpr(buckets: SpeedBucket[]): any {
		const parts: any[] = [];
		if (buckets.includes('5')) parts.push(isBucket5);
		if (buckets.includes('30')) parts.push(isBucket30);
		if (buckets.includes('50')) parts.push(isBucket50);
		if (buckets.includes('70')) parts.push(isBucket70);
		if (buckets.includes('unknown')) parts.push(isBucketUnknown);
		if (parts.length === 0) return false;
		if (parts.length === 1) return parts[0];
		return ['any', ...parts];
	}

	const selectedExpr = $derived(
		selectedBuckets.length === 0 ? true : bucketsToExpr(selectedBuckets),
	);

	const lineWidth: any = $derived(selectedBuckets.length > 0 ? ['case', selectedExpr, 4, 2] : 2);
	const lineOpacity: any = $derived(
		selectedBuckets.length > 0 ? ['case', selectedExpr, 1, 0.15] : 0.8,
	);

	const layerFilter = $derived(
		enabledBuckets === undefined ? undefined : bucketsToExpr(enabledBuckets),
	);
</script>

<GeoJSONSource id="speed-limits-source" maxzoom={14} data={sourceData}>
	<LineLayer
		id="speed-limits-lines"
		filter={layerFilter}
		layout={{ 'line-cap': 'round', 'line-join': 'round', visibility }}
		paint={{
			'line-color': lineColor,
			'line-width': lineWidth,
			'line-opacity': lineOpacity,
		}}
	/>
</GeoJSONSource>
