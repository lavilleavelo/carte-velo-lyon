<script lang="ts">
	import { tick } from 'svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import Bike from '@lucide/svelte/icons/bike';
	import Zap from '@lucide/svelte/icons/zap';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import CircleParking from '@lucide/svelte/icons/circle-parking';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import VelovForecastKindToggle from './VelovForecastKindToggle.svelte';
	import { velovPalettePreference } from '$lib/utils/mapPreferences.svelte';
	import { velovForecastView } from '$lib/utils/velovForecastView.svelte';
	import {
		VELOV_FORECAST_CREDIT_URL,
		VELOV_FORECAST_KIND_INFO,
		VELOV_FORECAST_STEP_COUNT,
		VELOV_FORECAST_STEP_MINUTES,
		createVelovTimeline,
		fetchVelovForecast,
		velovChance,
		velovCountText,
		velovRangeText,
		velovReliabilityText,
		velovSmoothed,
		velovStateCount,
		type VelovChanceLevel,
		type VelovForecastKind,
	} from '$lib/utils/velovForecast';

	let {
		stationId,
		step = $bindable(4),
		kind = $bindable('velos'),
		simulatedLabel = null,
		onExpand = undefined,
		onCollapse = undefined,
		class: className = '',
	}: {
		stationId: number;
		step?: number;
		kind?: VelovForecastKind;
		simulatedLabel?: string | null;
		onExpand?: () => void;
		onCollapse?: () => void;
		class?: string;
	} = $props();

	const SUMMARY_ROWS = [
		{ kind: 'velos', label: 'Un vélo', icon: Bike },
		{ kind: 'elec', label: 'Un électrique', icon: Zap },
		{ kind: 'meca', label: 'Un mécanique', icon: Bike },
		{ kind: 'bornes', label: 'Une place', icon: CircleParking },
	] as const;
	const SUMMARY_STEPS = [1, 2];
	const SCRUB_SLOP = 6;

	let section: HTMLElement | undefined = $state();
	let scrub: { x: number; y: number; active: boolean } | null = null;
	const expanded = $derived(velovForecastView.expanded);

	async function toggleExpanded() {
		velovForecastView.expanded = !velovForecastView.expanded;
		if (!velovForecastView.expanded) {
			onCollapse?.();
			return;
		}

		onExpand?.();
		await tick();
		section?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}

	const levelColors = $derived(velovPalettePreference.colors.chance);

	const HEIGHT = 120;
	const TOP = 14;
	const BOTTOM = 16;
	const INNER = HEIGHT - TOP - BOTTOM;
	const TRACK_HEIGHT = 6;

	let width = $state(0);

	const query = createQuery(() => ({
		queryKey: ['velov-forecast', stationId],
		queryFn: () => fetchVelovForecast(stationId),
		staleTime: 5 * 60_000,
		retry: false,
	}));

	const forecast = $derived(query.data ?? null);
	const timeline = $derived(forecast ? createVelovTimeline(forecast.origin) : null);
	const kindInfo = $derived(VELOV_FORECAST_KIND_INFO[kind]);

	const view = $derived.by(() => {
		if (!forecast || !timeline) {
			return null;
		}

		const series = forecast.series[kind];
		const now = velovStateCount(forecast.state, kind);
		const levels = series.p.map((probability) => velovChance(probability).level);
		const curve = (values: number[]) => [now, ...velovSmoothed(values)];
		const runs: { from: number; to: number; level: VelovChanceLevel }[] = [];
		levels.forEach((level, rank) => {
			const last = runs[runs.length - 1];
			if (last && last.level === level) {
				last.to = rank + 1;
			} else {
				runs.push({ from: rank, to: rank + 1, level });
			}
		});

		return {
			series,
			now,
			runs,
			scaleMax: Math.max(1, forecast.state.capacity, now),
			q10: curve(series.q10),
			q30: curve(series.q30),
			q50: curve(series.q50),
			q70: curve(series.q70),
			q90: curve(series.q90),
			risk: timeline.risk(levels, kind),
		};
	});

	const summary = $derived.by(() => {
		if (!forecast || !timeline) {
			return null;
		}

		const label = step > 0 ? simulatedLabel : null;
		const steps = label ? [step] : SUMMARY_STEPS;

		const rows = label
			? SUMMARY_ROWS
			: SUMMARY_ROWS.filter((row) => row.kind === 'velos' || row.kind === 'bornes');

		return {
			columns: steps.map((at) => label ?? `dans ${at * VELOV_FORECAST_STEP_MINUTES} min`),
			rows: rows.map((row) => ({
				...row,
				selected: !!label && row.kind === kind,
				chances: steps.map((at) => velovChance(forecast.series[row.kind].p[at - 1])),
			})),
		};
	});

	const readout = $derived.by(() => {
		if (!forecast || !timeline || !view) {
			return null;
		}

		if (step === 0) {
			return {
				time: timeline.label(0),
				count: velovCountText(view.now, kind),
				chance: null,
				reliability: null,
			};
		}

		const rank = step - 1;
		return {
			time: timeline.label(step),
			count: velovRangeText(view.series.q10[rank], view.series.q90[rank], kind),
			chance: velovChance(view.series.p[rank]),
			reliability: velovReliabilityText(forecast.coverage[kind]),
		};
	});

	const x = (at: number) => (at / VELOV_FORECAST_STEP_COUNT) * width;
	const y = (value: number) => TOP + (1 - value / (view?.scaleMax ?? 1)) * INNER;
	const point = (value: number, at: number) => `${x(at).toFixed(1)},${y(value).toFixed(1)}`;

	function line(values: number[]): string {
		return `M${values.map(point).join('L')}`;
	}

	function band(low: number[], high: number[]): string {
		const back = low.map(point).reverse();
		return `M${high.map(point).join('L')}L${back.join('L')}Z`;
	}

	function anchor(position: number): 'start' | 'middle' | 'end' {
		return position > 0.94 ? 'end' : position < 0.06 ? 'start' : 'middle';
	}

	function moveTo(event: PointerEvent) {
		const box = (event.currentTarget as SVGRectElement).getBoundingClientRect();
		const ratio = (event.clientX - box.left) / box.width;
		step = Math.min(
			VELOV_FORECAST_STEP_COUNT,
			Math.max(0, Math.round(ratio * VELOV_FORECAST_STEP_COUNT)),
		);
	}

	function startScrub(event: PointerEvent) {
		scrub = { x: event.clientX, y: event.clientY, active: event.pointerType === 'mouse' };
		if (scrub.active) {
			(event.currentTarget as SVGRectElement).setPointerCapture(event.pointerId);
			moveTo(event);
		}
	}

	function continueScrub(event: PointerEvent) {
		if (!scrub) {
			return;
		}

		if (!scrub.active) {
			const dx = Math.abs(event.clientX - scrub.x);
			const dy = Math.abs(event.clientY - scrub.y);
			if (dx < SCRUB_SLOP && dy < SCRUB_SLOP) {
				return;
			}

			if (dy >= dx) {
				scrub = null;
				return;
			}
			scrub.active = true;
		}

		moveTo(event);
	}

	function endScrub(event: PointerEvent) {
		if (scrub && !scrub.active) {
			moveTo(event);
		}
		scrub = null;
	}
