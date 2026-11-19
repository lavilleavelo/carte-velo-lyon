<script lang="ts">
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import { VELOV_FORECAST_STEP_COUNT, type VelovTimeline } from '$lib/utils/velovForecast';
	import type { VelovSimulation } from '$lib/utils/velovSimulation.svelte';

	let { simulation, timeline }: { simulation: VelovSimulation; timeline: VelovTimeline } = $props();

	const STEPPER_CLASS =
		'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-brand-navy hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40';

	function shift(by: number) {
		simulation.step = Math.min(VELOV_FORECAST_STEP_COUNT, Math.max(0, simulation.step + by));
	}
</script>

<div class="inline-flex items-center gap-1.5">
	<button
		type="button"
		onclick={() => shift(-1)}
		disabled={simulation.step === 0}
		aria-label="15 minutes plus tôt"
		class={STEPPER_CLASS}
	>
		<Minus size={16} />
	</button>
	<p
		class="min-w-[10.5rem] text-center text-[15px] leading-tight font-bold text-brand-navy tabular-nums"
		aria-live="polite"
	>
		{timeline.dayLabel(simulation.step)}
	</p>
	<button
		type="button"
		onclick={() => shift(1)}
		disabled={simulation.step === VELOV_FORECAST_STEP_COUNT}
		aria-label="15 minutes plus tard"
		class={STEPPER_CLASS}
	>
		<Plus size={16} />
	</button>
</div>
