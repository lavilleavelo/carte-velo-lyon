<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { searchPanoramaxPhoto } from '$lib/utils/panoramax';
	import PanoramaxViewer from '$lib/components/PanoramaxViewer.svelte';
	import MapIcon from '@lucide/svelte/icons/map';
	import Globe from '@lucide/svelte/icons/globe';
	import User from '@lucide/svelte/icons/user';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import Camera from '@lucide/svelte/icons/camera';

	interface Props {
		visible: boolean;
		x: number;
		y: number;
		lngLat: { lng: number; lat: number } | null;
		zoom?: number;
		onClose: () => void;
	}

	let { visible, x, y, lngLat, zoom = 13, onClose }: Props = $props();

	let showPanoramaxViewer = $state(false);
	let menuElement: HTMLDivElement | undefined = $state();

	let adjustedPosition = $derived.by(() => {
		const menuWidth = 320; // w-80 = 20rem = 320px
		const menuHeight = menuElement?.offsetHeight ?? 300;
		const padding = 8;

		let adjustedX = x;
		let adjustedY = y;

		if (typeof window !== 'undefined') {
			if (x + menuWidth + padding > window.innerWidth) {
				adjustedX = x - menuWidth;
			}
			if (y + menuHeight + padding > window.innerHeight) {
				adjustedY = y - menuHeight;
			}
			adjustedX = Math.max(padding, adjustedX);
			adjustedY = Math.max(padding, adjustedY);
		}

		return { x: adjustedX, y: adjustedY };
	});

	const panoramaxQuery = createQuery(() => ({
		queryKey: ['panoramax-context-menu', lngLat?.lng, lngLat?.lat],
		queryFn: async () => {
			if (!lngLat) return null;
			return await searchPanoramaxPhoto([lngLat.lng, lngLat.lat]);
		},
		enabled: visible && lngLat !== null,
		retry: 1,
	}));

	function openPanoramaxViewer() {
		showPanoramaxViewer = true;
	}

	function closePanoramaxViewer() {
		showPanoramaxViewer = false;
	}

	function openInPanoramax() {
		if (lngLat) {
			const url = `https://api.panoramax.xyz/?focus=map&map=18/${lngLat.lat}/${lngLat.lng}`;
			window.open(url, '_blank');
		}
		onClose();
	}

	function openInOpenStreetMap() {
		if (lngLat) {
			const url = `https://www.openstreetmap.org/query?mlat=${lngLat.lat}&mlon=${lngLat.lng}#map=19/${lngLat.lat}/${lngLat.lng}`;
			window.open(url, '_blank');
		}
		onClose();
	}

	function openInGoogleStreetView() {
		if (lngLat) {
			const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lngLat.lat},${lngLat.lng}`;
			window.open(url, '_blank');
		}
		onClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

{#if showPanoramaxViewer && lngLat}
	<PanoramaxViewer coordinates={[lngLat.lng, lngLat.lat]} onClose={closePanoramaxViewer} />
{/if}

{#if visible}
	<div
		class="fixed inset-0 z-20"
		role="button"
		tabindex="-1"
		onclick={onClose}
		onkeydown={handleKeydown}
		oncontextmenu={(e) => {
			e.preventDefault();
			onClose();
		}}
	></div>
	<div
		bind:this={menuElement}
		class="fixed z-30 w-80 rounded-lg border border-gray-200 bg-white shadow-lg"
		style="left: {adjustedPosition.x}px; top: {adjustedPosition.y}px;"
	>
		{#if panoramaxQuery.isLoading}
			<div class="flex h-24 items-center justify-center text-gray-500">
				<div class="text-center">
					<Loader2 class="mx-auto mb-2 h-6 w-6 animate-spin" />
					<div class="text-sm">Chargement de la photo...</div>
				</div>
			</div>
		{:else if panoramaxQuery.isError || !panoramaxQuery.data}
			<div class="flex h-24 items-center justify-center text-sm text-gray-500">
				<div class="text-center">
					<Camera class="mx-auto mb-2 h-6 w-6" />
					<div>Aucune photo disponible</div>
				</div>
			</div>
		{:else if panoramaxQuery.data}
			<button
				onclick={openPanoramaxViewer}
				class="w-full cursor-pointer overflow-hidden rounded-t-lg focus:ring-2 focus:ring-blue-500 focus:outline-none focus:ring-inset"
			>
				<img
					src={panoramaxQuery.data.linkSelf}
					alt="Panoramax street view"
					class="w-full transition-transform hover:scale-105"
				/>
			</button>
		{/if}

		<div class="py-1">
			<button
				onclick={openInPanoramax}
				class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-900"
			>
				<MapIcon class="h-4 w-4" />
				Ouvrir dans Panoramax
			</button>
			<button
				onclick={openInOpenStreetMap}
				class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-900"
			>
				<Globe class="h-4 w-4" />
				Ouvrir dans OpenStreetMap
			</button>
			<button
				onclick={openInGoogleStreetView}
				class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-900"
			>
				<User class="h-4 w-4" />
				Ouvrir dans Google Street View
			</button>
			{#if lngLat}
				<div class="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
					{lngLat.lat.toFixed(5)}, {lngLat.lng.toFixed(5)}
				</div>
			{/if}
		</div>
	</div>
{/if}
