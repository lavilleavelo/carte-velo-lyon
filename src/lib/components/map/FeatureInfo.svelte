<script lang="ts">
	import VelovDetails from './details/VelovDetails.svelte';
	import ParkingDetails from './details/ParkingDetails.svelte';
	import VoieLyonnaiseDetails from './details/VoieLyonnaiseDetails.svelte';
	import CyclewayDetails from './details/CyclewayDetails.svelte';
	import PumpDetails from './details/PumpDetails.svelte';
	import WaterFountainDetails from './details/WaterFountainDetails.svelte';
	import DefaultDetails from './details/DefaultDetails.svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Map from '@lucide/svelte/icons/map';
	import { searchPanoramaxPhoto } from '$lib/utils/panoramax';
	import { createQuery } from '@tanstack/svelte-query';

	let { features = [], coordinates, onClose, onOpenPanoramax, onPhotoHover } = $props();

	let currentIndex = $state(0);
	let selectedFeature = $derived(features[currentIndex]);

	function getComponent(type: string) {
		if (type === 'velov') return VelovDetails;
		if (type === 'parking') return ParkingDetails;
		if (type === 'cycleway') return CyclewayDetails;
		if (type === 'pump') return PumpDetails;
		if (type === 'water-fountain') return WaterFountainDetails;
		if (type && type.startsWith('vl-')) return VoieLyonnaiseDetails;
		return DefaultDetails;
	}

	function nextFeature() {
		currentIndex = (currentIndex + 1) % features.length;
	}

	function prevFeature() {
		currentIndex = (currentIndex - 1 + features.length) % features.length;
	}

	const panoramaxQuery = createQuery(() => ({
		queryKey: ['panoramax-preview', coordinates],
		queryFn: async () => {
			if (!coordinates) return null;
			try {
				return await searchPanoramaxPhoto([coordinates.lng, coordinates.lat]);
			} catch (e) {
				return null;
			}
		},
		enabled: !!coordinates,
		retry: false,
	}));

	$effect(() => {
		return () => {
			if (onPhotoHover) onPhotoHover(null);
		};
	});
</script>

<div
	class="flex w-full flex-col overflow-hidden bg-white/95 backdrop-blur-sm md:max-w-sm md:rounded-xl md:border md:border-gray-100 md:shadow-xl"
>
	{#if panoramaxQuery.data}
		<button
			onclick={onOpenPanoramax}
			onmouseenter={() => {
				if (onPhotoHover && panoramaxQuery.data?.coordinates) {
					onPhotoHover({
						lng: panoramaxQuery.data.coordinates[0],
						lat: panoramaxQuery.data.coordinates[1],
					});
				}
			}}
			onmouseleave={() => {
				if (onPhotoHover) onPhotoHover(null);
			}}
			class="group relative h-40 w-full shrink-0 overflow-hidden bg-gray-100"
		>
			<img
				src={panoramaxQuery.data.thumbPicture}
				alt="Aperçu Panoramax"
				class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
			/>
			<div class="absolute inset-0 bg-linear-to-t from-black/50 to-transparent opacity-60"></div>
			<div class="absolute bottom-2 left-3 flex items-center gap-1.5 text-white/90">
				<span class="text-xs font-bold tracking-wider uppercase">Panoramax</span>
				<ExternalLink size={12} />
			</div>
		</button>
	{/if}

	<div class="absolute top-0 left-0 z-10 flex w-full items-center justify-between p-2">
		{#if features.length > 1}
			<div class="flex items-center gap-1 rounded-full bg-white/80 p-1 shadow-sm backdrop-blur-md">
				<button
					onclick={prevFeature}
					class="rounded-full p-1 text-gray-700 hover:bg-black/5"
					aria-label="Précédent"
				>
					<ChevronLeft size={16} />
				</button>
				<span class="min-w-[30px] text-center text-xs font-bold text-gray-700">
					{currentIndex + 1} / {features.length}
				</span>
				<button
					onclick={nextFeature}
					class="rounded-full p-1 text-gray-700 hover:bg-black/5"
					aria-label="Suivant"
				>
					<ChevronRight size={16} />
				</button>
			</div>
		{:else}
			<div></div>
		{/if}

		<button
			onclick={onClose}
			class="rounded-full bg-white/80 p-2 text-gray-500 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-gray-900"
			aria-label="Fermer"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	</div>

	<div
		class="flex max-h-[60vh] flex-col overflow-y-auto md:max-h-[400px]"
		class:pt-12={!panoramaxQuery.data}
	>
		<div class="p-4">
			{#if selectedFeature}
				{@const Component = getComponent(selectedFeature.type)}
				<Component properties={selectedFeature.properties} />
			{/if}

			{#if coordinates}
				<div class="mt-2 pt-2">
					<a
						href={`https://www.openstreetmap.org/query?lat=${coordinates.lat}&lon=${coordinates.lng}&mlat=${coordinates.lat}&mlon=${coordinates.lng}#map=19/${coordinates.lat}/${coordinates.lng}`}
						target="_blank"
						rel="noopener noreferrer"
						class="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-100 hover:text-gray-900 active:scale-[0.98]"
					>
						<Map size={16} />
						<span>Voir sur OpenStreetMap</span>
					</a>
				</div>
			{/if}
		</div>
	</div>
</div>
