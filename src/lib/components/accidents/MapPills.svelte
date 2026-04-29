<script lang="ts">
	let {
		showCycleways = $bindable(),
		showVL = $bindable(),
		dimOverlay = $bindable(),
	}: {
		showCycleways: boolean;
		showVL: boolean;
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
		class="pointer-events-auto cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-sm transition-all active:scale-95"
		style="background-color: {showCycleways ? '#15803d' : 'white'}; color: {showCycleways
			? 'white'
			: '#15803d'}; border: 1.5px solid #15803d;"
	>
		Aménagements cyclables
	</button>
	<button
		type="button"
		aria-pressed={showVL}
		onclick={() => (showVL = !showVL)}
		class="pointer-events-auto cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-sm transition-all active:scale-95"
		style="background-color: {showVL ? '#152B68' : 'white'}; color: {showVL
			? 'white'
			: '#152B68'}; border: 1.5px solid #152B68;"
	>
		Voies Lyonnaises
	</button>
	{#if dimVisible}
		<button
			type="button"
			aria-pressed={dimOverlay}
			onclick={() => (dimOverlay = !dimOverlay)}
			title={dimOverlay ? 'Aménagements estompés' : 'Aménagements normaux'}
			class="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-medium whitespace-nowrap text-gray-600 shadow-sm ring-1 ring-gray-300 transition-all hover:bg-gray-50 active:scale-95"
		>
			<span
				class="inline-block h-2 w-2 rounded-full"
				style="background: {dimOverlay ? '#9ca3af' : '#374151'};"
			></span>
			{dimOverlay ? 'Estompé' : 'Normal'}
		</button>
	{/if}
</div>
