<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Image from '@lucide/svelte/icons/image';
	import Eye from '@lucide/svelte/icons/eye';
	import Pencil from '@lucide/svelte/icons/pencil';

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
	<header class="space-y-1">
		<h1 class="text-2xl font-bold text-brand-navy md:text-3xl">Fiches</h1>
	</header>

	{#if data.fiches.length === 0}
		<p class="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
			Aucune fiche pour le moment.
		</p>
	{:else}
		<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{#each data.fiches as fiche (fiche.slug)}
				{@const updated = formatUpdated(fiche.updated)}
				<li>
					<div
						class="group relative flex h-full gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-brand-navy/40 hover:bg-gray-50"
					>
						{#if fiche.cover}
							<img
								src={fiche.cover}
								alt=""
								loading="lazy"
								class="h-20 w-20 flex-shrink-0 rounded object-cover"
							/>
						{:else}
							<div
								class="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-gray-400"
							>
								<Image size={20} />
							</div>
						{/if}

						<div class="min-w-0 flex-1 space-y-1">
							<div class="flex items-start justify-between gap-2">
								<h2 class="truncate text-sm font-semibold text-brand-navy">
									<a
										href={`/fiches/${fiche.slug}`}
										class="after:absolute after:inset-0 after:content-['']"
									>
										{fiche.title}
									</a>
								</h2>
								<span
									class="flex-shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600"
									>{fiche.type}</span
								>
							</div>

							{#if fiche.subtitle}
								<p class="truncate text-xs text-gray-500">{fiche.subtitle}</p>
							{/if}

							<p class="font-mono text-[10px] text-gray-400">{fiche.slug}</p>

							{#if fiche.address}
								<p class="flex items-center gap-1 truncate text-xs text-gray-500">
									<MapPin size={11} />
									{fiche.address}
								</p>
							{/if}

							<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
								{#if typeof fiche.lng === 'number' && typeof fiche.lat === 'number'}
									<span class="font-mono">{fiche.lat.toFixed(4)}, {fiche.lng.toFixed(4)}</span>
								{:else}
									<span class="text-amber-600">sans coords</span>
								{/if}
								{#if fiche.photoCount > 0}
									<span class="inline-flex items-center gap-0.5">
										<Image size={10} />
										{fiche.photoCount}
									</span>
								{/if}
								{#if fiche.hasPanoramax}
									<span class="inline-flex items-center gap-0.5">
										<Eye size={10} /> panoramax
									</span>
								{/if}
								{#if fiche.parkingGid !== undefined}
									<span class="font-mono"
										>gid:{Array.isArray(fiche.parkingGid)
											? fiche.parkingGid.join(',')
											: fiche.parkingGid}</span
									>
								{/if}
								{#if updated}
									<span>maj {updated}</span>
								{/if}
							</div>
						</div>

						<a
							href={`${REPO_EDIT_BASE}/${fiche.slug}.md`}
							target="_blank"
							rel="noopener"
							title="Éditer sur GitHub"
							aria-label="Éditer {fiche.title} sur GitHub"
							class="relative inline-flex h-7 w-7 flex-shrink-0 items-center justify-center self-start rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-brand-navy"
						>
							<Pencil size={14} />
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
