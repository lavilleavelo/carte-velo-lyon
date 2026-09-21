<script lang="ts">
	import { RawLayer } from 'svelte-maplibre-gl';
	import { createQuery } from '@tanstack/svelte-query';
	import { osmCyclewaysQueryOptions } from '$lib/queries/cyclewayQueries';
	import { LABEL_CATEGORIES, labelLayers, type LabelCategory } from './labelLayers';
	import { DSC_OFFSET_LABEL_LAYER_IDS, dscLabelOffset, dscStreetNames } from './dscStreetLabels';

	let {
		show,
		beforeId,
		offsetDscStreets = false,
	}: {
		show?: Partial<Record<LabelCategory, boolean>>;
		beforeId?: string;
		offsetDscStreets?: boolean;
	} = $props();

	const osmCyclewaysQuery = createQuery(() => osmCyclewaysQueryOptions(offsetDscStreets));

	const roadNameOffset = $derived(
		dscLabelOffset(offsetDscStreets ? dscStreetNames(osmCyclewaysQuery.data) : []),
	);

	const visibleLayers = $derived(
		LABEL_CATEGORIES.filter((cat) => show?.[cat] !== false)
			.flatMap((cat) => labelLayers[cat])
			.map((spec) =>
				spec.type === 'symbol' && DSC_OFFSET_LABEL_LAYER_IDS.has(spec.id)
					? { ...spec, layout: { ...spec.layout, 'text-offset': roadNameOffset } }
					: spec,
			),
	);
</script>

{#each visibleLayers as spec (spec.id)}
	<RawLayer {...spec} {beforeId} />
{/each}
