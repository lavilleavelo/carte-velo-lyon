<script lang="ts">
	import * as Chart from '$lib/components/ui/chart/index.js';
	import { LineChart } from 'layerchart';
	import type { ComponentProps } from 'svelte';

	type Series = { key: string; label: string; color: string };

	interface Props {
		data: Record<string, unknown>[];
		x: string;
		series: Series[];
		yFormat: (value: number) => string;
		xFormat: (value: unknown) => string;
		labelFormat?: (value: unknown) => string;
		annotations?: ComponentProps<typeof LineChart>['annotations'];
		xTicks?: number;
		class?: string;
	}

	let {
		data,
		x,
		series,
		yFormat,
		xFormat,
		labelFormat = xFormat,
		annotations = [],
		xTicks,
		class: className = 'aspect-auto h-[240px] w-full',
	}: Props = $props();

	const config = $derived(
		Object.fromEntries(
			series.map((item) => [item.key, { label: item.label, color: item.color }]),
		) satisfies Chart.ChartConfig,
	);
</script>

<Chart.Container {config} class={className}>
	<LineChart
		{data}
		{x}
		{series}
		{annotations}
		axis={true}
		points={{ r: 4 }}
		legend={series.length > 1}
		padding={{ left: 44, bottom: series.length > 1 ? 48 : 24, top: 12, right: 12 }}
		props={{
			spline: { strokeWidth: 2 },
			xAxis: { format: xFormat, ticks: xTicks },
			yAxis: { format: yFormat },
			highlight: { points: { r: 5 } },
		}}
	>
		{#snippet tooltip()}
			<Chart.Tooltip labelFormatter={(value) => labelFormat(value)}>
				{#snippet formatter({ value, name, item })}
					<div class="flex w-full items-center gap-2">
						<div class="size-2.5 shrink-0 rounded-[2px]" style:background={item.color}></div>
						<div class="flex flex-1 justify-between gap-3 leading-none">
							<span class="text-muted-foreground">{config[name]?.label ?? name}</span>
							<span class="font-mono font-medium text-foreground tabular-nums">
								{typeof value === 'number' ? yFormat(value) : '—'}
							</span>
						</div>
					</div>
				{/snippet}
			</Chart.Tooltip>
		{/snippet}
	</LineChart>
</Chart.Container>
