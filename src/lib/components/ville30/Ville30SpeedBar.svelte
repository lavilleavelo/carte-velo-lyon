<script lang="ts">
	import { SPEED_BUCKET_COLORS } from '$lib/utils/speedLimits';
	import { cn } from '$lib/utils';

	let { pct, class: className }: { pct: number | null; class?: string } = $props();
</script>

<div
	class={cn('flex h-1.5 w-full gap-[2px] overflow-hidden rounded-full bg-gray-200', className)}
	aria-hidden="true"
>
	{#if pct !== null}
		<span
			class="h-full rounded-l-full"
			style="width: {pct}%; background-color: {SPEED_BUCKET_COLORS['30']}"
		></span>
		<span class="h-full flex-1 rounded-r-full" style="background-color: {SPEED_BUCKET_COLORS['50']}"
		></span>
	{/if}
</div>
