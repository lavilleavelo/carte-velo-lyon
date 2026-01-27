<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import { searchPanoramaxPhoto } from '$lib/utils/panoramax';
	import * as Dialog from '$lib/components/ui/dialog';

	interface Props {
		coordinates: [number, number] | null;
		onClose: () => void;
	}

	let { coordinates, onClose }: Props = $props();

	const panoramaxQuery = createQuery(() => ({
		queryKey: ['panoramax', coordinates],
		queryFn: async () => {
			if (!coordinates) return null;
			return await searchPanoramaxPhoto(coordinates);
		},
		enabled: coordinates !== null,
		retry: 1,
	}));
</script>

<Dialog.Root
	open={true}
	onOpenChange={(open) => {
		if (!open) onClose();
	}}
>
	<Dialog.Content
		class="flex h-[90vh] w-[calc(100%-2rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none xl:max-w-7xl"
		showCloseButton={true}
	>
		<Dialog.Header class="shrink-0 border-b border-gray-200 px-4 py-3">
			<Dialog.Title class="flex items-center gap-2">
				<span>Panoramax</span>
				{#if panoramaxQuery.data?.datetime}
					<span class="text-sm font-normal text-gray-500">
						— {new Date(panoramaxQuery.data.datetime).toLocaleDateString('fr-FR', {
							day: 'numeric',
							month: 'long',
							year: 'numeric',
						})}
					</span>
				{/if}
			</Dialog.Title>
		</Dialog.Header>

		<div class="min-h-0 flex-1">
			{#if panoramaxQuery.isLoading}
				<div class="flex h-full items-center justify-center">
					<div class="text-center">
						<div class="mb-2 text-gray-600">Chargement de la photo panoramax...</div>
						<div
							class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent"
						></div>
					</div>
				</div>
			{:else if panoramaxQuery.isError}
				<div class="flex h-full items-center justify-center">
					<div class="text-center text-red-600">
						<p class="mb-2 text-lg font-semibold">Erreur</p>
						<p class="text-sm">
							{panoramaxQuery.error?.message || 'Impossible de charger la photo panoramax'}
						</p>
					</div>
				</div>
			{:else if panoramaxQuery.data}
				<iframe
					src="https://api.panoramax.xyz/#focus=pic&pic={panoramaxQuery.data.picture}"
					class="h-full w-full border-0"
					title="Panoramax Viewer"
				></iframe>
			{:else}
				<div class="flex h-full items-center justify-center">
					<div class="text-center text-gray-600">
						<p class="mb-2 text-lg font-semibold">Aucune image disponible</p>
						<p class="text-sm">
							Aucune photo panoramax n'a été trouvée à proximité de cet emplacement.
						</p>
					</div>
				</div>
			{/if}
		</div>

		{#if coordinates}
			<Dialog.Footer class="shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-3">
				<div class="flex w-full flex-row flex-nowrap items-center justify-center gap-1 sm:gap-2">
					<a
						href="https://www.google.com/maps/@{coordinates[1]},{coordinates[0]},19z"
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center justify-center gap-1 rounded-md bg-white px-2 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
					>
						<span class="whitespace-nowrap">Google Maps</span>
						<ExternalLink class="size-3.5 sm:size-4" />
					</a>
					<a
						href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coordinates[1]},${coordinates[0]}`}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center justify-center gap-1 rounded-md bg-white px-2 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
					>
						<span class="whitespace-nowrap">Street View</span>
						<ExternalLink class="size-3.5 sm:size-4" />
					</a>
					<a
						href="https://api.panoramax.xyz/?focus=map&map=19/{coordinates[1]}/{coordinates[0]}{panoramaxQuery.data
							? `&pic=${panoramaxQuery.data.picture}`
							: ''}"
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center justify-center gap-1 rounded-md bg-white px-2 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
					>
						<span class="whitespace-nowrap">Panoramax</span>
						<ExternalLink class="size-3.5 sm:size-4" />
					</a>
				</div>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
