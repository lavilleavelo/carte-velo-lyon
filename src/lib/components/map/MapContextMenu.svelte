<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { searchPanoramaxPhoto } from '$lib/utils/panoramax';
	import PanoramaxViewer from '$lib/components/PanoramaxViewer.svelte';
	import MapIcon from '@lucide/svelte/icons/map';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import User from '@lucide/svelte/icons/user';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import Camera from '@lucide/svelte/icons/camera';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import {
		navigationProviders,
		getProvider,
		getProviderUrl,
	} from '$lib/config/navigationProviders';

	interface Props {
		visible: boolean;
		x: number;
		y: number;
		lngLat: { lng: number; lat: number } | null;
		zoom?: number;
		defaultNavProvider: string;
		onClose: () => void;
		onPhotoFound?: (coordinates: { lng: number; lat: number; hasPhoto: boolean } | null) => void;
	}

	let {
		visible,
		x,
		y,
		lngLat,
		zoom = 13,
		defaultNavProvider,
		onClose,
		onPhotoFound,
	}: Props = $props();

	let showPanoramaxViewer = $state(false);
	let showMoreApps = $state(false);
	let menuElement: HTMLDivElement | undefined = $state();

	const defaultProvider = $derived(getProvider(defaultNavProvider));
	const otherProviders = $derived(navigationProviders.filter((p) => p.id !== defaultNavProvider));

	let adjustedPosition = $derived.by(() => {
		const menuWidth = 320;
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

	$effect(() => {
		if (!onPhotoFound) {
			return;
		}

		if (!visible || !lngLat) {
			onPhotoFound(null);
			return;
		}

		if (panoramaxQuery.isLoading) {
			onPhotoFound(null);
			return;
		}

		const coords = panoramaxQuery.data?.coordinates;
		if (coords) {
			onPhotoFound({ lng: coords[0], lat: coords[1], hasPhoto: true });
		} else {
			onPhotoFound({ lng: lngLat.lng, lat: lngLat.lat, hasPhoto: false });
		}
	});

	$effect(() => {
		if (!visible) showMoreApps = false;
	});

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

	function openInGoogleStreetView() {
		if (lngLat) {
			const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lngLat.lat},${lngLat.lng}`;
			window.open(url, '_blank');
		}
		onClose();
	}

	function openInProvider(providerId: string) {
		if (lngLat) {
			const provider = getProvider(providerId);
			window.open(getProviderUrl(provider, lngLat.lat, lngLat.lng), '_blank');
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
			<div class="flex aspect-video w-full items-center justify-center text-gray-500">
				<div class="text-center">
					<Loader2 class="mx-auto mb-2 h-6 w-6 animate-spin" />
					<div class="text-sm">Chargement de la photo...</div>
				</div>
			</div>
		{:else if panoramaxQuery.isError || !panoramaxQuery.data}
			<div class="flex aspect-video w-full items-center justify-center text-sm text-gray-500">
				<div class="text-center">
					<Camera class="mx-auto mb-2 h-6 w-6" />
					<div>Aucune photo disponible</div>
				</div>
			</div>
		{:else if panoramaxQuery.data}
			<button
				onclick={openPanoramaxViewer}
				class="block aspect-video w-full cursor-pointer overflow-hidden rounded-t-lg focus:ring-2 focus:ring-blue-500 focus:outline-none focus:ring-inset"
			>
				<img
					src={panoramaxQuery.data.linkSelf}
					alt="Panoramax street view"
					class="h-full w-full object-cover transition-transform hover:scale-105"
				/>
			</button>
		{/if}

		<div class="py-1">
			<button
				onclick={openInPanoramax}
				class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-900"
			>
				<MapIcon class="h-4 w-4" />
				Panoramax
			</button>
			<button
				onclick={openInGoogleStreetView}
				class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-900"
			>
				<User class="h-4 w-4" />
				Google Street View
			</button>

			<div class="border-t border-gray-100"></div>

			<button
				onclick={() => openInProvider(defaultNavProvider)}
				class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-900"
			>
				<MapPin class="h-4 w-4" />
				{defaultProvider.id === 'geo' ? 'Ouvrir...' : `Ouvrir dans ${defaultProvider.label}`}
			</button>

			<button
				onclick={() => (showMoreApps = !showMoreApps)}
				class="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
			>
				<ChevronDown class="h-3 w-3 transition-transform {showMoreApps ? 'rotate-180' : ''}" />
				Autres applications
			</button>

			{#if showMoreApps}
				<div class="border-t border-gray-50">
					{#each otherProviders as provider}
						<button
							onclick={() => openInProvider(provider.id)}
							class="flex w-full items-center gap-2 px-4 py-1.5 pl-8 text-left text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
						>
							{provider.label}
						</button>
					{/each}
				</div>
			{/if}

			{#if lngLat}
				<div class="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
					{lngLat.lat.toFixed(5)}, {lngLat.lng.toFixed(5)}
				</div>
			{/if}
		</div>
	</div>
{/if}
