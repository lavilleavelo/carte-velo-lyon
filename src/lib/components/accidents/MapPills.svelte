<script lang="ts">
	let {
		showCycleways = $bindable(),
		showVL = $bindable(),
		showCounters = $bindable(),
		dimOverlay = $bindable(),
	}: {
		showCycleways: boolean;
		showVL: boolean;
		showCounters: boolean;
		dimOverlay: boolean;
	} = $props();

	const dimVisible = $derived(showCycleways || showVL);
</script>

<div
	class="pointer-events-none absolute top-3 left-1/2 z-10 flex -translate-x-1/2 flex-wrap justify-center gap-1.5 px-4"
>
	<button
		type="button"
		aria-pressed={showCycleways}
		onclick={() => (showCycleways = !showCycleways)}
		title="Aménagements cyclables"
		class="pointer-events-auto cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-sm transition-all active:scale-95"
		style="background-color: {showCycleways ? '#15803d' : 'white'}; color: {showCycleways
			? 'white'
			: '#15803d'}; border: 1.5px solid #15803d;"
	>
		<span class="sm:hidden">Aménagements</span>
		<span class="hidden sm:inline">Aménagements cyclables</span>
	</button>
	<button
		type="button"
		aria-pressed={showVL}
		onclick={() => (showVL = !showVL)}
		title="Voies Lyonnaises"
		class="pointer-events-auto cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-sm transition-all active:scale-95"
		style="background-color: {showVL ? '#152B68' : 'white'}; color: {showVL
			? 'white'
			: '#152B68'}; border: 1.5px solid #152B68;"
	>
		<span class="sm:hidden">VL</span>
		<span class="hidden sm:inline">Voies Lyonnaises</span>
	</button>
	<button
		type="button"
		aria-pressed={showCounters}
		onclick={() => (showCounters = !showCounters)}
		title="Compteurs vélo"
		class="pointer-events-auto cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-sm transition-all active:scale-95"
		style="background-color: {showCounters ? '#2563eb' : 'white'}; color: {showCounters
			? 'white'
			: '#2563eb'}; border: 1.5px solid #2563eb;"
	>
		<span class="sm:hidden">Compteurs</span>
		<span class="hidden sm:inline">Compteurs vélo</span>
	</button>
	{#if dimVisible}
		<label
			class="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[11px] font-medium whitespace-nowrap text-gray-600 shadow-sm ring-1 ring-gray-300 transition-all select-none hover:bg-gray-50"
			title="Atténuer les aménagements pour faire ressortir les points"
		>
			<input type="checkbox" class="peer sr-only" bind:checked={dimOverlay} />
			<span
				aria-hidden="true"
				class="relative inline-block h-3.5 w-6 shrink-0 rounded-full bg-gray-300 transition-colors peer-checked:bg-brand-navy after:absolute after:top-0.5 after:left-0.5 after:h-2.5 after:w-2.5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:after:translate-x-2.5"
			></span>
			Atténuer
		</label>
	{/if}
</div>
