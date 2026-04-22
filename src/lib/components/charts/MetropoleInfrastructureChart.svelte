<script lang="ts">
	import * as Chart from '$lib/components/ui/chart/index.js';
	import { AreaChart, BarChart, type ChartContextValue } from 'layerchart';
	import { MediaQuery } from 'svelte/reactivity';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		typeColors,
		parkingTypeColors,
		baseChartConfig,
		createTypeChartConfig,
		createParkingTypeChartConfig,
		createTypeSeries,
		createParkingTypeSeries,
		createSharedAreaProps,
		createSharedBarProps,
		createSingleSeries,
		computeBikeLanesEvolution,
		computeParkingEvolution,
		computeParkingWithoutYear,
		computeBikeLanesWithoutYear,
		extractFacilityTypes,
		extractParkingTypes,
		buildChartData,
		computeStackLabelPositions,
	} from './infrastructure-chart-utils';

	const voirieQuery = createQuery(() => ({
		queryKey: ['voirie-data'],
		queryFn: async () => {
			const response = await fetch('/api/grandlyon/voirie');
			if (!response.ok) throw new Error('Failed to fetch voirie data');
			return response.json();
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
	}));

	const parkingQuery = createQuery(() => ({
		queryKey: ['parking'],
		queryFn: async () => {
			const response = await fetch('/api/grandlyon/parking');
			if (!response.ok) throw new Error('Failed to fetch parking data');
			return response.json();
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
	}));

	const voirieFeatures = $derived(voirieQuery.data?.features ?? []);
	const parkingFeatures = $derived(parkingQuery.data?.features ?? []);

	let includeUnknownBikeLanes = $state(false);

	const bikeLanesEvolution = $derived.by(() =>
		computeBikeLanesEvolution(voirieFeatures, includeUnknownBikeLanes),
	);

	const parkingEvolution = $derived.by(() => computeParkingEvolution(parkingFeatures));

	const parkingWithoutYear = $derived.by(() => computeParkingWithoutYear(parkingFeatures));

	const bikeLanesWithoutYear = $derived.by(() => computeBikeLanesWithoutYear(voirieFeatures));

	const facilityTypes = $derived.by(() => extractFacilityTypes(voirieFeatures));

	const parkingTypes = $derived.by(() => extractParkingTypes(parkingFeatures));

	const chartData = $derived.by(() =>
		buildChartData(bikeLanesEvolution, parkingEvolution, facilityTypes, parkingTypes, 2010),
	);

	const chartConfig = baseChartConfig;

	let context = $state<ChartContextValue>();
	let showCumulative = $state(true);
	let showByType = $state(false);
	let showLabels = $state(false);
	let activeChart = $state<'bikeLanesKm' | 'parkingPlaces'>('bikeLanesKm');

	const isMobile = new MediaQuery('(max-width: 640px)');

	const numFormatter = new Intl.NumberFormat('fr-FR', {
		style: 'decimal',
		minimumFractionDigits: 0,
		maximumFractionDigits: 1,
	});

	const totalLengthKm = $derived(
		Math.round(
			voirieFeatures.reduce((sum: number, f: any) => sum + (f.properties?.longueur || 0), 0) / 10,
		) / 100,
	);

	const totalParkingPlaces = $derived(
		chartData.reduce((acc, curr) => acc + curr.parkingPlaces, 0) + parkingWithoutYear.capacity,
	);

	const typeChartConfig = $derived(createTypeChartConfig(facilityTypes));
	const parkingTypeChartConfig = $derived(createParkingTypeChartConfig(parkingTypes));
	const typeSeries = $derived(createTypeSeries(facilityTypes, showCumulative));
	const parkingTypeSeries = $derived(createParkingTypeSeries(parkingTypes, showCumulative));
	const singleSeries = $derived(createSingleSeries(activeChart, showCumulative));
	const sharedAreaProps = $derived(createSharedAreaProps(isMobile.current, activeChart));
	const sharedBarProps = $derived(createSharedBarProps(context, isMobile.current, activeChart));
	const sharedStackedBarProps = $derived(
		createSharedBarProps(context, isMobile.current, activeChart, true),
	);
	const chartPadding = $derived({
		left: 40,
		bottom: 20,
		right: showByType && showLabels && showCumulative && !isMobile.current ? 100 : 10,
		top: 10,
	});

	const currentSeries = $derived(activeChart === 'bikeLanesKm' ? typeSeries : parkingTypeSeries);
	const stackLabelPositions = $derived(
		showByType && showLabels && showCumulative
			? computeStackLabelPositions(context, chartData, currentSeries)
			: [],
	);

	const isLoading = $derived(voirieQuery.isPending || parkingQuery.isPending);
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
				Évolution des infrastructures – Métropole de Lyon
			</h2>
			<p class="text-sm text-gray-500">
				{showCumulative ? 'Total cumulé' : 'Nouvelles infrastructures'} par année de livraison
			</p>
			<div class="mt-2 flex flex-wrap items-center gap-4">
				<div class="flex items-center gap-2">
					<Checkbox
						id="cumulative-toggle-metropole"
						checked={showCumulative}
						onCheckedChange={(checked) => (showCumulative = checked === true)}
					/>
					<Label for="cumulative-toggle-metropole" class="cursor-pointer text-sm">
						Afficher le cumul
					</Label>
				</div>
				<div class="flex items-center gap-2">
					<Checkbox
						id="by-type-toggle-metropole"
						checked={showByType}
						onCheckedChange={(checked) => (showByType = checked === true)}
					/>
					<Label for="by-type-toggle-metropole" class="cursor-pointer text-sm">Par type</Label>
				</div>
			</div>
		</div>
		<div class="flex">
			<button
				data-active={activeChart === 'bikeLanesKm'}
				class="relative flex flex-1 cursor-pointer flex-col justify-center gap-1 border-t px-6 py-4 text-start even:border-s data-[active=true]:bg-gray-100 sm:border-s sm:border-t-0 sm:px-8 sm:py-6"
				onclick={() => (activeChart = 'bikeLanesKm')}
			>
				<span class="text-xs text-gray-500">Aménagements cyclables</span>
				<span class="text-lg leading-none font-bold sm:text-3xl">
					{voirieQuery.isPending ? '…' : `${numFormatter.format(totalLengthKm)}\u00a0km`}
				</span>
			</button>
			<button
				data-active={activeChart === 'parkingPlaces'}
				class="relative flex flex-1 cursor-pointer flex-col justify-center gap-1 border-t px-6 py-4 text-start even:border-s data-[active=true]:bg-gray-100 sm:border-s sm:border-t-0 sm:px-8 sm:py-6"
				onclick={() => (activeChart = 'parkingPlaces')}
			>
				<span class="text-xs text-gray-500">Places de stationnement</span>
				<span class="text-lg leading-none font-bold sm:text-3xl">
					{parkingQuery.isPending ? '…' : totalParkingPlaces.toLocaleString('fr-FR')}
				</span>
			</button>
		</div>
	</div>
	<div class="px-6 pt-5 pb-6 sm:p-6">
		{#if isLoading}
			<div class="flex h-[300px] items-center justify-center">
				<span class="text-gray-500">Chargement des données…</span>
			</div>
		{:else}
			<Chart.Container
				config={showByType
					? activeChart === 'bikeLanesKm'
						? typeChartConfig
						: parkingTypeChartConfig
					: chartConfig}
				class="aspect-auto h-[300px] w-full"
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
						props={sharedStackedBarProps}
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
						props={sharedAreaProps}
					>
						{#snippet aboveMarks()}
							{@render stackLabels()}
						{/snippet}
						{#snippet tooltip()}
							<Chart.Tooltip indicator="dot" labelFormatter={(v) => `Année ${v}`} />
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
						props={sharedStackedBarProps}
					>
						{#snippet tooltip()}
							<Chart.Tooltip indicator="dot" labelFormatter={(v) => `Année ${v}`} />
						{/snippet}
					</BarChart>
				{:else if !showByType && showCumulative}
					<AreaChart
						bind:context
						data={chartData}
						x="year"
						axis={true}
						series={singleSeries}
						padding={chartPadding}
						props={sharedAreaProps}
					>
						{#snippet tooltip()}
							<Chart.Tooltip indicator="dot" labelFormatter={(v) => `Année ${v}`} />
						{/snippet}
					</AreaChart>
				{:else}
					<BarChart
						bind:context
						data={chartData}
						x="year"
						axis={true}
						series={singleSeries}
						padding={chartPadding}
						props={sharedBarProps}
					>
						{#snippet tooltip()}
							<Chart.Tooltip indicator="dot" labelFormatter={(v) => `Année ${v}`} />
						{/snippet}
					</BarChart>
				{/if}
			</Chart.Container>
		{/if}

		{#if showByType}
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
		{#if activeChart === 'parkingPlaces' && parkingWithoutYear.capacity > 0}
			<p class="mt-6 text-xs text-gray-500">
				Note&nbsp;: {parkingWithoutYear.capacity.toLocaleString('fr-FR')} places de stationnement sans
				année de réalisation ne sont pas affichées.
			</p>
		{/if}
		{#if activeChart === 'bikeLanesKm' && bikeLanesWithoutYear.length > 0}
			<div class="mt-6 flex flex-wrap items-center gap-2">
				<Checkbox
					id="unknown-toggle-metropole-bottom"
					class="size-3.5 border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
					checked={includeUnknownBikeLanes}
					onCheckedChange={(checked) => (includeUnknownBikeLanes = checked === true)}
				/>
				<Label
					for="unknown-toggle-metropole-bottom"
					class="cursor-pointer text-xs font-normal text-gray-500"
				>
					Inclure les {numFormatter.format(
						Math.round(bikeLanesWithoutYear.length / 10) / 100,
					)}&nbsp;km d'aménagements sans année de réalisation
				</Label>
			</div>
		{/if}
		{#if showByType && showCumulative && !isMobile.current}
			<div class="mt-4 flex items-center gap-1.5">
				<Checkbox
					id="labels-toggle-metropole"
					class="size-3.5 border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
					checked={showLabels}
					onCheckedChange={(checked) => (showLabels = checked === true)}
				/>
				<Label
					for="labels-toggle-metropole"
					class="cursor-pointer text-xs font-normal text-gray-500"
				>
					Afficher le nom des séries sur le graphique
				</Label>
			</div>
		{/if}
	</div>
</section>
