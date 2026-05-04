<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import MousePointerClick from '@lucide/svelte/icons/mouse-pointer-click';
	import Route from '@lucide/svelte/icons/route';
	import FicheMap from '$lib/components/FicheMap.svelte';
	import ItineraireMap from '$lib/components/ItineraireMap.svelte';
	import LavilleaveloCta from '$lib/components/LavilleaveloCta.svelte';
	import { getFiche } from '$lib/content/fiches';
	import {
		ITINERAIRES_FICHE_TYPE,
		getItineraireColor,
		itineraireLayerId,
		buildCartesAppUrl,
	} from '$lib/config/itineraires';
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
	const itineraire = $derived(fiche.type === ITINERAIRES_FICHE_TYPE ? fiche : null);
	const parking = $derived(fiche.type === 'parking' ? fiche : null);
	const isItineraire = $derived(itineraire !== null);
	const hasLocation = $derived(
		parking !== null && typeof parking.lng === 'number' && typeof parking.lat === 'number',
	);
	const itineraireColor = $derived(itineraire ? getItineraireColor(itineraire) : '#1e3a5f');

	const cartesAppUrl = $derived.by(() => {
		if (!itineraire || !data.geometry) {
			return null;
		}

		return buildCartesAppUrl(itineraire, data.geometry.bbox);
	});

	const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	});

	const numberFormatter = new Intl.NumberFormat('fr-FR');

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

	function zoomForBbox(bbox: [number, number, number, number]): number {
		const dLng = Math.abs(bbox[2] - bbox[0]);
		const dLat = Math.abs(bbox[3] - bbox[1]);
		const maxExtent = Math.max(dLng, dLat);
		if (maxExtent <= 0) {
			return 12;
		}

		return Math.max(7, Math.min(14, Math.round(Math.log2(252 / maxExtent))));
	}

	const mapHref = $derived.by(() => {
		if (itineraire && data.geometry) {
			const layer = itineraireLayerId(itineraire.slug);
			const lng = (data.geometry.bbox[0] + data.geometry.bbox[2]) / 2;
			const lat = (data.geometry.bbox[1] + data.geometry.bbox[3]) / 2;
			const center = encodeURIComponent(`[${lng},${lat}]`);
			const zoom = zoomForBbox(data.geometry.bbox);
			return `/?layers=osm-cycleways,vl,${layer}&zoom=${zoom}&center=${center}`;
		}

		if (parking && typeof parking.lng === 'number' && typeof parking.lat === 'number') {
			const center = encodeURIComponent(`[${parking.lng},${parking.lat}]`);
			return `/?zoom=${parking.zoom ?? 17}&center=${center}`;
		}

		return '/';
	});

	const backHref = $derived(isItineraire ? '/itineraires' : '/');
	const backLabel = $derived(isItineraire ? 'Tous les itinéraires' : 'Retour à la carte');

	const SCHEMA_TYPE_BY_FICHE_TYPE: Record<string, string> = {
		parking: 'BicycleParking',
		velov: 'BikeStore',
		itineraire: 'TouristAttraction',
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

		if (parking && typeof parking.lng === 'number' && typeof parking.lat === 'number') {
			schema.geo = {
				'@type': 'GeoCoordinates',
				latitude: parking.lat,
				longitude: parking.lng,
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
	{#if itineraire && data.geometry && data.geometryUrl}
		<div class="mx-[calc(50%-50vw)]">
			<ItineraireMap
				title={itineraire.title}
				geoJsonUrl={data.geometryUrl}
				bbox={data.geometry.bbox}
				color={itineraireColor}
			/>
		</div>
	{:else if parking && hasLocation}
		<div class="mx-[calc(50%-50vw)]">
			<FicheMap
				lng={parking.lng!}
				lat={parking.lat!}
				zoom={parking.zoom ?? 16}
				name={parking.title}
				osmId={parking.osmId}
			/>
		</div>
	{/if}

	<div class="mx-auto max-w-3xl space-y-6">
		<a
			href={backHref}
			class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-navy"
		>
			<ArrowLeft size={14} />
			{backLabel}
		</a>

		<header class="space-y-3">
			<div class="flex items-start justify-between gap-3">
				<div class="space-y-1">
					<h1 class="text-2xl font-bold text-brand-navy md:text-3xl">{fiche.title}</h1>
					{#if fiche.subtitle}
						<p class="text-lg text-gray-600">{fiche.subtitle}</p>
					{/if}
				</div>
				{#if itineraire?.ref}
					<span
						class="flex-shrink-0 rounded-md px-3 py-1.5 font-mono text-sm font-bold text-white"
						style="background-color: {itineraireColor}"
					>
						{itineraire.ref}
					</span>
				{/if}
			</div>
			{#if itineraire}
				<div class="h-1 rounded-full" style="background-color: {itineraireColor}"></div>
			{/if}
			{#if fiche.address}
				<p class="flex items-center gap-1.5 text-sm text-gray-500">
					<MapPin size={14} />
					{fiche.address}
				</p>
			{/if}
		</header>

		{#if itineraire}
			<dl class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
				{#if itineraire.endpoints}
					<div>
						<dt class="text-xs font-bold tracking-wide text-gray-500 uppercase">Itinéraire</dt>
						<dd class="mt-1 text-base text-gray-800">{itineraire.endpoints}</dd>
					</div>
				{/if}
				{#if itineraire.totalLengthKm !== undefined}
					<div>
						<dt class="text-xs font-bold tracking-wide text-gray-500 uppercase">Longueur</dt>
						<dd class="mt-1 text-base text-gray-800">
							{numberFormatter.format(itineraire.totalLengthKm)} km
						</dd>
					</div>
				{/if}
			</dl>

			<div class="flex flex-wrap gap-3">
				<a
					href={mapHref}
					class="inline-flex items-center gap-1.5 rounded-md bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-navy/90"
				>
					<Route size={14} />
					Ouvrir sur la carte interactive
				</a>
				{#if cartesAppUrl}
					<a
						href={cartesAppUrl}
						target="_blank"
						rel="noopener"
						class="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition-colors hover:bg-gray-50"
					>
						Itinéraire sur cartes.app
						<ExternalLink size={14} />
					</a>
				{/if}
			</div>
		{/if}

		{#if parking?.summary}
			<p class="text-lg text-gray-700">{parking.summary}</p>
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
	</div>

	<LavilleaveloCta class="mt-8" />
</div>
