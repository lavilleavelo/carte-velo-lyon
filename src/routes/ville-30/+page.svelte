<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import MapIcon from '@lucide/svelte/icons/map';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { MediaQuery } from 'svelte/reactivity';
	import { afterNavigate } from '$app/navigation';
	import { useSearchParams } from 'runed/kit';
	import * as Tabs from '$lib/components/ui/tabs';
	import Ville30Map from '$lib/components/map/Ville30Map.svelte';
	import Ville30CommuneList from '$lib/components/ville30/Ville30CommuneList.svelte';
	import { ville30ParamsSchema } from '$lib/utils/ville30';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const params = useSearchParams(ville30ParamsSchema, { pushHistory: false, noScroll: true });

	const isDesktop = new MediaQuery('(min-width: 1024px)');
	const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

	let hoveredSlug: string | null = $state(null);
	let tabsEl: HTMLElement | undefined = $state();
	let mapColumnEl: HTMLElement | undefined = $state();
	// Bumped on every selection so that re-selecting the current commune re-frames the map.
	let fitRequest = $state(0);

	const fullscreen = $derived(params.tab === 'communes' && params.fullscreen);

	// URL updates restore the scroll position once the navigation completes, so scrolling
	// triggered alongside a params change has to wait for it.
	let scrollAfterNavigation: HTMLElement | number | null = null;

	afterNavigate(() => {
		const target = scrollAfterNavigation;
		scrollAfterNavigation = null;
		if (typeof target === 'number') window.scrollTo(0, target);
		else target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	});

	function selectCommune(slug: string | null) {
		const changed =
			(slug ?? '') !== params.commune || params.zoom !== 0 || params.lat !== 0 || params.lng !== 0;
		if (changed) params.update({ commune: slug ?? '', zoom: 0, lat: 0, lng: 0 });
		fitRequest++;

		// On mobile the list sits below the map: bring the map back into view.
		if (!slug || isDesktop.current || fullscreen || !mapColumnEl) return;
		const top = mapColumnEl.getBoundingClientRect().top;
		if (top >= 0 && top <= window.innerHeight / 2) return;
		if (changed) scrollAfterNavigation = mapColumnEl;
		else mapColumnEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function showCommunesTab(e: MouseEvent) {
		e.preventDefault();
		scrollAfterNavigation = tabsEl ?? null;
		params.tab = 'communes';
	}

	// The page shrinks while the map is fixed: remember the scroll position before the DOM
	// update so that leaving fullscreen brings the reader back where they were.
	let scrollYBeforeFullscreen = 0;

	$effect.pre(() => {
		if (fullscreen) scrollYBeforeFullscreen = window.scrollY;
	});

	let fullscreenEl: HTMLElement | undefined = $state();

	$effect(() => {
		if (!fullscreen) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		fullscreenEl?.focus({ preventScroll: true });
		const onKeyDown = (e: KeyboardEvent) => {
			// Escape also clears search fields and closes selects: leave those alone.
			const inField = e.target instanceof Element && e.target.closest('input, select, textarea');
			if (e.key !== 'Escape' || inField) return;
			params.fullscreen = false;
		};
		window.addEventListener('keydown', onKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener('keydown', onKeyDown);
			// Leaving fullscreen updates the URL: restore once that navigation is done.
			scrollAfterNavigation = scrollYBeforeFullscreen;
		};
	});
</script>

<div class="space-y-6 py-4 md:py-6">
	<header class="space-y-4">
		<div class="space-y-2">
			<h1 class="text-2xl font-bold text-brand-navy md:text-3xl">Ville 30 dans la Métropole</h1>
			<p class="max-w-3xl text-gray-600">
				Dans une <strong>Ville 30</strong>, la vitesse est limitée à 30 km/h par défaut sur
				l'essentiel des rues, à l'exception des grands axes et des zones piétonnes.
			</p>
		</div>

		<dl class="grid max-w-3xl grid-cols-3 gap-2 sm:gap-3">
			<div
				class="flex flex-col-reverse justify-end gap-0.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5"
			>
				<dt class="text-xs leading-tight text-gray-600">
					communes en Ville 30
					{#if data.metropole.partialCount > 0}
						<span class="hidden text-gray-400 sm:inline"
							>(dont {data.metropole.partialCount} partiellement)</span
						>
					{/if}
				</dt>
				<dd class="text-xl font-bold text-brand-navy tabular-nums sm:text-2xl">
					{data.metropole.ville30Count}<span class="text-base font-semibold text-gray-400"
						>&thinsp;/&thinsp;{data.metropole.totalCommunes}</span
					>
				</dd>
			</div>
			<div
				class="flex flex-col-reverse justify-end gap-0.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5"
			>
				<dt class="text-xs leading-tight text-gray-600">
					des rues à 30 km/h ou moins<span class="hidden sm:inline">&nbsp;dans la Métropole</span>
				</dt>
				<dd class="text-xl font-bold text-brand-navy tabular-nums sm:text-2xl">
					{data.metropole.pct === null ? '–' : `${numberFormatter.format(data.metropole.pct)} %`}
				</dd>
			</div>
			<div
				class="flex flex-col-reverse justify-end gap-0.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5"
			>
				<dt class="text-xs leading-tight text-gray-600">de rues à 30 km/h ou moins</dt>
				<dd class="text-xl font-bold text-brand-navy tabular-nums sm:text-2xl">
					{numberFormatter.format(data.metropole.eligibleUnder30Km)}<span
						class="text-base font-semibold text-gray-400">&nbsp;km</span
					>
				</dd>
			</div>
		</dl>
	</header>

	<Tabs.Root bind:value={params.tab} class="w-full gap-4">
		<div bind:this={tabsEl} class="scroll-mt-20">
			<Tabs.List class="w-full sm:w-auto">
				<Tabs.Trigger value="explication">
					<BookOpen />
					Explication
				</Tabs.Trigger>
				<Tabs.Trigger value="communes">
					<MapIcon />
					Carte des communes
				</Tabs.Trigger>
			</Tabs.List>
		</div>

		<Tabs.Content value="explication" class="space-y-6">
			<section class="prose prose-sm max-w-3xl text-gray-700">
				<h2 class="text-xl font-bold text-brand-navy">Qu'est-ce qu'une Ville 30 ?</h2>
				<p>
					Une <strong>Ville 30</strong> est une commune qui inverse le principe habituel de la
					voirie urbaine : au lieu d'autoriser 50 km/h partout sauf signalisation contraire, la
					limite par défaut devient
					<strong>30 km/h sur environ 80 % des rues</strong>. Les axes structurants (boulevards,
					voies rapides) restent généralement à 50 km/h, et certaines zones de cœur de ville passent
					en zone de rencontre (20 km/h) ou en aire piétonne.
				</p>
				<p>
					Le passage à 30 km/h s'accompagne aussi de la généralisation des
					<strong>doubles sens cyclables</strong> (obligatoire au titre de l'article 52 de la loi LOM),
					d'une refonte des plans de circulation et, à terme, de dispositifs physiques (ralentisseurs,
					écluses, rétrécissements) là où la signalisation ne suffit pas.
				</p>

				<h3 class="mt-4 text-base font-semibold text-brand-navy">Pourquoi 30 km/h ?</h3>
				<ul class="list-disc pl-5">
					<li>
						<strong>Distance de freinage divisée par deux.</strong> 13 m à 30 km/h contre 27 m à 50 km/h.
					</li>
					<li>
						<strong>Risque de décès d'un piéton heurté.</strong> Environ 10 % à 30 km/h, 80 % à 50 km/h,
						et 100 % à 70 km/h.
					</li>
					<li>
						<strong>Bruit routier.</strong> Réduction d'environ 2,5 dB(A) entre une zone 50 et une zone
						30, soit presque une division par deux du niveau de bruit perçu.
					</li>
					<li>
						<strong>Apaisement et partage.</strong> Une vitesse réduite facilite la cohabitation entre
						voitures, vélos et piétons et libère l'espace public.
					</li>
					<li>
						<strong>Temps de parcours peu impacté.</strong> Le passage à 30 km/h supprime les pointes
						de vitesse à 50 sans réduire significativement la vitesse moyenne d'un trajet urbain.
					</li>
				</ul>

				<h3 class="mt-4 text-base font-semibold text-brand-navy">Résultats observés à Lyon</h3>
				<p>
					Le bilan à un an du passage de Lyon en Ville 30 (mars 2022), publié par le Cerema à partir
					des données officielles TRAXY, compare 2019 (année de référence pré-Covid) à 2022&nbsp;:
				</p>
				<ul class="list-disc pl-5">
					<li>
						<strong>−19 %</strong> d'accidents corporels à Lyon (contre −17 % sur le reste de l'agglomération)
					</li>
					<li><strong>−54 %</strong> de tués sur la voie publique</li>
					<li><strong>−32 %</strong> de blessés hospitalisés</li>
					<li>
						Pour les <strong>piétons</strong> spécifiquement&nbsp;: −29 % d'accidents, −52 % de
						blessés graves, et <strong>aucun tué en 2022</strong>
					</li>
					<li>
						Pour les <strong>véhicules légers et utilitaires</strong>&nbsp;: −15 % d'accidents, −71
						% de tués, −20 % de blessés graves
					</li>
				</ul>

				<h3 class="mt-4 text-base font-semibold text-brand-navy">D'où viennent les chiffres ?</h3>
				<p>
					Les limitations de vitesse proviennent du référentiel des chaussées de la Métropole
					(data.grandlyon.com). La part de rues à 30 km/h est calculée sur la longueur des tronçons
					situés dans chaque commune, <strong>hors voies rapides</strong> (70 km/h et plus) et
					<strong>aires piétonnes</strong> (5 km/h), qui ne sont pas concernées par le passage en Ville
					30. La date d'adoption est celle de l'arrêté municipal, lorsqu'elle est connue.
				</p>

				<h3 class="mt-4 text-base font-semibold text-brand-navy">Pour aller plus loin</h3>
				<ul class="list-disc pl-5">
					<li>
						<a
							href="https://mobilites.grandlyon.com/ville30"
							target="_blank"
							rel="noopener"
							class="inline-flex items-center gap-1 font-semibold text-brand-navy hover:underline"
						>
							Page officielle de la Métropole de Lyon
							<ExternalLink class="h-3 w-3" />
						</a>
					</li>
					<li>
						<a
							href="https://www.cerema.fr/system/files/documents/2024/01/presentation_ville_30_lyon.pdf"
							target="_blank"
							rel="noopener"
							class="inline-flex items-center gap-1 font-semibold text-brand-navy hover:underline"
						>
							Présentation Ville 30 à Lyon, Cerema (PDF, décembre 2023)
							<ExternalLink class="h-3 w-3" />
						</a>
						<span class="text-sm text-gray-500"
							>(bilan et données accidentologiques utilisés ci-dessus)</span
						>
					</li>
				</ul>
			</section>

			<a
				href="?tab=communes"
				onclick={showCommunesTab}
				class="group flex max-w-3xl items-center gap-3 rounded-lg border border-brand-teal/40 bg-brand-teal/10 px-4 py-3 transition-colors hover:bg-brand-teal/20"
			>
				<span
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-teal/30 text-brand-navy"
					aria-hidden="true"
				>
					<MapIcon class="h-5 w-5" />
				</span>
				<span class="flex flex-col gap-0.5">
					<span class="text-sm font-semibold text-brand-navy">Voir la carte des communes</span>
					<span class="text-xs text-gray-600">
						Statut Ville 30 et part des rues à 30 km/h, commune par commune.
					</span>
				</span>
				<ArrowRight
					class="ml-auto h-5 w-5 shrink-0 text-brand-navy transition-transform group-hover:translate-x-0.5"
					aria-hidden="true"
				/>
			</a>
		</Tabs.Content>

		<Tabs.Content value="communes">
			<!-- Inactive tabs stay mounted (hidden): only load the map when it is shown. -->
			{#if params.tab === 'communes'}
				<div
					bind:this={fullscreenEl}
					class={fullscreen
						? 'fixed inset-0 z-50 flex flex-col bg-white p-2 outline-none sm:p-3'
						: ''}
					role={fullscreen ? 'dialog' : undefined}
					aria-modal={fullscreen ? 'true' : undefined}
					aria-label={fullscreen ? 'Carte des communes en plein écran' : undefined}
					tabindex="-1"
				>
					<div
						class="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] {fullscreen
							? 'min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-3'
							: 'lg:h-[calc(100svh-7rem)] lg:min-h-[560px] lg:grid-rows-[minmax(0,1fr)]'}"
					>
						<div
							class="order-2 min-h-0 flex-col lg:order-1 {fullscreen ? 'hidden lg:flex' : 'flex'}"
						>
							<Ville30CommuneList
								communes={data.communes}
								{params}
								bind:hoveredSlug
								onSelect={selectCommune}
							/>
						</div>
						<div bind:this={mapColumnEl} class="order-1 min-h-0 scroll-mt-20 lg:order-2">
							<Ville30Map
								communes={data.communes}
								{params}
								{fitRequest}
								bind:hoveredSlug
								onSelect={selectCommune}
							/>
						</div>
					</div>
				</div>
			{/if}
		</Tabs.Content>
	</Tabs.Root>
</div>
