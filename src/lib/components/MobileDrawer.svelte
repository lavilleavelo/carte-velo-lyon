<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cn } from '$lib/utils';

	let {
		open = $bindable(false),
		snapPoints = [0.4, 0.9], // Percentages of screen height (e.g., 0.5 = 50%)
		initialSnapPoint = 0,
		children,
		class: className,
		onClose,
	} = $props();

	let drawerHeight = $state(0);
	let isDragging = $state(false);
	let startY = 0;
	let startHeight = 0;
	let windowHeight = $state(0);
	let drawerElement: HTMLDivElement;

	const snapHeights = $derived(snapPoints.map((p) => p * windowHeight));

	function handleTouchStart(e: TouchEvent) {
		isDragging = true;
		startY = e.touches[0].clientY;
		startHeight = drawerHeight;

		window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
		window.addEventListener('touchend', handleWindowTouchEnd);
	}

	function handleWindowTouchMove(e: TouchEvent) {
		if (!isDragging) return;
		e.preventDefault();
		const deltaY = startY - e.touches[0].clientY;
		const newHeight = startHeight + deltaY;
		drawerHeight = Math.max(100, Math.min(newHeight, windowHeight));
	}

	function handleWindowTouchEnd() {
		isDragging = false;
		window.removeEventListener('touchmove', handleWindowTouchMove);
		window.removeEventListener('touchend', handleWindowTouchEnd);
		snapToNearest();
	}

	function snapToNearest() {
		const currentH = drawerHeight;
		const thresholds = [0, ...snapHeights];

		let closest = thresholds[0];
		let minDiff = Math.abs(currentH - closest);

		for (const h of thresholds) {
			const diff = Math.abs(currentH - h);
			if (diff < minDiff) {
				minDiff = diff;
				closest = h;
			}
		}

		if (closest < 100) {
			close();
		} else {
			animateTo(closest);
		}
	}

	function animateTo(h: number) {
		drawerHeight = h;
	}

	function openDrawer() {
		if (windowHeight > 0) {
			const target = snapPoints[Math.min(initialSnapPoint, snapPoints.length - 1)] * windowHeight;
			animateTo(target);
		}
	}

	function close() {
		open = false;
		onClose?.();
	}

	$effect(() => {
		if (open) {
			if (drawerHeight === 0 && windowHeight > 0) {
				openDrawer();
			}
		} else {
			drawerHeight = 0;
		}
	});

	function updateWindowHeight() {
		windowHeight = window.innerHeight;
		if (open && drawerHeight > 0) {
			snapToNearest();
		}
	}
</script>

<svelte:window on:resize={updateWindowHeight} bind:innerHeight={windowHeight} />

{#if open}
	<div
		class="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
		transition:fade={{ duration: 200 }}
		onclick={close}
		aria-hidden="true"
	></div>

	<div
		bind:this={drawerElement}
		class={cn(
			'fixed right-0 bottom-0 left-0 z-50 flex flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl transition-all duration-300 ease-out will-change-[height]',
			className,
		)}
		style="height: {drawerHeight}px; {isDragging ? 'transition: none;' : ''}"
	>
		<div
			class="flex w-full cursor-grab touch-none items-center justify-center p-4 active:cursor-grabbing"
			ontouchstart={handleTouchStart}
		>
			<div class="h-1.5 w-12 rounded-full bg-gray-300"></div>
		</div>

		<div class="flex-1 overflow-y-auto px-4 pb-8">
			{@render children?.()}
		</div>
	</div>
{/if}
