<script lang="ts">
	import * as Chart from '$lib/components/ui/chart/index.js';
	import { AreaChart, BarChart, type ChartContextValue } from 'layerchart';
	import { cubicInOut } from 'svelte/easing';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { MediaQuery } from 'svelte/reactivity';
	import type { CommuneInfraChart } from '$lib/server/communeStats';
	import {
		typeColors,
		parkingTypeColors,
		createTypeChartConfig,
		createParkingTypeChartConfig,
		createTypeSeries,
		createParkingTypeSeries,
		computeStackLabelPositions,
	} from './infrastructure-chart-utils';

	interface Props {
		communeName: string;
		chart: CommuneInfraChart;
		totalBikeLanesKm: number;
		totalParkingPlaces: number;
	}

	let { communeName, chart, totalBikeLanesKm, totalParkingPlaces }: Props = $props();

	let includeUnknownBikeLanes = $state(false);

	const facilityTypes = $derived(chart.facilityTypes);
	const parkingTypes = $derived(chart.parkingTypes);
	const parkingWithoutYear = $derived(chart.parkingWithoutYear);
	const bikeLanesWithoutYear = $derived(chart.bikeLanesWithoutYear);

	const chartData = $derived(
		includeUnknownBikeLanes ? chart.chartDataIncludingUnknowns : chart.chartDataExcludingUnknowns,
	);

	const chartConfig = {
		bikeLanesKm: { label: 'Aménagements cyclables\xa0(km)', color: 'var(--chart-1)' },
		parkingPlaces: { label: 'Places de stationnement', color: 'var(--chart-2)' },
	} satisfies Chart.ChartConfig;

	let context = $state<ChartContextValue>();
	let activeChart = $state<'bikeLanesKm' | 'parkingPlaces'>('bikeLanesKm');
	let showCumulative = $state(true);
	let showByType = $state(false);
	let showLabels = $state(false);

	const typeChartConfig = $derived(createTypeChartConfig(facilityTypes));
	const parkingTypeChartConfig = $derived(createParkingTypeChartConfig(parkingTypes));
	const typeSeries = $derived(createTypeSeries(facilityTypes, showCumulative));
	const parkingTypeSeries = $derived(createParkingTypeSeries(parkingTypes, showCumulative));

	const total = $derived({
		bikeLanesKm: Math.round(totalBikeLanesKm * 100) / 100,
		parkingPlaces: totalParkingPlaces,
	});

	const activeSeriesKey = $derived(
		showCumulative
			? activeChart === 'bikeLanesKm'
				? 'cumulativeBikeLanesKm'
				: 'cumulativeParkingPlaces'
			: activeChart,
	);

	const activeSeries = $derived([
		{
			key: activeSeriesKey,
			label: chartConfig[activeChart].label,
			color: chartConfig[activeChart].color,
		},
	]);

	const hasData = $derived(
		chartData.length > 0 && (total.bikeLanesKm > 0 || total.parkingPlaces > 0),
	);

	const isMobile = new MediaQuery('(max-width: 1000px)');

	const sharedAreaProps = $derived({
		area: {
			'fill-opacity': 0.6,
			line: { class: 'stroke-1' },
			motion: { type: 'tween' as const, duration: 500, easing: cubicInOut },
		},
		highlight: { area: { fill: 'none' } },
		xAxis: {
			format: (d: number) => String(d),
			ticks: isMobile.current ? 4 : 10,
		},
		yAxis: {
			format: (d: number) => `${d.toLocaleString('fr-FR')}\xa0km`,
		},
	});

	const sharedBarProps = $derived({
		bars: {
			stroke: 'none',
			rounded: 'none' as const,
			initialY: context?.height,
			initialHeight: 0,
			motion: {
				y: { type: 'tween' as const, duration: 500, easing: cubicInOut },
				height: { type: 'tween' as const, duration: 500, easing: cubicInOut },
			},
		},
		highlight: { area: { fill: 'none' } },
		xAxis: {
			format: (d: number) => String(d),
			ticks: isMobile.current ? 4 : undefined,
		},
		yAxis: {
			format: (d: number) => `${d.toLocaleString('fr-FR')}\xa0km`,
		},
	});

	const sharedParkingAreaProps = $derived({
		area: {
			'fill-opacity': 0.6,
			line: { class: 'stroke-1' },
			motion: { type: 'tween' as const, duration: 500, easing: cubicInOut },
		},
		highlight: { area: { fill: 'none' } },
		xAxis: {
			format: (d: number) => String(d),
			ticks: isMobile.current ? 4 : 10,
		},
		yAxis: {
			format: (d: number) => d.toLocaleString('fr-FR'),
		},
	});

	const sharedParkingBarProps = $derived({
		bars: {
			stroke: 'none',
			rounded: 'none' as const,
			initialY: context?.height,
			initialHeight: 0,
			motion: {
				y: { type: 'tween' as const, duration: 500, easing: cubicInOut },
				height: { type: 'tween' as const, duration: 500, easing: cubicInOut },
			},
		},
		highlight: { area: { fill: 'none' } },
		xAxis: {
			format: (d: number) => String(d),
			ticks: isMobile.current ? 4 : undefined,
		},
		yAxis: {
			format: (d: number) => d.toLocaleString('fr-FR'),
		},
	});

	const singleSeriesAreaProps = $derived({
		area: {
			fill: chartConfig[activeChart].color,
			opacity: 0.3,
			motion: { type: 'tween' as const, duration: 500, easing: cubicInOut },
		},
		line: {
			stroke: chartConfig[activeChart].color,
			strokeWidth: 2,
		},
		highlight: { area: { fill: 'none' } },
		xAxis: {
			format: (d: number) => String(d),
			ticks: isMobile.current ? 4 : 10,
		},
		yAxis: {
			format: (d: number) =>
				activeChart === 'bikeLanesKm'
					? `${d.toLocaleString('fr-FR')}\xa0km`
					: d.toLocaleString('fr-FR'),
		},
	});

	const singleSeriesBarProps = $derived({
		bars: {
			stroke: 'none',
			rounded: 'top' as const,
			initialY: context?.height,
			initialHeight: 0,
			motion: {
				y: { type: 'tween' as const, duration: 500, easing: cubicInOut },
				height: { type: 'tween' as const, duration: 500, easing: cubicInOut },
			},
		},
		highlight: { area: { fill: 'none' } },
		xAxis: {
			format: (d: number) => d.toFixed(0),
			ticks: isMobile.current ? 4 : undefined,
		},
		yAxis: {
			format: (d: number) =>
				activeChart === 'bikeLanesKm'
					? `${d.toLocaleString('fr-FR')}\xa0km`
					: d.toLocaleString('fr-FR'),
		},
	});

	const currentSeries = $derived(activeChart === 'bikeLanesKm' ? typeSeries : parkingTypeSeries);
	const stackLabelPositions = $derived(
		showByType && showLabels && showCumulative
			? computeStackLabelPositions(context, chartData, currentSeries)
			: [],
	);

	const chartPadding = $derived({
		left: 30,
		bottom: 20,
		right: showByType && showLabels && showCumulative && !isMobile.current ? 100 : 10,
		top: 10,
	});
