<script lang="ts">
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import VelovForecastKindToggle from './VelovForecastKindToggle.svelte';
	import { velovPalettePreference } from '$lib/utils/mapPreferences.svelte';
	import {
		VELOV_CHANCE_LABELS,
		VELOV_CHANCE_LEVELS,
		VELOV_FORECAST_CREDIT_URL,
		VELOV_FORECAST_STEP_COUNT,
		type VelovTimeline,
	} from '$lib/utils/velovForecast';
	import type { VelovSimulation } from '$lib/utils/velovSimulation.svelte';

	let {
		simulation,
		timeline,
		compact = false,
		onExit = undefined,
	}: {
		simulation: VelovSimulation;
		timeline: VelovTimeline;
		compact?: boolean;
		onExit?: () => void;
	} = $props();

	const STEPPER_CLASS =
		'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-brand-navy hover:bg-gray-50 disabled:opacity-40 pointer-coarse:h-10 pointer-coarse:w-10';

	function shift(by: number) {
		simulation.step = Math.min(VELOV_FORECAST_STEP_COUNT, Math.max(0, simulation.step + by));
	}

	const legend = $derived.by(() => {
		const colors = velovPalettePreference.colors;
		if (simulation.kind === 'velos') {
			return [
				{ label: 'mécaniques', color: colors.mech.fill },
				{ label: 'électriques', color: colors.elec.fill },
			];
		}

		return VELOV_CHANCE_LEVELS.map((level) => ({
			label: VELOV_CHANCE_LABELS[level],
			color: colors.chance[level],
		}));
	});
</script>

<div class="flex flex-col gap-1.5">
	<div class="flex items-center gap-2">
		<button
			type="button"
			onclick={() => shift(-1)}
			disabled={simulation.step === 0}
			aria-label="15 minutes plus tôt"
			class={STEPPER_CLASS}
		>
			<Minus size={14} />
		</button>
		<p class="min-w-0 flex-1 text-center text-sm font-bold text-brand-navy" aria-live="polite">
			{timeline.dayLabel(simulation.step)}
		</p>
		<button
			type="button"
			onclick={() => shift(1)}
			disabled={simulation.step === VELOV_FORECAST_STEP_COUNT}
			aria-label="15 minutes plus tard"
			class={STEPPER_CLASS}
		>
			<Plus size={14} />
		</button>
	</div>
	<input
		type="range"
		min="0"
		max={VELOV_FORECAST_STEP_COUNT}
		step="1"
		bind:value={simulation.step}
		aria-label="Heure simulée"
		aria-valuetext={timeline.dayLabel(simulation.step)}
		class="w-full accent-brand-navy pointer-coarse:h-8"
	/>
	<div class="flex justify-between text-[10px] text-gray-500">
		<span>Maintenant</span>
		<span>+ 12 h</span>
		<span>+ 24 h</span>
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
	<VelovForecastKindToggle bind:kind={simulation.kind} />
	{#if !compact}
		<ul class="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-gray-600">
			{#each legend as item (item.label)}
				<li class="inline-flex items-center gap-1">
					<span
						class="h-2 w-2 rounded-full ring-1 ring-black/20"
						style:background-color={item.color}
						aria-hidden="true"
					></span>
					{item.label}
				</li>
			{/each}
		</ul>
		<div class="flex items-end justify-between gap-2">
			<p class="min-w-0 flex-1 text-[10px] leading-snug text-gray-500">
				{#if simulation.unavailable}
					Prévision indisponible pour le moment.
				{:else if simulation.step === 0}
					Glissez pour voir la prévision.
				{:else}
					Fourchette prévue par station, visible en zoomant.
				{/if}
				<span class="block text-gray-400">
					Prévision
					<a
						href={VELOV_FORECAST_CREDIT_URL}
						target="_blank"
						rel="noopener"
						class="underline hover:text-brand-navy">Lyon Pocket</a
					>
				</span>
			</p>
			{#if onExit}
				<button
					type="button"
					onclick={onExit}
					class="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-brand-navy hover:bg-gray-50 pointer-coarse:py-2.5"
				>
					Temps réel
				</button>
			{/if}
		</div>
	{/if}
</div>
