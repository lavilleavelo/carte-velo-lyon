<script lang="ts">
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import {
		navigationProviders,
		getProvider,
		getProviderUrl,
	} from '$lib/config/navigationProviders';

	let {
		lat,
		lng,
		defaultProviderId,
		onOpenSettings,
		extraLinks = [],
		primaryOverride,
	}: {
		lat: number;
		lng: number;
		defaultProviderId: string;
		onOpenSettings?: () => void;
		extraLinks?: { label: string; url: string }[];
		primaryOverride?: { label: string; shortLabel: string; url: string };
	} = $props();

	let showAll = $state(false);

	const defaultProvider = $derived(getProvider(defaultProviderId));
	const otherProviders = $derived(
		primaryOverride
			? navigationProviders
			: navigationProviders.filter((p) => p.id !== defaultProviderId),
	);
	const primaryHref = $derived(
		primaryOverride ? primaryOverride.url : getProviderUrl(defaultProvider, lat, lng),
	);
	const defaultLabel = $derived.by(() => {
		if (primaryOverride) return `Ouvrir dans ${primaryOverride.shortLabel}`;
		if (defaultProvider.id === 'geo') return 'Ouvrir...';
		return `Ouvrir dans ${defaultProvider.shortLabel}`;
	});
</script>

<svelte:window
	onclick={() => {
		if (showAll) showAll = false;
	}}
/>

<div class="flex flex-col gap-1">
	<div class="relative flex gap-1.5">
		<a
			href={primaryHref}
			target="_blank"
			rel="noopener noreferrer"
			class="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-100 hover:text-gray-900 active:scale-[0.98]"
		>
			<MapPin size={15} />
			<span>{defaultLabel}</span>
		</a>
		<button
			onclick={(e) => {
				e.stopPropagation();
				showAll = !showAll;
			}}
			class="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
			title="Autres applications"
		>
			<Ellipsis size={16} />
		</button>

		{#if showAll}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				onclick={(e) => e.stopPropagation()}
				class="absolute right-0 bottom-full z-50 mb-1 w-48 rounded-lg bg-white p-1 shadow-lg ring-1 ring-black/5"
			>
				{#each extraLinks as link}
					<a
						href={link.url}
						target="_blank"
						rel="noopener noreferrer"
						class="flex w-full items-center rounded-md px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50"
					>
						{link.label}
					</a>
				{/each}
				{#if extraLinks.length > 0}
					<div class="my-1 border-t border-gray-100"></div>
				{/if}
				{#each otherProviders as provider}
					<a
						href={getProviderUrl(provider, lat, lng)}
						target="_blank"
						rel="noopener noreferrer"
						class="flex w-full items-center rounded-md px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
					>
						{provider.label}
					</a>
				{/each}
			</div>
		{/if}
	</div>
	{#if onOpenSettings}
		<button
			onclick={onOpenSettings}
			class="self-center text-[11px] text-gray-400 transition-colors hover:text-gray-600 hover:underline"
		>
			Changer l'application par défaut
		</button>
	{/if}
</div>
