<script lang="ts">
	import { GRAVITIES, VELO_INTENSITY, VELO_INTENSITY_AXIS_MAX, type Breakdown } from './types';

	let {
		yearHistogram,
		histogramMax,
		gravitySet,
		yearFrom,
		yearTo,
		dataMinYear,
		dataMaxYear,
		labellisationBreakYear,
		onSelectYear,
	}: {
		yearHistogram: { year: number; breakdown: Breakdown; total: number }[];
		histogramMax: number;
		gravitySet: Set<string>;
		yearFrom: number;
		yearTo: number;
		dataMinYear: number;
		dataMaxYear: number;
		labellisationBreakYear?: number;
		onSelectYear: (year: number) => void;
	} = $props();

	let hoveredYear = $state<number | null>(null);

	const numFmt = new Intl.NumberFormat('fr-FR');
	const HEIGHT = 64;

	const intensityPoints = $derived(
		yearHistogram
			.map((y, i) => {
				const v = VELO_INTENSITY[y.year];
				if (v == null) return null;
				const px = i + 0.5;
				const py = HEIGHT - (v / VELO_INTENSITY_AXIS_MAX) * HEIGHT;
				return `${px},${py}`;
			})
			.filter(Boolean)
			.join(' '),
	);

	const breakX = $derived.by(() => {
		if (labellisationBreakYear == null) return null;
		const idx = yearHistogram.findIndex((d) => d.year === labellisationBreakYear);
		if (idx === -1) {
			return null;
		}

		return idx + 1;
	});
</script>

<div class="relative" style="height: {HEIGHT}px;">
	<div
		class="flex h-full items-end gap-0.5"
		role="img"
		aria-label="Histogramme des accidents par année"
		onmouseleave={() => (hoveredYear = null)}
	>
		{#each yearHistogram as { year, breakdown, total } (year)}
			{@const inRange = year >= yearFrom && year <= yearTo}
			{@const isPreBreak = labellisationBreakYear != null && year <= labellisationBreakYear}
			<button
				type="button"
				class="group relative flex h-full flex-1 flex-col-reverse rounded-t-sm transition-opacity hover:!opacity-100"
				style="opacity: {inRange ? (isPreBreak ? 0.65 : 1) : 0.25}; min-width: 0;"
				title={isPreBreak
					? `${year} : ${numFmt.format(total)} victime${total > 1 ? 's' : ''} (labellisation BH antérieure, peu comparable)`
					: `${year} : ${numFmt.format(total)} victime${total > 1 ? 's' : ''}`}
				onclick={() => onSelectYear(year)}
				onmouseenter={() => (hoveredYear = year)}
			>
				{#each GRAVITIES as g (g.id)}
					{@const c = gravitySet.has(g.id) ? breakdown[g.id] : 0}
					{@const segH = (c / histogramMax) * HEIGHT}
					{#if c > 0}
						<div style="background-color: {g.color}; height: {segH}px; width: 100%;"></div>
					{/if}
				{/each}
				{#if total === 0}
					<div style="height: 1px; width: 100%; background: #e5e7eb;"></div>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Cycling intensity overlay (Métropole, base 100 = 2019) -->
	{#if yearHistogram.length > 0}
		<svg
			class="pointer-events-none absolute inset-0 h-full w-full"
			viewBox={`0 0 ${yearHistogram.length} ${HEIGHT}`}
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			{#if breakX != null}
				<!-- Pre-2019 / 2019+ data labellisation break (ONISR stopped certifying
				     the "blessé hospitalisé" indicator from 2019 on). -->
				<line
					x1={breakX}
					x2={breakX}
					y1="0"
					y2={HEIGHT}
					stroke="#9ca3af"
					stroke-width="1"
					stroke-dasharray="2 2"
					vector-effect="non-scaling-stroke"
				/>
			{/if}
			<polyline
				points={intensityPoints}
				fill="none"
				stroke="#2563eb"
				stroke-width="2"
				stroke-linejoin="round"
				stroke-linecap="round"
				stroke-dasharray="3 2"
				vector-effect="non-scaling-stroke"
			/>
		</svg>
	{/if}
</div>
<div class="mt-1 flex items-baseline justify-between gap-2 text-[10px] tabular-nums">
	<span class="text-gray-400">{dataMinYear}</span>
	{#if hoveredYear !== null}
		{@const hv = yearHistogram.find((d) => d.year === hoveredYear)}
		{@const intensity = VELO_INTENSITY[hoveredYear]}
		<span class="flex items-center gap-2 font-semibold text-gray-700">
			<span class="inline-block w-1" style="border-top: 2px solid #2563eb;"></span>
			<span>{hoveredYear} : {numFmt.format(hv?.total ?? 0)}</span>
			{#if intensity != null}
				<span class="font-normal text-blue-700">· pratique ×{(intensity / 100).toFixed(2)}</span>
			{/if}
		</span>
	{:else}
		<span class="flex items-center gap-1 text-gray-500">
			<span class="inline-block w-3" style="border-top: 2px solid #2563eb;"></span>
			<span title="Source : Métropole de Lyon, Janvier 2025"
				>pratique cyclable (base 100 = 2019)</span
			>
		</span>
	{/if}
	<span class="text-gray-400">{dataMaxYear}</span>
</div>
