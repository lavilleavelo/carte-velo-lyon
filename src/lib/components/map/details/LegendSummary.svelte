<script lang="ts">
	import Info from '@lucide/svelte/icons/info';
	import { LEGEND_SUMMARIES, legendPageHref, type LegendId } from '$lib/utils/cyclewayLegend';

	let { legendId }: { legendId: LegendId | null } = $props();
</script>

{#if legendId}
	<div class="flex items-start gap-2 rounded-md bg-gray-50 px-2 py-1.5 text-xs text-gray-600">
		<Info size={14} class="mt-0.5 shrink-0 text-gray-400" />
		<p class="leading-snug">
			{LEGEND_SUMMARIES[legendId]}
			<a
				href={legendPageHref(legendId)}
				onclick={(e) => e.stopPropagation()}
				class="font-medium whitespace-nowrap text-brand-navy underline hover:no-underline"
				>En savoir plus</a
			>
		</p>
	</div>
{/if}
