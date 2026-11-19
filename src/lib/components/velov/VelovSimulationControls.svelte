<script lang="ts">
	import VelovForecastKindToggle from './VelovForecastKindToggle.svelte';
	import VelovLegend from './VelovLegend.svelte';
	import VelovSimulationTime from './VelovSimulationTime.svelte';
	import {
		VELOV_FORECAST_CREDIT_URL,
		VELOV_FORECAST_STEP_COUNT,
		type VelovTimeline,
	} from '$lib/utils/velovForecast';
	import type { VelovSimulation } from '$lib/utils/velovSimulation.svelte';

	let {
		simulation,
		timeline,
		compact = false,
		showTime = true,
		showKinds = true,
		hint = null,
	}: {
		simulation: VelovSimulation;
		timeline: VelovTimeline;
		compact?: boolean;
		showTime?: boolean;
		showKinds?: boolean;
		hint?: string | null;
	} = $props();

	const ratio = $derived(simulation.step / VELOV_FORECAST_STEP_COUNT);
	const ticks = $derived.by(() => {
		const hours = timeline.ticks.map((tick) => ({
			...tick,
			align: tick.position > 0.93 ? 'end' : 'middle',
		}));
		const first = hours[0];
		return !first || first.position > 0.12
			? [{ position: 0, label: 'maint.', align: 'start' }, ...hours]
			: hours;
	});
</script>

<div class="flex flex-col gap-2">
	{#if showTime}
		<VelovSimulationTime {simulation} {timeline} />
	{/if}

	<div class="relative pb-4">
		<input
			type="range"
			min="0"
			max={VELOV_FORECAST_STEP_COUNT}
			step="1"
			bind:value={simulation.step}
			aria-label="Heure simulée"
			aria-valuetext={timeline.dayLabel(simulation.step)}
			class="simulation-slider"
			style="--fill: calc(12px + (100% - 24px) * {ratio})"
		/>
		<div class="pointer-events-none absolute inset-x-3 bottom-0 h-3 text-[10px] text-gray-500">
			{#each ticks as tick (tick.position)}
				<span
					class="absolute whitespace-nowrap {tick.align === 'middle'
						? '-translate-x-1/2'
						: tick.align === 'end'
							? '-translate-x-full'
							: ''}"
					style="left: {tick.position * 100}%"
				>
					{tick.label}
				</span>
			{/each}
		</div>
	</div>

	{#if simulation.progress < 1 && !simulation.unavailable}
		<div
			class="h-0.5 overflow-hidden rounded-full bg-gray-200"
			role="progressbar"
			aria-label="Préchargement de la prévision"
			aria-valuenow={Math.round(simulation.progress * 100)}
			aria-valuemin="0"
			aria-valuemax="100"
		>
			<div
				class="h-full bg-brand-teal transition-[width] duration-200"
				style="width: {simulation.progress * 100}%"
			></div>
		</div>
	{/if}

	{#if showKinds}
		<VelovForecastKindToggle bind:kind={simulation.kind} />
	{/if}

	{#if simulation.unavailable}
		<p class="text-xs text-amber-700">Prévision indisponible pour le moment.</p>
	{/if}

	{#if !compact}
		<div class="flex items-end justify-between gap-3">
			<div class="min-w-0">
				<VelovLegend kind={simulation.kind} />
				{#if hint}
					<p class="mt-0.5 text-[10px] text-gray-400">{hint}</p>
				{/if}
			</div>
			<p class="shrink-0 text-[10px] text-gray-400">
				Prévision
				<a
					href={VELOV_FORECAST_CREDIT_URL}
					target="_blank"
					rel="noopener"
					class="underline hover:text-brand-navy">Lyon Pocket</a
				>
			</p>
		</div>
	{/if}
</div>

<style>
	.simulation-slider {
		display: block;
		width: 100%;
		height: 32px;
		margin: 0;
		appearance: none;
		background: transparent;
		cursor: pointer;
	}

	.simulation-slider::-webkit-slider-runnable-track {
		height: 6px;
		border-radius: 9999px;
		background: linear-gradient(to right, var(--color-brand-navy) var(--fill), #e5e7eb var(--fill));
	}

	.simulation-slider::-moz-range-track {
		height: 6px;
		border-radius: 9999px;
		background: linear-gradient(to right, var(--color-brand-navy) var(--fill), #e5e7eb var(--fill));
	}

	.simulation-slider::-webkit-slider-thumb {
		appearance: none;
		box-sizing: border-box;
		width: 24px;
		height: 24px;
		margin-top: -9px;
		border-radius: 9999px;
		background: #fff;
		border: 2px solid var(--color-brand-navy);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.simulation-slider::-moz-range-thumb {
		box-sizing: border-box;
		width: 24px;
		height: 24px;
		border-radius: 9999px;
		background: #fff;
		border: 2px solid var(--color-brand-navy);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.simulation-slider:focus-visible {
		outline: 2px solid var(--color-brand-navy);
		outline-offset: 2px;
		border-radius: 9999px;
	}
</style>
