<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Eye from '@lucide/svelte/icons/eye';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Route from '@lucide/svelte/icons/route';
	import AlertTriangle from '@lucide/svelte/icons/triangle-alert';

	const REPO_EDIT_BASE =
		'https://github.com/lavilleavelo/carte-velo-lyon/edit/main/src/lib/content/fiches';

	let { data } = $props();

	const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	});

	function formatUpdated(value: string | undefined): string | null {
		if (!value) {
			return null;
		}

		const d = new Date(value);
		if (Number.isNaN(d.getTime())) {
			return value;
		}

		return dateFormatter.format(d);
	}
</script>

<div class="mx-auto max-w-5xl space-y-6 py-6">
	<header>
		<h1 class="text-2xl font-bold text-brand-navy md:text-3xl">Fiches</h1>
	</header>

	{#if data.fiches.length === 0}
		<p class="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
			Aucune fiche pour le moment.
		</p>
	{:else}
		<ul class="grid grid-cols-1 gap-8 md:grid-cols-2">
			{#each data.fiches as fiche (fiche.slug)}
				{@const updated = formatUpdated(fiche.updated)}
				<li class="space-y-2">
					<a
						href={`/fiches/${fiche.slug}`}
						class="block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
					>
						<div class="relative aspect-[1200/630] w-full overflow-hidden bg-gray-100">
							<img
								src={fiche.ogImage}
								alt={fiche.ogImageAlt}
								loading="lazy"
								class="h-full w-full object-cover"
							/>
							{#if fiche.ogImageIsFallback}
								<span
									class="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 shadow-sm ring-1 ring-amber-200"
									title="OG image par défaut (pas de visuel propre à la fiche)"
								>
									<AlertTriangle size={10} />
									Image par défaut
								</span>
							{/if}
						</div>
						<div class="space-y-1 px-3 py-2.5">
							<h2 class="line-clamp-2 text-sm font-semibold text-gray-900">{fiche.ogTitle}</h2>
							<p class="line-clamp-3 text-xs leading-relaxed text-gray-600">
								{fiche.ogDescription}
							</p>
						</div>
					</a>

					<div class="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[11px] text-gray-500">
						<span class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-700">
							{fiche.type}
						</span>
						<span class="font-mono text-[10px] text-gray-400" title="slug">{fiche.slug}</span>

						{#if fiche.address}
							<span class="inline-flex items-center gap-0.5 truncate" title={fiche.address}>
								<MapPin size={10} />
								<span class="truncate">{fiche.address}</span>
							</span>
						{/if}

						{#if typeof fiche.lng === 'number' && typeof fiche.lat === 'number'}
							<span class="font-mono text-[10px]"
								>{fiche.lat.toFixed(4)}, {fiche.lng.toFixed(4)}</span
							>
						{/if}

						{#if fiche.hasGeometry}
							<span class="inline-flex items-center gap-0.5" title="Geometry GeoJSON">
								<Route size={10} /> geometry
							</span>
						{/if}

						{#if fiche.photoCount > 0}
							<span class="inline-flex items-center gap-0.5">
								<ImageIcon size={10} />
								{fiche.photoCount}
							</span>
						{/if}

						{#if fiche.hasPanoramax}
							<span class="inline-flex items-center gap-0.5">
								<Eye size={10} /> panoramax
							</span>
						{/if}

						{#if fiche.parkingGid !== undefined}
							<span class="font-mono text-[10px]"
								>gid:{Array.isArray(fiche.parkingGid)
									? fiche.parkingGid.join(',')
									: fiche.parkingGid}</span
							>
						{/if}

						{#if updated}
							<span title="Dernière mise à jour">maj {updated}</span>
						{/if}

						<a
							href={`${REPO_EDIT_BASE}/${fiche.basename}.md`}
							target="_blank"
							rel="noopener"
							title="Éditer sur GitHub"
							aria-label="Éditer {fiche.title} sur GitHub"
							class="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-brand-navy"
						>
							<Pencil size={11} />
							<span>Éditer</span>
						</a>
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	<footer class="pt-4 text-xs text-gray-400">
		<a
			href="https://github.com/lavilleavelo/carte-velo-lyon/tree/main/src/lib/content/fiches"
			target="_blank"
			rel="noopener"
			class="inline-flex items-center gap-1 hover:underline"
		>
			Voir les fichiers .md sur GitHub
			<ExternalLink size={11} />
		</a>
	</footer>
</div>