</script>

{#snippet stackLabels()}
	{#each stackLabelPositions as lbl}
		{#if lbl.visible}
			<text
				x={lbl.x + 6}
				y={lbl.y}
				dominant-baseline="central"
				class="pointer-events-none fill-current text-[10px] font-medium select-none"
				style="fill: color-mix(in oklch, {lbl.color} 80%, black)"
				textLength={lbl.label.length > 15 ? '90' : undefined}
				lengthAdjust={lbl.label.length > 15 ? 'spacingAndGlyphs' : undefined}>{lbl.label}</text
			>
		{/if}
	{/each}
{/snippet}

<section class="overflow-hidden rounded-lg bg-white shadow">
	<div class="flex flex-col items-stretch space-y-0 border-b p-0 lg:flex-row">
		<div class="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
			<h2 class="text-lg font-bold text-brand-navy sm:text-xl">
				Évolution des infrastructures cyclables – {communeName}
			</h2>
			<p class="text-sm text-gray-500">
				{showCumulative ? 'Total cumulé' : 'Nouvelles infrastructures'} par année de livraison
			</p>
			<div class="mt-2 flex flex-wrap items-center gap-4">
				<div class="flex items-center gap-2">
					<Checkbox
						id="cumulative-toggle"
						checked={showCumulative}
						onCheckedChange={(checked) => (showCumulative = checked === true)}
					/>
					<Label for="cumulative-toggle" class="cursor-pointer text-sm">Afficher le cumul</Label>
				</div>
				<div class="flex items-center gap-2">
					<Checkbox
						id="by-type-toggle"
						checked={showByType}
						onCheckedChange={(checked) => (showByType = checked === true)}
					/>
					<Label for="by-type-toggle" class="cursor-pointer text-sm">Par type</Label>
				</div>
			</div>
		</div>
		<div class="flex">
			<button
				data-active={activeChart === 'bikeLanesKm'}
				class="relative flex flex-1 cursor-pointer flex-col justify-center gap-1 border-t px-6 py-4 text-start even:border-s data-[active=true]:bg-gray-100 sm:border-s sm:border-t-0 sm:px-8 sm:py-6"
				onclick={() => (activeChart = 'bikeLanesKm')}
			>
				<span class="text-xs text-gray-500">
					{chartConfig.bikeLanesKm.label}
				</span>
				<span class="text-lg leading-none font-bold sm:text-3xl">
					{total.bikeLanesKm.toLocaleString('fr-FR')}&nbsp;km
				</span>
			</button>
			<button
				data-active={activeChart === 'parkingPlaces'}
				class="relative flex flex-1 cursor-pointer flex-col justify-center gap-1 border-t px-6 py-4 text-start even:border-s data-[active=true]:bg-gray-100 sm:border-s sm:border-t-0 sm:px-8 sm:py-6"
				onclick={() => (activeChart = 'parkingPlaces')}
			>
				<span class="text-xs text-gray-500">
					{chartConfig.parkingPlaces.label}
				</span>
				<span class="text-lg leading-none font-bold sm:text-3xl">
					{total.parkingPlaces.toLocaleString('fr-FR')}
				</span>
			</button>
		</div>
	</div>
	<div class="px-6 pt-5 pb-6 sm:p-6">
		{#if !hasData}
			<div class="flex h-[250px] items-center justify-center">
				<span class="text-sm text-gray-500">
					Aucune donnée d'infrastructure disponible pour cette commune.
				</span>
			</div>
		{:else}
			<Chart.Container
				config={showByType
					? activeChart === 'bikeLanesKm'
						? typeChartConfig
						: parkingTypeChartConfig
					: chartConfig}
				class="aspect-auto h-[250px] w-full"
			>
				{#if showByType && activeChart === 'bikeLanesKm' && showCumulative}
					<AreaChart
						bind:context
						data={chartData}
						x="year"
						axis={true}
						series={typeSeries}
						seriesLayout="stack"
						padding={chartPadding}
						props={sharedAreaProps}
					>
						{#snippet aboveMarks()}
							{@render stackLabels()}
						{/snippet}
						{#snippet tooltip()}
							<Chart.Tooltip indicator="dot" labelFormatter={(v) => `Année ${v}`} />
						{/snippet}
					</AreaChart>
				{:else if showByType && activeChart === 'bikeLanesKm' && !showCumulative}
					<BarChart
						bind:context
						data={chartData}
						x="year"
						axis={true}
						series={typeSeries}
						seriesLayout="stack"
						padding={chartPadding}
						props={sharedBarProps}
					>
						{#snippet tooltip()}
							<Chart.Tooltip indicator="dot" labelFormatter={(v) => `Année ${v}`} />
						{/snippet}
					</BarChart>
				{:else if showByType && activeChart === 'parkingPlaces' && showCumulative}
					<AreaChart
						bind:context
						data={chartData}
						x="year"
						axis={true}
						series={parkingTypeSeries}
						seriesLayout="stack"
						padding={chartPadding}
						props={sharedParkingAreaProps}
					>
						{#snippet aboveMarks()}
							{@render stackLabels()}
						{/snippet}
						{#snippet tooltip()}
							<Chart.Tooltip indicator="dot" labelFormatter={(v) => `Année ${v} (total cumulé)`}>
								{#snippet formatter({ value, name, item })}
									{@const typeName = name.replace('cumulative_parking_', '')}
									{@const dataPoint = item.payload}
									{@const countKey = `cumulative_parking_count_${typeName}`}
									{@const equipmentCount = dataPoint?.[countKey] || 0}
									{@const itemConfig = parkingTypeChartConfig[name]}
									<div class="flex w-full flex-wrap items-center gap-2">
										<div
											style="--color-bg: {itemConfig?.color}; --color-border: {itemConfig?.color};"
											class="size-2.5 shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)"
										></div>
										<div class="flex flex-1 justify-between gap-3 leading-none">
											<span class="text-muted-foreground">{itemConfig?.label || typeName}</span>
											<span class="font-mono font-medium text-foreground tabular-nums">
												{equipmentCount.toLocaleString('fr-FR')} éq. = {typeof value === 'number'
													? value.toLocaleString('fr-FR')
													: value} pl.
											</span>
										</div>
									</div>
								{/snippet}
							</Chart.Tooltip>
						{/snippet}
					</AreaChart>
				{:else if showByType && activeChart === 'parkingPlaces' && !showCumulative}
					<BarChart
						bind:context
						data={chartData}
						x="year"
						axis={true}
						series={parkingTypeSeries}
						seriesLayout="stack"
						padding={chartPadding}
						props={sharedParkingBarProps}
					>
						{#snippet tooltip()}
							<Chart.Tooltip indicator="dot" labelFormatter={(v) => `Année ${v}`}>
								{#snippet formatter({ value, name, item })}
									{@const typeName = name.replace('parking_', '')}
									{@const dataPoint = item.payload}
									{@const countKey = `parking_count_${typeName}`}
									{@const equipmentCount = dataPoint?.[countKey] || 0}
									{@const itemConfig = parkingTypeChartConfig[name]}
									<div class="flex w-full flex-wrap items-center gap-2">
										<div
											style="--color-bg: {itemConfig?.color}; --color-border: {itemConfig?.color};"
											class="size-2.5 shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)"
										></div>
										<div class="flex flex-1 justify-between gap-3 leading-none">
											<span class="text-muted-foreground">{itemConfig?.label || typeName}</span>
											<span class="font-mono font-medium text-foreground tabular-nums">
												{equipmentCount.toLocaleString('fr-FR')} éq. = {typeof value === 'number'
													? value.toLocaleString('fr-FR')
													: value} pl.
											</span>
										</div>
									</div>
								{/snippet}
							</Chart.Tooltip>
						{/snippet}
					</BarChart>
				{:else if showCumulative}
					<AreaChart
						bind:context
						data={chartData}
						x="year"
						axis={true}
						labels={isMobile.current
							? undefined
							: { offset: 6, format: (v) => v.toLocaleString('fr-FR') }}
						series={activeSeries}
						padding={chartPadding}
						props={singleSeriesAreaProps}
					>
						{#snippet tooltip()}
							<Chart.Tooltip
								labelFormatter={(v) =>
									showCumulative ? `Année ${v} (total cumulé)` : `Année ${v}`}
							/>
						{/snippet}
					</AreaChart>
				{:else}
					<BarChart
						bind:context
						data={chartData}
						x="year"
						axis={true}
						labels={isMobile.current ? undefined : { offset: 6 }}
						series={activeSeries}
						padding={chartPadding}
						props={singleSeriesBarProps}
					>
						{#snippet tooltip()}
							<Chart.Tooltip labelFormatter={(v) => `Année ${v}`} />
						{/snippet}
					</BarChart>
				{/if}
			</Chart.Container>
		{/if}
		{#if showByType && hasData}
			<div class="mt-6 flex flex-wrap items-center gap-3 text-xs">
				{#if activeChart === 'bikeLanesKm'}
					{#each facilityTypes as type}
						<div class="flex items-center gap-1">
							<span
								class="inline-block h-3 w-3 rounded-sm"
								style="background-color: {typeColors[type] || '#6b7280'}"
							></span>
							<span>{type}</span>
						</div>
					{/each}
				{:else}
					{#each parkingTypes as type}
						<div class="flex items-center gap-1">
							<span
								class="inline-block h-3 w-3 rounded-sm"
								style="background-color: {parkingTypeColors[type] || '#6b7280'}"
							></span>
							<span>{type}</span>
						</div>
					{/each}
				{/if}
			</div>
		{/if}
		{#if hasData && activeChart === 'parkingPlaces' && parkingWithoutYear.capacity > 0}
			<p class="mt-6 text-xs text-gray-500">
				Note&nbsp;: {parkingWithoutYear.capacity.toLocaleString('fr-FR')} places de stationnement sans
				année de réalisation ne sont pas affichées.
			</p>
		{/if}
		{#if hasData && activeChart === 'bikeLanesKm' && bikeLanesWithoutYear.length > 0}
			<div class="mt-6 flex flex-wrap items-center gap-2">
				<Checkbox
					id="unknown-toggle-bottom"
					class="size-3.5 border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
					checked={includeUnknownBikeLanes}
					onCheckedChange={(checked) => (includeUnknownBikeLanes = checked === true)}
				/>
				<Label for="unknown-toggle-bottom" class="cursor-pointer text-xs font-normal text-gray-500">
					Inclure les {(Math.round(bikeLanesWithoutYear.length / 10) / 100).toLocaleString(
						'fr-FR',
					)}&nbsp;km d'aménagements sans année de réalisation
				</Label>
			</div>
		{/if}
		{#if hasData && showByType && showCumulative && !isMobile.current}
			<div class="mt-4 flex items-center gap-1.5">
				<Checkbox
					id="labels-toggle-commune"
					class="size-3.5 border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
					checked={showLabels}
					onCheckedChange={(checked) => (showLabels = checked === true)}
				/>
				<Label for="labels-toggle-commune" class="cursor-pointer text-xs font-normal text-gray-500"
					>Afficher le nom des séries sur le graphique</Label
				>
			</div>
		{/if}
		<p class="mt-6 border-t border-gray-100 pt-3 text-xs text-gray-500">
			Source&nbsp;:&nbsp;<a
				href="https://data.grandlyon.com/portail/fr/jeux-de-donnees/amenagements-cyclables-metropole-lyon/donnees"
				target="_blank"
				rel="noopener"
				class="underline hover:text-brand-navy">data.grandlyon.com</a
			>. Les longueurs peuvent légèrement différer des données OpenStreetMap affichées sur la carte.
		</p>
	</div>
</section>
