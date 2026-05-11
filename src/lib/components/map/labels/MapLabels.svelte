<script lang="ts">
	import { RawLayer } from 'svelte-maplibre-gl';
	import { LABEL_CATEGORIES, labelLayers, type LabelCategory } from './labelLayers';

	let {
		show,
		beforeId,
	}: {
		show?: Partial<Record<LabelCategory, boolean>>;
		beforeId?: string;
	} = $props();

	const visibleLayers = $derived(
		LABEL_CATEGORIES.filter((cat) => show?.[cat] !== false).flatMap((cat) => labelLayers[cat]),
	);
</script>

{#each visibleLayers as spec (spec.id)}
	<RawLayer {...spec} {beforeId} />
{/each}
