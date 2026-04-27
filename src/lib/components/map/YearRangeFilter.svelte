<script lang="ts">
	import { Slider } from '$lib/components/ui/slider';

	let {
		range,
		min,
		max,
		onRangeChange,
		plain = false,
	}: {
		range: [number, number];
		min: number;
		max: number;
		onRangeChange: (range: [number, number]) => void;
		plain?: boolean;
	} = $props();

	const sliderValue = $derived([range[0], range[1]]);

	function onChange(next: number[]) {
		if (next.length !== 2) return;
		const sorted = [...next].sort((a, b) => a - b) as [number, number];
		if (sorted[0] !== range[0] || sorted[1] !== range[1]) {
			onRangeChange(sorted);
		}
	}
</script>

<div
	class:rounded-lg={!plain}
	class:bg-white={!plain}
	class:p-4={!plain}
	class:shadow={!plain}
	class="max-w-[400px]"
>
	<div class="mb-3 flex items-baseline justify-between gap-3">
		{#if !plain}
			<h2 class="text-sm font-semibold text-brand-navy uppercase">Année de réalisation</h2>
		{:else}
			<span class="text-xs font-medium text-gray-600 uppercase">Année de réalisation</span>
		{/if}
		<span class="text-sm font-medium text-gray-700">
			{range[0]} – {range[1]}
		</span>
	</div>
	<Slider
		type="multiple"
		value={sliderValue}
		onValueChange={onChange}
		{min}
		{max}
		step={1}
		class="mt-2"
	/>
	<div class="mt-1 flex justify-between text-xs text-gray-500">
		<span>{min}</span>
		<span>{max}</span>
	</div>
</div>
