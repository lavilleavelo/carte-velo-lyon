<script lang="ts">
	import { CustomControl } from 'svelte-maplibre-gl';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import {
		SPEED_BUCKETS,
		SPEED_BUCKET_COLORS,
		SPEED_BUCKET_LABELS,
		type SpeedBucket,
		type SpeedLimitsStats,
	} from '$lib/utils/speedLimits';

	let {
		selected = [],
		stats,
		onToggle,
		onReset,
		position = 'bottom-right',
		initiallyOpen = true,
	}: {
		selected?: SpeedBucket[];
		stats?: SpeedLimitsStats;
		onToggle: (bucket: SpeedBucket) => void;
		onReset: () => void;
		position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
		initiallyOpen?: boolean;
	} = $props();

	let open = $state(initiallyOpen);

	const kmFormatter = new Intl.NumberFormat('fr-FR', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});

	function formatKm(bucket: SpeedBucket): string | null {
		if (!stats) return null;
		const meters = stats[bucket];
		if (!meters) return null;
		return `${kmFormatter.format(meters / 1000)}\u00a0km`;
	}

	function hasData(bucket: SpeedBucket): boolean {
		return !!(stats && (stats[bucket] ?? 0) > 0);
	}

	const visibleBuckets = $derived.by(() => {
		if (!stats) return SPEED_BUCKETS.filter((b) => b !== 'unknown');
		// Only show the "unknown" bucket when there is data for it
		return SPEED_BUCKETS.filter((b) => b !== 'unknown' || hasData(b));
	});
</script>

<CustomControl {position}>
	<div
		class="speed-limits-control rounded-lg bg-white/85 shadow-md ring-1 ring-black/5 backdrop-blur-sm"
	>
		<button
			type="button"
			onclick={() => (open = !open)}
			class="flex items-center gap-2 rounded-lg text-left"
			aria-expanded={open}
		>
			<span class="text-xs font-semibold tracking-wide text-brand-navy uppercase"
				>Limitations de vitesse</span
			>
			<ChevronDown
				size={16}
				class="ml-auto text-gray-500 transition-transform duration-200 {open ? 'rotate-180' : ''}"
			/>
		</button>

		{#if open}
			<ul class="flex flex-col gap-1 px-3 pb-2">
				{#each visibleBuckets as bucket (bucket)}
					{@const isActive = selected.includes(bucket)}
					{@const dim = selected.length > 0 && !isActive}
					{@const km = formatKm(bucket)}
					<li>
						<button
							type="button"
							onclick={() => onToggle(bucket)}
							aria-pressed={isActive}
							class="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-xs whitespace-nowrap text-gray-700 transition-colors hover:bg-gray-100"
							class:bg-gray-200={isActive}
							class:ring-2={isActive}
							class:ring-gray-400={isActive}
							class:opacity-40={dim}
						>
							<span
								class="inline-block h-3 w-5 rounded"
								style="background-color: {SPEED_BUCKET_COLORS[bucket]}"
							></span>
							<span class="font-medium">{SPEED_BUCKET_LABELS[bucket]}</span>
							{#if km}
								<span class="ml-auto pl-1 text-gray-500 tabular-nums">{km}</span>
							{/if}
						</button>
					</li>
				{/each}
				{#if selected.length > 0}
					<li class="pt-1">
						<button
							type="button"
							class="text-xs text-gray-500 underline hover:text-gray-700"
							onclick={onReset}>Réinitialiser</button
						>
					</li>
				{/if}
			</ul>
		{/if}
	</div>
</CustomControl>
