<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';

	type LoadingLayer = {
		id: string;
		label: string;
	};

	const SHOW_DELAY_MS = 500;
	const MIN_VISIBLE_MS = 500;
	const MAX_INLINE_LABELS = 2;

	let { layers }: { layers: LoadingLayer[] } = $props();

	let isVisible = $state(false);
	let displayedLayers = $state<LoadingLayer[]>([]);

	let showTimer: ReturnType<typeof setTimeout> | null = null;
	let hideTimer: ReturnType<typeof setTimeout> | null = null;
	let shownAt = 0;

	$effect(() => {
		const loadingNow = layers.length > 0;

		if (loadingNow) {
			displayedLayers = layers;
			if (hideTimer) {
				clearTimeout(hideTimer);
				hideTimer = null;
			}
			if (!isVisible && !showTimer) {
				showTimer = setTimeout(() => {
					showTimer = null;
					shownAt = Date.now();
					isVisible = true;
				}, SHOW_DELAY_MS);
			}
		} else {
			if (showTimer) {
				clearTimeout(showTimer);
				showTimer = null;
			}
			if (isVisible && !hideTimer) {
				const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
				hideTimer = setTimeout(() => {
					hideTimer = null;
					isVisible = false;
				}, remaining);
			}
		}
	});

	onDestroy(() => {
		if (showTimer) {
			clearTimeout(showTimer);
		}

		if (hideTimer) {
			clearTimeout(hideTimer);
		}
	});

	const label = $derived.by(() => {
		if (displayedLayers.length === 0) return '';
		if (displayedLayers.length <= MAX_INLINE_LABELS) {
			return displayedLayers.map((l) => l.label).join(', ');
		}
		const shown = displayedLayers
			.slice(0, MAX_INLINE_LABELS)
			.map((l) => l.label)
			.join(', ');
		const extra = displayedLayers.length - MAX_INLINE_LABELS;
		return `${shown} + ${extra} calque${extra > 1 ? 's' : ''}`;
	});
</script>

{#if isVisible && displayedLayers.length > 0}
	<div
		class="pointer-events-none flex flex-col gap-1.5 rounded-lg bg-white/90 px-3 py-2 shadow-md backdrop-blur-sm"
		role="status"
		aria-live="polite"
		transition:fade={{ duration: 180 }}
	>
		<div class="flex items-center gap-2 text-brand-navy">
			<span
				class="block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-brand-navy border-t-transparent"
				aria-hidden="true"
			></span>
			<span class="truncate text-xs font-medium">{label}</span>
		</div>
		<span
			class="relative block h-0.5 w-full overflow-hidden rounded-full bg-gray-200"
			aria-hidden="true"
		>
			<span class="map-loader-bar absolute inset-y-0 left-0 block w-1/3 rounded-full bg-brand-navy"
			></span>
		</span>
	</div>
{/if}

<style>
	.map-loader-bar {
		animation: map-loader-slide 1.3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
	}

	@keyframes map-loader-slide {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(400%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.map-loader-bar {
			animation: none;
			width: 100%;
			opacity: 0.6;
		}
	}
</style>
