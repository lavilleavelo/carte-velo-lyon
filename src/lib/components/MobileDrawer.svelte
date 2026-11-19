<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import X from '@lucide/svelte/icons/x';
	import { cn } from '$lib/utils';

	let {
		open = $bindable(false),
		snapPoints = [0.4, 0.9], // Percentages of screen height (e.g., 0.5 = 50%)
		initialSnapPoint = 0,
		backdrop = true,
		closeButton = false,
		dismissible = true,
		children,
		class: className,
		onClose,
	}: {
		open?: boolean;
		snapPoints?: number[];
		initialSnapPoint?: number;
		backdrop?: boolean;
		closeButton?: boolean;
		dismissible?: boolean;
		children?: Snippet;
		class?: string;
		onClose?: () => void;
	} = $props();

	const MIN_HEIGHT = 100;
	const TAP_SLOP = 6;
	const FLICK_VELOCITY = 0.5;
	const FLICK_MAX_PAUSE_MS = 100;
	const CLICK_SUPPRESS_MS = 350;

	let drawerHeight = $state(0);
	let isDragging = $state(false);
	let windowHeight = $state(0);
	let contentElement: HTMLDivElement | undefined = $state();
	let startY = 0;
	let startHeight = 0;
	let lastY = 0;
	let lastTime = 0;
	let velocity = 0;
	let moved = false;
	let suppressClickUntil = 0;

	const snapHeights = $derived(snapPoints.map((p) => p * windowHeight));
	const maxSnap = $derived(Math.max(...snapHeights));
	const expanded = $derived(drawerHeight >= maxSnap - 1);

	function beginDrag(clientY: number) {
		isDragging = true;
		moved = false;
		startY = clientY;
		lastY = clientY;
		startHeight = drawerHeight;
		lastTime = performance.now();
		velocity = 0;
	}

	function drag(clientY: number) {
		const now = performance.now();
		if (now > lastTime) {
			velocity = 0.6 * ((lastY - clientY) / (now - lastTime)) + 0.4 * velocity;
		}
		lastY = clientY;
		lastTime = now;
		if (Math.abs(clientY - startY) > TAP_SLOP) {
			moved = true;
		}
		drawerHeight = Math.max(MIN_HEIGHT, Math.min(startHeight + startY - clientY, windowHeight));
	}

	function endDrag() {
		if (!isDragging) {
			return;
		}

		isDragging = false;
		if (!moved) {
			drawerHeight = startHeight;
			return;
		}

		suppressClickUntil = performance.now() + CLICK_SUPPRESS_MS;
		const speed = performance.now() - lastTime > FLICK_MAX_PAUSE_MS ? 0 : velocity;
		const sorted = [...snapHeights].sort((a, b) => a - b);

		if (speed > FLICK_VELOCITY) {
			drawerHeight = sorted.find((h) => h > drawerHeight + 1) ?? sorted[sorted.length - 1];
		} else if (speed < -FLICK_VELOCITY) {
			const below = sorted.filter((h) => h < drawerHeight - 1);
			if (below.length > 0) {
				drawerHeight = below[below.length - 1];
			} else if (dismissible) {
				close();
			} else {
				drawerHeight = sorted[0];
			}
		} else {
			snapToNearest();
		}
	}

	function handlePointerDown(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) {
			return;
		}

		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		beginDrag(e.clientY);
	}

	function handlePointerMove(e: PointerEvent) {
		if (isDragging && (e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
			drag(e.clientY);
		}
	}

	export function snapTo(index: number) {
		if (open && windowHeight > 0) {
			const sorted = [...snapHeights].sort((a, b) => a - b);
			drawerHeight = sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
		}
	}

	function toggle() {
		if (performance.now() < suppressClickUntil) {
			return;
		}

		const sorted = [...snapHeights].sort((a, b) => a - b);
		drawerHeight = sorted.find((h) => h > drawerHeight + 1) ?? sorted[0];
	}

	function isScrolled(target: EventTarget | null, root: HTMLElement): boolean {
		for (let node = target as HTMLElement | null; node; node = node.parentElement) {
			if (node.scrollTop > 0) {
				return true;
			}

			if (node === root) {
				break;
			}
		}

		return false;
	}

	$effect(() => {
		const element = contentElement;
		if (!element) {
			return;
		}

		let mode: 'pending' | 'sheet' | 'native' = 'native';
		let x0 = 0;
		let y0 = 0;

		const onStart = (e: TouchEvent) => {
			mode = e.touches.length === 1 ? 'pending' : 'native';
			x0 = e.touches[0].clientX;
			y0 = e.touches[0].clientY;
		};

		const onMove = (e: TouchEvent) => {
			if (mode === 'native') {
				return;
			}

			const touch = e.touches[0];
			if (mode === 'pending') {
				const dx = touch.clientX - x0;
				const dy = touch.clientY - y0;
				const vertical = Math.abs(dy) > Math.abs(dx);
				const takesSheet = vertical && (!expanded || (dy > 0 && !isScrolled(e.target, element)));
				if (!takesSheet || !e.cancelable) {
					mode = 'native';
					return;
				}

				mode = 'sheet';
				beginDrag(y0);
			}

			e.preventDefault();
			drag(touch.clientY);
		};

		const onEnd = () => {
			if (mode === 'sheet') {
				endDrag();
			}
			mode = 'native';
		};

		element.addEventListener('touchstart', onStart, { passive: true });
		element.addEventListener('touchmove', onMove, { passive: false });
		element.addEventListener('touchend', onEnd);
		element.addEventListener('touchcancel', onEnd);

		return () => {
			element.removeEventListener('touchstart', onStart);
			element.removeEventListener('touchmove', onMove);
			element.removeEventListener('touchend', onEnd);
			element.removeEventListener('touchcancel', onEnd);
		};
	});

	function snapToNearest() {
		const currentH = drawerHeight;
		const thresholds = dismissible ? [0, ...snapHeights] : snapHeights;

		let closest = thresholds[0];
		let minDiff = Math.abs(currentH - closest);

		for (const h of thresholds) {
			const diff = Math.abs(currentH - h);
			if (diff < minDiff) {
				minDiff = diff;
				closest = h;
			}
		}

		if (closest < MIN_HEIGHT) {
			close();
		} else {
			drawerHeight = closest;
		}
	}

	function openDrawer() {
		if (windowHeight > 0) {
			drawerHeight = snapPoints[Math.min(initialSnapPoint, snapPoints.length - 1)] * windowHeight;
		}
	}

	function close() {
		open = false;
		onClose?.();
	}

	$effect(() => {
		if (!expanded && !isDragging && contentElement) {
			contentElement.scrollTop = 0;
		}
	});

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

<svelte:window onresize={updateWindowHeight} bind:innerHeight={windowHeight} />

{#if open}
	{#if backdrop}
		<div
			class="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
			transition:fade={{ duration: 200 }}
			onclick={close}
			aria-hidden="true"
		></div>
	{/if}

	<div
		class={cn(
			'fixed right-0 bottom-0 left-0 z-50 flex flex-col overflow-hidden rounded-t-2xl bg-white transition-all duration-300 ease-out will-change-[height]',
			backdrop ? 'shadow-2xl' : 'border-t border-gray-200 shadow-[0_-6px_24px_rgba(0,0,0,0.18)]',
			className,
		)}
		style="height: {drawerHeight}px; {isDragging ? 'transition: none;' : ''}"
	>
		<button
			type="button"
			class="flex h-9 w-full shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
			aria-label={snapPoints.length < 2
				? 'Déplacer le panneau'
				: expanded
					? 'Réduire le panneau'
					: 'Agrandir le panneau'}
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={endDrag}
			onpointercancel={endDrag}
			onclick={toggle}
		>
			<span class="h-1.5 w-12 rounded-full bg-gray-300"></span>
		</button>

		{#if closeButton}
			<button
				type="button"
				onclick={close}
				aria-label="Fermer"
				class="absolute top-1 right-1.5 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
			>
				<X size={14} />
			</button>
		{/if}

		<div bind:this={contentElement} class="flex-1 overflow-y-auto overscroll-contain px-2 pb-6">
			{@render children?.()}
		</div>
	</div>
{/if}