</script>

{#if query.isLoading}
	<div
		class="animate-pulse rounded-md bg-gray-50 {expanded ? 'h-[360px]' : 'h-[94px]'} {className}"
		aria-hidden="true"
	></div>
{:else if forecast && timeline && view && readout && summary}
	<section
		bind:this={section}
		class="flex flex-col gap-1.5 rounded-md bg-gray-50 px-3 py-2 {className}"
		aria-label="Prévision"
	>
		<div class="flex items-center justify-between gap-2">
			<h4 class="text-xs font-semibold text-gray-600 uppercase">Prévision</h4>
			<button
				type="button"
				aria-expanded={expanded}
				onclick={toggleExpanded}
				class="-mr-1 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-medium text-brand-navy hover:bg-gray-200 pointer-coarse:px-2 pointer-coarse:py-2 pointer-coarse:text-xs"
			>
				{expanded ? 'Réduire' : 'Voir sur 24 h'}
				{#if expanded}
					<ChevronUp size={12} />
				{:else}
					<ChevronDown size={12} />
				{/if}
			</button>
		</div>

		<table class="w-full text-xs">
			<thead>
				<tr>
					<th scope="col" class="pb-0.5 pl-1 text-left text-[10px] font-medium text-gray-500">
						Chance de trouver
					</th>
					{#each summary.columns as column (column)}
						<th
							scope="col"
							class="pr-1 pb-0.5 pl-2 text-right text-[10px] font-medium text-gray-500"
						>
							{column}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each summary.rows as row (row.kind)}
					<tr class={row.selected ? 'bg-brand-navy/10' : ''}>
						<th
							scope="row"
							class="rounded-l py-0.5 pl-1 text-left {row.selected
								? 'font-semibold text-gray-900'
								: 'font-medium text-gray-700'}"
						>
							<span class="inline-flex items-center gap-1.5">
								<row.icon size={12} class="shrink-0 text-gray-500" />
								{row.label}
							</span>
						</th>
						{#each row.chances as chance, rank (rank)}
							<td class="py-0.5 pr-1 pl-2 text-right whitespace-nowrap last:rounded-r">
								<span
									class="inline-flex items-center gap-1 font-semibold text-gray-900 tabular-nums"
									title={chance.label}
								>
									<span
										class="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/20"
										style="background: {levelColors[chance.level]}"
										aria-hidden="true"
									></span>
									{chance.percent}&nbsp;%
									<span class="sr-only">{chance.label}</span>
								</span>
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>

		{#if expanded}
			<VelovForecastKindToggle bind:kind />

			<div class="relative" bind:clientWidth={width}>
				{#if width > 0}
					<svg
						{width}
						height={HEIGHT}
						viewBox="0 0 {width} {HEIGHT}"
						class="block overflow-visible"
						role="img"
						aria-label="Prévision sur 24 heures : {kindInfo.title.toLowerCase()}"
					>
						<line x1="0" x2={width} y1={y(view.scaleMax)} y2={y(view.scaleMax)} class="grid" />
						<line x1="0" x2={width} y1={y(0)} y2={y(0)} class="baseline" />
						<text x={width} y={TOP - 4} text-anchor="end" class="axis">
							{view.scaleMax}
						</text>

						{#if timeline.midnight}
							{@const at = timeline.midnight.position * width}
							<line x1={at} x2={at} y1={TOP - 10} y2={y(0)} class="midnight" />
							<text
								x={timeline.midnight.position > 0.6 ? at - 4 : at + 4}
								y={TOP - 4}
								text-anchor={timeline.midnight.position > 0.6 ? 'end' : 'start'}
								class="axis"
							>
								{timeline.midnight.label}
							</text>
						{/if}

						<path d={band(view.q10, view.q90)} class="band-wide" />
						<path d={band(view.q30, view.q70)} class="band-tight" />
						<path d={line(view.q50)} class="median" />

						{#each timeline.ticks as tick (tick.position)}
							<text
								x={tick.position * width}
								y={HEIGHT - 3}
								text-anchor={anchor(tick.position)}
								class="axis"
							>
								{tick.label}
							</text>
						{/each}

						<line x1={x(step)} x2={x(step)} y1={TOP} y2={y(0)} class="cursor" />
						<circle cx={x(step)} cy={y(view.q50[step])} r="4" class="cursor-dot" />

						<rect
							x="0"
							y="0"
							{width}
							height={HEIGHT}
							fill="transparent"
							class="cursor-ew-resize touch-pan-y"
							role="presentation"
							onpointerdown={startScrub}
							onpointermove={continueScrub}
							onpointerup={endScrub}
							onpointercancel={() => (scrub = null)}
						/>
					</svg>
				{:else}
					<div style="height: {HEIGHT}px"></div>
				{/if}
			</div>

			<div class="relative h-4">
				<svg
					class="absolute inset-x-0 top-[5px] block w-full overflow-hidden rounded-full ring-1 ring-black/15"
					height={TRACK_HEIGHT}
					viewBox="0 0 {VELOV_FORECAST_STEP_COUNT} {TRACK_HEIGHT}"
					preserveAspectRatio="none"
					aria-hidden="true"
				>
					{#each view.runs as run (run.from)}
						<rect
							x={run.from}
							width={run.to - run.from}
							y="0"
							height={TRACK_HEIGHT}
							fill={levelColors[run.level]}
						/>
					{/each}
				</svg>
				<input
					type="range"
					min="0"
					max={VELOV_FORECAST_STEP_COUNT}
					step="1"
					bind:value={step}
					aria-label="Heure de la prévision"
					aria-valuetext="{readout.time} : {readout.count}"
					class="forecast-slider absolute inset-y-0 -left-2 h-4 w-[calc(100%+1rem)]"
				/>
			</div>

			<div class="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
				<div class="min-w-0">
					<p class="text-[11px] font-medium text-gray-500">{readout.time}</p>
					{#if readout.chance}
						<p class="flex items-baseline gap-1.5 leading-tight text-gray-900">
							<span
								class="h-2.5 w-2.5 shrink-0 self-center rounded-full ring-1 ring-black/20"
								style="background: {levelColors[readout.chance.level]}"
								aria-hidden="true"
							></span>
							<span class="text-base font-bold tabular-nums">{readout.chance.percent}&nbsp;%</span>
							<span class="text-xs font-semibold">{readout.chance.label}</span>
						</p>
						<p class="text-[11px] leading-tight text-gray-500">{kindInfo.any}</p>
					{:else}
						<p class="text-base leading-tight font-bold text-gray-900 tabular-nums">
							{readout.count}
						</p>
					{/if}
				</div>
				{#if readout.chance}
					<p class="ml-auto text-right text-[11px] leading-tight text-gray-500">
						<span class="text-xs font-semibold text-gray-900 tabular-nums">{readout.count}</span>
						{#if readout.reliability}
							<br />
							{readout.reliability}
						{/if}
					</p>
				{/if}
			</div>

			{#if view.risk}
				<p class="flex items-center gap-1.5 text-[11px] font-medium text-gray-700">
					<TriangleAlert size={12} class="shrink-0 text-red-600" />
					{view.risk}
				</p>
			{/if}
		{/if}

		<p class="text-[10px] leading-snug text-gray-400">
			Prévision
			<a
				href={VELOV_FORECAST_CREDIT_URL}
				target="_blank"
				rel="noopener"
				class="inline-flex items-center gap-0.5 underline hover:text-brand-navy"
			>
				Lyon Pocket
				<ExternalLink size={9} />
			</a>
		</p>
	</section>
{/if}

<style>
	.grid,
	.baseline {
		stroke: #d1d5db;
		stroke-width: 1;
	}

	.grid {
		stroke-dasharray: 2 3;
	}

	.midnight {
		stroke: #9ca3af;
		stroke-width: 1;
		stroke-dasharray: 2 2;
	}

	.axis {
		fill: #6b7280;
		font-size: 10px;
	}

	.band-wide {
		fill: var(--color-brand-navy);
		fill-opacity: 0.14;
	}

	.band-tight {
		fill: var(--color-brand-navy);
		fill-opacity: 0.3;
	}

	.median {
		fill: none;
		stroke: var(--color-brand-navy);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.cursor {
		stroke: #111827;
		stroke-width: 1;
	}

	.cursor-dot {
		fill: var(--color-brand-navy);
		stroke: #fff;
		stroke-width: 2;
	}

	.forecast-slider {
		appearance: none;
		background: transparent;
		margin: 0;
		cursor: pointer;
	}

	.forecast-slider::-webkit-slider-runnable-track {
		background: transparent;
		height: 16px;
	}

	.forecast-slider::-moz-range-track {
		background: transparent;
		height: 16px;
	}

	.forecast-slider::-webkit-slider-thumb {
		appearance: none;
		box-sizing: border-box;
		width: 16px;
		height: 16px;
		border-radius: 9999px;
		background: #fff;
		border: 2px solid var(--color-brand-navy);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
	}

	.forecast-slider::-moz-range-thumb {
		box-sizing: border-box;
		width: 16px;
		height: 16px;
		border-radius: 9999px;
		background: #fff;
		border: 2px solid var(--color-brand-navy);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
	}

	.forecast-slider:focus-visible {
		outline: 2px solid var(--color-brand-navy);
		outline-offset: 2px;
		border-radius: 9999px;
	}
</style>
