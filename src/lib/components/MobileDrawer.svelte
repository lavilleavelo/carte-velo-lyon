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
		closeLabel = 'Fermer',
		dismissible = true,
		peek = false,
		fit = false,
		header,
		children,
		class: className,
		onClose,
	}: {
		open?: boolean;
		snapPoints?: number[];
		initialSnapPoint?: number;
		backdrop?: boolean;
		closeButton?: boolean;
		closeLabel?: string;
		dismissible?: boolean;
		peek?: boolean;
		fit?: boolean;
		header?: Snippet;
		children?: Snippet;
		class?: string;
		onClose?: () => void;
	} = $props();

	const GRABBER_HEIGHT = 28;
	const BODY_PADDING = 24;
	const TAP_SLOP = 6;
	const FLICK_VELOCITY = 0.5;
	const FLICK_MAX_PAUSE_MS = 100;
	const CLICK_SUPPRESS_MS = 350;

	let windowHeight = $state(0);
	let headerHeight = $state(0);
	let bodyHeight = $state(0);
	let snapIndex = $state(0);
	let dragHeight: number | null = $state(null);
	let sheetElement: HTMLDivElement | undefined = $state();
	let startY = 0;
	let startHeight = 0;
	let lastY = 0;
	let lastTime = 0;
	let velocity = 0;
	let moved = false;
	let suppressClickUntil = 0;
	let wasOpen = false;

	const hasPeek = $derived(peek && !!header);
	const snapHeights = $derived.by(() => {
		const contentHeight = GRABBER_HEIGHT + headerHeight + bodyHeight + BODY_PADDING;
		const heights = snapPoints
			.map((point) => point * windowHeight)
			.map((height) => (fit && bodyHeight > 0 ? Math.min(height, contentHeight) : height))
			.sort((a, b) => a - b);

		return hasPeek ? [GRABBER_HEIGHT + headerHeight, ...heights] : heights;
	});
	const settledHeight = $derived(snapHeights[Math.min(snapIndex, snapHeights.length - 1)] ?? 0);
	const drawerHeight = $derived(dragHeight ?? settledHeight);
	const expanded = $derived(drawerHeight >= (snapHeights[snapHeights.length - 1] ?? 0) - 1);

	$effect(() => {
		if (open && !wasOpen) {
			snapIndex = initialSnapPoint + (hasPeek ? 1 : 0);
		}
		wasOpen = open;
	});

	function beginDrag(clientY: number) {
		dragHeight = settledHeight;
		moved = false;
		startY = clientY;
		lastY = clientY;
		startHeight = settledHeight;
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

		const lowest = dismissible ? Math.min(60, snapHeights[0] ?? 60) : (snapHeights[0] ?? 0) - 16;
		dragHeight = Math.max(lowest, Math.min(startHeight + startY - clientY, windowHeight));
	}

	function endDrag() {
		const height = dragHeight;
		if (height === null) {
			return;
		}

		dragHeight = null;
		if (!moved) {
			return;
		}

		suppressClickUntil = performance.now() + CLICK_SUPPRESS_MS;
		const speed = performance.now() - lastTime > FLICK_MAX_PAUSE_MS ? 0 : velocity;
		const last = snapHeights.length - 1;

		if (speed > FLICK_VELOCITY) {
			const above = snapHeights.findIndex((snap) => snap > height + 1);
			snapIndex = above < 0 ? last : above;
			return;
		}

		if (speed < -FLICK_VELOCITY) {
			const below = snapHeights.findLastIndex((snap) => snap < height - 1);
			if (below >= 0) {
				snapIndex = below;
			} else if (dismissible) {
				close();
			} else {
				snapIndex = 0;
			}
			return;
		}

		let nearest = 0;
		for (let index = 1; index <= last; index += 1) {
			if (Math.abs(snapHeights[index] - height) < Math.abs(snapHeights[nearest] - height)) {
				nearest = index;
			}
		}

		if (dismissible && height < snapHeights[nearest] / 2) {
			close();
		} else {
			snapIndex = nearest;
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
		if (dragHeight !== null && (e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
			drag(e.clientY);
		}
	}

	export function snapTo(index: number) {
		snapIndex = Math.min(Math.max(index, 0), snapHeights.length - 1);
	}

	function toggle() {
		if (performance.now() < suppressClickUntil) {
			return;
		}

		const above = snapHeights.findIndex((snap) => snap > settledHeight + 1);
		snapIndex = above < 0 ? 0 : above;
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
		const element = sheetElement;
		if (!element) {
			return;
		}

		let mode: 'pending' | 'sheet' | 'native' = 'native';
		let x0 = 0;
		let y0 = 0;

		const onStart = (e: TouchEvent) => {
			const onGrabber = (e.target as HTMLElement | null)?.closest('[data-drawer-grabber]');
			mode = e.touches.length === 1 && !onGrabber ? 'pending' : 'native';
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

	let scrollElement: HTMLDivElement | undefined = $state();
	$effect(() => {
		if (!expanded && dragHeight === null && scrollElement) {
			scrollElement.scrollTop = 0;
		}
	});

	function close() {
		open = false;
		onClose?.();
	}
</script>

<svelte:window bind:innerHeight={windowHeight} />

{#snippet closeControl(extraClass: string)}
	<button
		type="button"
		onclick={close}
		aria-label={closeLabel}
		title={closeLabel}
		class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 {extraClass}"
	>
		<X size={16} />
	</button>
{/snippet}

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
		bind:this={sheetElement}
		class={cn(
			'fixed right-0 bottom-0 left-0 z-50 flex flex-col overflow-hidden rounded-t-2xl bg-white transition-[height] duration-300 ease-out will-change-[height]',
			backdrop ? 'shadow-2xl' : 'border-t border-gray-200 shadow-[0_-6px_24px_rgba(0,0,0,0.18)]',
			className,
		)}
		style="height: {drawerHeight}px; {dragHeight !== null ? 'transition: none;' : ''}"
	>
		<button
			type="button"
			data-drawer-grabber
			class="flex w-full shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
			style="height: {GRABBER_HEIGHT}px"
			aria-label={snapHeights.length < 2
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
			<span class="h-1.5 w-10 rounded-full bg-gray-300"></span>
		</button>

		{#if header}
			<div bind:clientHeight={headerHeight} class="flex shrink-0 items-center gap-3 px-4 pb-3">
				<div class="min-w-0 flex-1">{@render header()}</div>
				{#if closeButton}
					{@render closeControl('')}
				{/if}
			</div>
		{:else if closeButton}
			{@render closeControl('absolute top-1 right-1.5 z-10')}
		{/if}

		<div
			bind:this={scrollElement}
			class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-6"
		>
			<div bind:clientHeight={bodyHeight}>
				{@render children?.()}
			</div>
		</div>
	</div>
{/if}
