<script lang="ts">
	import Route from '@lucide/svelte/icons/route';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import { getFiche, type ItineraireFiche } from '$lib/content/fiches';
	import { getItineraireColor } from '$lib/config/itineraires';

	let { properties } = $props();

	const slug = $derived(String(properties?.slug ?? ''));
	const fiche = $derived.by<ItineraireFiche | undefined>(() => {
		if (!slug) return undefined;
		const f = getFiche(slug);
		return f && f.type === 'itineraire' ? f : undefined;
	});
	const color = $derived(fiche ? getItineraireColor(fiche) : '#1e3a5f');

	const numberFormatter = new Intl.NumberFormat('fr-FR');
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-2 text-brand-navy">
		<div
			class="flex h-8 w-8 items-center justify-center rounded-full"
			style="background-color: {color}1a; color: {color}"
		>
			<Route size={18} />
		</div>
		<h3 class="text-sm font-bold tracking-wide uppercase">Itinéraire</h3>
	</div>

	{#if fiche}
		<div class="flex flex-col gap-1">
			<div class="flex items-start justify-between gap-2">
				<h4 class="text-lg leading-snug font-bold text-gray-900">{fiche.title}</h4>
				{#if fiche.ref}
					<span
						class="flex-shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-bold text-white"
						style="background-color: {color}"
					>
						{fiche.ref}
					</span>
				{/if}
			</div>
			{#if fiche.subtitle}
				<p class="text-sm text-gray-500">{fiche.subtitle}</p>
			{/if}
		</div>

		{#if fiche.summary}
			<p class="text-sm text-gray-700">{fiche.summary}</p>
		{/if}

		<dl class="grid grid-cols-2 gap-2 text-xs">
			{#if fiche.endpoints}
				<div class="col-span-2 flex flex-col rounded-lg bg-gray-50 p-2">
					<span class="text-[10px] font-bold text-gray-400 uppercase">Itinéraire</span>
					<span class="text-gray-900">{fiche.endpoints}</span>
				</div>
			{/if}
			{#if fiche.totalLengthKm !== undefined}
				<div class="flex flex-col rounded-lg bg-gray-50 p-2">
					<span class="text-[10px] font-bold text-gray-400 uppercase">Longueur</span>
					<span class="font-semibold text-gray-900">
						{numberFormatter.format(fiche.totalLengthKm)} km
					</span>
				</div>
			{/if}
		</dl>

		<a
			href="/fiches/{fiche.slug}"
			class="inline-flex items-center gap-2 rounded-lg border border-brand-navy/15 bg-brand-navy/5 px-3 py-2 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-navy/10"
		>
			<BookOpen size={16} />
			<span>Voir la fiche</span>
		</a>
	{:else}
		<p class="text-sm text-gray-500">Itinéraire inconnu : {slug}</p>
	{/if}
</div>
