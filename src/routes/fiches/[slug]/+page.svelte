<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import MousePointerClick from '@lucide/svelte/icons/mouse-pointer-click';
	import FicheMap from '$lib/components/FicheMap.svelte';
	import LavilleaveloCta from '$lib/components/LavilleaveloCta.svelte';
	import { getFiche } from '$lib/content/fiches';
	import { error } from '@sveltejs/kit';

	let { data } = $props();
	const fiche = $derived.by(() => {
		const f = getFiche(data.slug);
		if (!f) {
			throw error(404, 'Fiche introuvable');
		}
		return f;
	});

	const Body = $derived(fiche.body);
	let panoramaxActive = $state(false);
	const hasLocation = $derived(typeof fiche.lng === 'number' && typeof fiche.lat === 'number');

	const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	});

	const updatedLabel = $derived.by(() => {
		const u = fiche.updated;
		if (!u) {
			return null;
		}

		const d = u instanceof Date ? u : new Date(u);
		if (Number.isNaN(d.getTime())) {
			return String(u);
		}

		return dateFormatter.format(d);
	});

	const mapHref = $derived(
		hasLocation ? `/?lng=${fiche.lng}&lat=${fiche.lat}&zoom=${fiche.zoom ?? 17}` : '/',
	);

	const SCHEMA_TYPE_BY_FICHE_TYPE: Record<string, string> = {
		parking: 'BicycleParking',
		velov: 'BikeStore',
	};

	const jsonLd = $derived.by(() => {
		const schema: Record<string, unknown> = {
			'@context': 'https://schema.org',
			'@type': SCHEMA_TYPE_BY_FICHE_TYPE[fiche.type] ?? 'Place',
			name: fiche.title,
			description: fiche.summary ?? fiche.subtitle ?? fiche.title,
		};

		if (fiche.address) {
			schema.address = fiche.address;
		}

		if (hasLocation) {
			schema.geo = {
				'@type': 'GeoCoordinates',
				latitude: fiche.lat,
				longitude: fiche.lng,
			};
		}

		if (fiche.photos?.length) {
			schema.image = fiche.photos.map((p) => p.url);
		}

		return JSON.stringify(schema);
	});
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

<div class="space-y-6 pb-4">
	{#if hasLocation}
		<div class="mx-[calc(50%-50vw)]">
			<FicheMap
				lng={fiche.lng!}
				lat={fiche.lat!}
				zoom={fiche.zoom ?? 16}
				name={fiche.title}
				osmId={fiche.osmId}
			/>
		</div>
	{/if}

	<div class="mx-auto max-w-3xl space-y-6">
		<a
			href={mapHref}
			class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-navy"
		>
			<ArrowLeft size={14} />
			Retour à la carte
		</a>

		<header class="space-y-2">
			<h1 class="text-2xl font-bold text-brand-navy md:text-3xl">{fiche.title}</h1>
			{#if fiche.subtitle}
				<p class="text-lg text-gray-600">{fiche.subtitle}</p>
			{/if}
			{#if fiche.address}
				<p class="flex items-center gap-1.5 text-sm text-gray-500">
					<MapPin size={14} />
					{fiche.address}
				</p>
			{/if}
		</header>

		{#if fiche.summary}
			<p class="text-lg text-gray-700">{fiche.summary}</p>
		{/if}

		{#if fiche.photos && fiche.photos.length > 0}
			<section class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{#each fiche.photos as photo (photo.url)}
					<figure class="flex flex-col gap-1.5">
						<a
							href={photo.url}
							target="_blank"
							rel="noopener"
							class="block overflow-hidden rounded-lg shadow ring-1 ring-gray-200 transition-shadow hover:shadow-lg"
						>
							<img
								src={photo.url}
								alt={photo.alt ?? photo.caption ?? ''}
								loading="lazy"
								class="aspect-[4/3] w-full object-cover"
							/>
						</a>
						{#if photo.caption || photo.credit}
							<figcaption class="text-xs text-gray-500">
								{#if photo.caption}<span>{photo.caption}</span>{/if}
								{#if photo.caption && photo.credit}<span> · </span>{/if}
								{#if photo.credit}
									{#if photo.creditUrl}
										<a href={photo.creditUrl} target="_blank" rel="noopener" class="hover:underline"
											>{photo.credit}</a
										>
									{:else}
										<span>{photo.credit}</span>
									{/if}
								{/if}
							</figcaption>
						{/if}
					</figure>
				{/each}
			</section>
		{/if}

		{#if fiche.panoramax}
			<section class="space-y-2">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-bold tracking-wide text-gray-500 uppercase">Vue immersive</h2>
					<a
						href={fiche.panoramax}
						target="_blank"
						rel="noopener"
						class="inline-flex items-center gap-1 text-xs font-semibold text-brand-navy hover:underline"
					>
						Ouvrir sur Panoramax
						<ExternalLink size={12} />
					</a>
				</div>
				<div
					role="presentation"
					class="relative overflow-hidden rounded-lg shadow ring-1 ring-gray-200"
					onmouseleave={() => (panoramaxActive = false)}
				>
					<iframe
						src={fiche.panoramax}
						title="Vue Panoramax — {fiche.title}"
						loading="lazy"
						class="aspect-[16/10] w-full border-0"
						class:pointer-events-none={!panoramaxActive}
					></iframe>
					{#if !panoramaxActive}
						<button
							type="button"
							onclick={() => (panoramaxActive = true)}
							class="absolute inset-0 flex items-center justify-center bg-black/20 text-white transition-colors hover:bg-black/30"
						>
							<span
								class="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-gray-800 shadow-lg"
							>
								<MousePointerClick size={16} />
								Cliquez pour activer la vue immersive
							</span>
						</button>
					{/if}
				</div>
			</section>
		{/if}

		<div class="prose prose-lg max-w-none text-gray-700">
			<Body />
		</div>

		{#if fiche.links && fiche.links.length > 0}
			<section class="rounded-lg border border-gray-200 bg-gray-50 p-5">
				<h2 class="mb-3 text-sm font-bold tracking-wide text-gray-500 uppercase">
					Plus d'information
				</h2>
				<ul class="flex flex-col gap-2">
					{#each fiche.links as link (link.url)}
						<li>
							<a
								href={link.url}
								target="_blank"
								rel="noopener"
								class="inline-flex items-center gap-1.5 text-brand-navy hover:underline"
							>
								{link.label}
								<ExternalLink size={14} />
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if updatedLabel}
			<p class="text-xs text-gray-400">Dernière mise à jour : {updatedLabel}</p>
		{/if}

		<LavilleaveloCta class="mt-4" />
	</div>
</div>
