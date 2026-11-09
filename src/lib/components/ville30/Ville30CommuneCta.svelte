<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Search from '@lucide/svelte/icons/search';
	import { Combobox } from 'bits-ui';
	import { flushSync, type Snippet } from 'svelte';
	import { matchesAllTokens, tokenize } from '$lib/utils/textSearch';
	import type { Ville30CommuneRow, Ville30SearchParams } from '$lib/utils/ville30';

	let {
		communes,
		params,
		ville30Count,
		totalCommunes,
		populationPct,
		cite,
		onSelect,
		onShowMap,
	}: {
		communes: Ville30CommuneRow[];
		params: Ville30SearchParams;
		ville30Count: number;
		totalCommunes: number;
		populationPct: number | null;
		cite: Snippet<[string]>;
		onSelect: (slug: string | null) => void;
		onShowMap: (e: MouseEvent) => void;
	} = $props();

	const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
	const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
		year: 'numeric',
		month: 'long',
		timeZone: 'UTC',
	});

	let open = $state(false);
	let typed: string | null = $state(null);

	const commune = $derived(communes.find((c) => c.slug === params.commune) ?? null);
	const inputValue = $derived(typed ?? (open ? '' : (commune?.name ?? '')));
	const results = $derived.by(() => {
		const tokens = tokenize(typed ?? '');
		return communes.filter((c) => matchesAllTokens(c.name, tokens));
	});
	const adopted = $derived(
		commune?.adoptedAt ? dateFormatter.format(new Date(commune.adoptedAt)) : null,
	);
	const streets = $derived(
		commune?.pct == null
			? ''
			: `Aujourd'hui, ${numberFormatter.format(commune.pct)} % de ses rues sont à 30 km/h ou moins.`,
	);
</script>

<section
	class="max-w-3xl space-y-3 rounded-lg border border-brand-teal/40 bg-brand-teal/10 p-4 sm:p-5"
>
	<div class="space-y-1">
		<h2 class="text-xl font-bold text-brand-navy">Et votre commune&nbsp;?</h2>
		<p class="text-sm text-gray-700">
			{ville30Count} communes sur {totalCommunes} sont déjà en Ville 30.
			{#if populationPct !== null}
				Environ {numberFormatter.format(populationPct)}&nbsp;% des habitants de la Métropole y
				vivent.
			{/if}
		</p>
	</div>

	<div>
		<label for="ville30-commune" class="text-sm font-semibold text-brand-navy">
			Voir où en est ma commune
		</label>
		<Combobox.Root
			type="single"
			bind:open
			allowDeselect={false}
			value={params.commune}
			{inputValue}
			onValueChange={(slug) => onSelect(slug || null)}
			onOpenChange={(isOpen) => {
				if (!isOpen) typed = null;
			}}
		>
			<div class="relative mt-1">
				<Search
					class="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400"
					aria-hidden="true"
				/>
				<Combobox.Input
					id="ville30-commune"
					autocomplete="off"
					placeholder={commune?.name ?? 'Rechercher une commune'}
					oninput={(e) => flushSync(() => (typed = e.currentTarget.value))}
					onclick={() => (open = true)}
					class="w-full rounded-md border border-gray-300 bg-white py-2 pr-9 pl-8 text-base text-gray-800 placeholder:text-gray-500 focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/30 focus:outline-none"
				/>
				<Combobox.Trigger
					aria-label="Afficher les communes"
					class="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-gray-700"
				>
					<ChevronDown class="h-4 w-4" aria-hidden="true" />
				</Combobox.Trigger>
			</div>
			<Combobox.Portal>
				<Combobox.Content
					sideOffset={4}
					class="z-50 w-(--bits-combobox-anchor-width) rounded-md border border-gray-200 bg-white shadow-md"
				>
					<Combobox.Viewport class="max-h-64 overflow-y-auto p-1">
						{#each results as c (c.slug)}
							<Combobox.Item
								value={c.slug}
								label={c.name}
								class="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm text-gray-800 select-none data-highlighted:bg-brand-teal/20 data-selected:font-semibold"
							>
								<span>{c.name}</span>
								{#if c.status !== 'none'}
									<span
										class="shrink-0 rounded-full bg-brand-teal/25 px-1.5 py-px text-xs font-semibold text-brand-navy"
									>
										{c.status === 'partial' ? 'En partie' : 'Ville 30'}
									</span>
								{/if}
							</Combobox.Item>
						{:else}
							<p aria-hidden="true" class="px-2 py-1.5 text-sm text-gray-500">
								Aucune commune trouvée
							</p>
						{/each}
					</Combobox.Viewport>
				</Combobox.Content>
			</Combobox.Portal>
		</Combobox.Root>
		<p role="status" class="sr-only">
			{#if open}
				{results.length === 0
					? 'Aucune commune trouvée'
					: `${results.length} commune${results.length > 1 ? 's' : ''}`}
			{/if}
		</p>
	</div>

	<div aria-live="polite" class="space-y-2 text-sm text-gray-700">
		{#if commune}
			{#if commune.status === 'full'}
				<p>
					<strong class="text-brand-navy"
						>{commune.name} est en Ville 30{#if adopted}&nbsp;depuis {adopted}{/if}.</strong
					>
					{streets}
				</p>
				<p>Parlez-en autour de vous, surtout dans les communes voisines.</p>
			{:else}
				<p>
					{#if commune.status === 'partial'}
						<strong class="text-brand-navy">{commune.name} est en Ville 30 en partie.</strong>
						{commune.partialNote}
					{:else}
						<strong class="text-brand-navy">{commune.name} n'est pas encore en Ville 30.</strong>
					{/if}
					{streets}
				</p>
				<p>
					<strong class="text-brand-navy">Demandez-la à votre mairie et à la Métropole.</strong>
					C'est la Métropole qui fixe les limitations de vitesse.{@render cite('loi')} Jusqu'ici, elle
					a mis en place la Ville 30 avec les communes volontaires.{@render cite('communique')}
				</p>
			{/if}
		{/if}
	</div>

	<a
		href={commune ? `?tab=communes&commune=${commune.slug}` : '?tab=communes'}
		onclick={onShowMap}
		class="inline-flex items-center gap-1 text-sm font-semibold text-brand-navy hover:underline"
	>
		{commune ? `Voir ${commune.name} sur la carte` : 'Voir toutes les communes sur la carte'}
		<ArrowRight class="h-4 w-4" aria-hidden="true" />
	</a>
</section>
