<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Route from '@lucide/svelte/icons/route';
	import { itineraireLayerId } from '$lib/config/itineraires';

	let { data } = $props();

	function mapHref(slug: string): string {
		const layer = itineraireLayerId(slug);
		return `/?layers=osm-cycleways,vl,${layer}`;
	}

	const numberFormatter = new Intl.NumberFormat('fr-FR');
</script>

<div class="mx-auto max-w-5xl space-y-8 py-8">
	<h1 class="text-3xl font-bold text-brand-navy md:text-4xl">Itinéraires cyclables</h1>

	<ul class="flex flex-col divide-y divide-gray-100">
		{#each data.itineraires as itineraire (itineraire.slug)}
			<li class="group relative py-5">
				<div class="flex items-start gap-4">
					<span
						class="mt-1.5 h-3 w-3 flex-shrink-0 rounded-full"
						style="background-color: {itineraire.color}"
						aria-hidden="true"
					></span>

					<div class="min-w-0 flex-1 space-y-2">
						<div class="flex flex-wrap items-baseline gap-x-2">
							<h2 class="text-xl font-bold text-brand-navy">
								<a
									href={`/fiches/${itineraire.slug}`}
									class="after:absolute after:inset-0 after:content-['']"
								>
									{itineraire.title}
								</a>
							</h2>
							{#if itineraire.ref}
								<span class="font-mono text-xs text-gray-500">{itineraire.ref}</span>
							{/if}
						</div>

						{#if itineraire.subtitle}
							<p class="text-sm text-gray-600">{itineraire.subtitle}</p>
						{/if}

						<dl class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
							{#if itineraire.endpoints}
								<div>
									<dt class="inline text-gray-400">Itinéraire&nbsp;:</dt>
									<dd class="inline">{itineraire.endpoints}</dd>
								</div>
							{/if}
							{#if itineraire.totalLengthKm !== null}
								<div>
									<dt class="inline text-gray-400">Longueur&nbsp;:</dt>
									<dd class="inline">{numberFormatter.format(itineraire.totalLengthKm)} km</dd>
								</div>
							{/if}
						</dl>

						<div class="flex items-center gap-3 pt-1 text-sm">
							<span
								class="inline-flex items-center gap-1 font-medium text-brand-navy group-hover:underline"
							>
								En savoir plus
								<ArrowRight size={13} />
							</span>
							<a
								href={mapHref(itineraire.slug)}
								class="relative inline-flex items-center gap-1 text-xs text-gray-400 hover:text-brand-navy hover:underline"
							>
								<Route size={12} />
								Carte
							</a>
						</div>
					</div>
				</div>
			</li>
		{/each}
	</ul>
</div>
