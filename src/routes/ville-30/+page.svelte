<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import MapIcon from '@lucide/svelte/icons/map';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Info from '@lucide/svelte/icons/info';
	import { flushSync } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { afterNavigate } from '$app/navigation';
	import { useSearchParams } from 'runed/kit';
	import * as Tabs from '$lib/components/ui/tabs';
	import Ville30Map from '$lib/components/map/Ville30Map.svelte';
	import Ville30CommuneCta from '$lib/components/ville30/Ville30CommuneCta.svelte';
	import Ville30CommuneList from '$lib/components/ville30/Ville30CommuneList.svelte';
	import { ville30ParamsSchema } from '$lib/utils/ville30';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const params = useSearchParams(ville30ParamsSchema, { pushHistory: false, noScroll: true });

	const isDesktop = new MediaQuery('(min-width: 1024px)');
	const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

	const SOURCES: { id: string; href: string; label: string; note?: string }[] = [
		{
			id: 'loi',
			href: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041586987',
			label: 'Article L3642-2 du code général des collectivités territoriales, Légifrance',
			note: 'police de la circulation dans la Métropole de Lyon',
		},
		{
			id: 'communique',
			href: 'https://grandlyon.com/fileadmin/user_upload/media/pdf/espace-presse/cp/2025/20250331_cp_Trois-ans-de-Ville-30.pdf',
			label: 'Trois ans de Ville 30 à Lyon, communiqué de la Métropole de Lyon (PDF, mars 2025)',
		},
		{
			id: 'cerema-zone30',
			href: 'https://www.aude.gouv.fr/contenu/telechargement/25951/178929/file/Cerema_principes_amenagements_zone_30_23-06-27.pdf',
			label: "Cerema (2023), La zone 30 : définition et principes d'aménagements (PDF)",
			note: "courbes de distance d'arrêt, diapo 7",
		},
		{
			id: 'fiche-zone30',
			href: 'https://www.mairie-saintpaul.re/wp-content/uploads/2021/08/pdf_fiche_zone30_cle761915.pdf',
			label: 'Fiche « La zone 30 » (2008, PDF hébergé par la mairie de Saint-Paul)',
			note: '13 m et 28 m, avec 1 seconde de réaction',
		},
		{
			id: 'cnsr',
			href: 'https://www.onisr.securite-routiere.gouv.fr/sites/default/files/2019-07/CNSR%20-%20Comit%C3%A9%20des%20experts%20-%20note%20pi%C3%A9tons%20-%20VF.pdf',
			label: 'Comité des experts du CNSR, note sur les piétons (2019, ONISR)',
			note: "risque ×6 entre 30 et 50 km/h, effet de l'âge",
		},
		{
			id: 'martin-wu',
			href: 'https://pubmed.ncbi.nlm.nih.gov/28557669/',
			label:
				'Martin & Wu (2018), Pedestrian fatality and impact speed squared, données nationales françaises',
		},
		{
			id: 'bruitparif',
			href: 'https://www.bruitparif.fr/pages/Actualites/2022-08-30%20Impact%2030%20km%20h/2022-08-30%20Note%20de%20synth%C3%A8se%20%C3%A9valuation%20impact%2030%20km%20h%20Paris.pdf',
			label: 'Bruitparif (2022), impact sur le bruit du passage à 30 km/h à Paris (PDF)',
		},
		{
			id: 'presentation',
			href: 'https://www.cerema.fr/system/files/documents/2024/01/presentation_ville_30_lyon.pdf',
			label:
				'Présentation Ville 30 à Lyon, Métropole de Lyon (PDF sur le site du Cerema, décembre 2023)',
			note: 'objectifs, vitesses',
		},
		{
			id: 'baac',
			href: 'https://www.data.gouv.fr/datasets/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2025',
			label: 'Base nationale des accidents corporels (BAAC), data.gouv.fr',
			note: 'chiffres du bilan',
		},
		{
			id: 'plan-bruit',
			href: 'https://grandlyon.com/fileadmin/user_upload/media/pdf/espace-presse/cp/2025/20250214_cp_plan-prevention-bruit-2025-2029.pdf',
			label: 'Plan de prévention du bruit, communiqué de la Métropole de Lyon (PDF, février 2025)',
			note: 'baisse du trafic depuis 2019',
		},
		{
			id: 'progres',
			href: 'https://www.leprogres.fr/transport/2026/10/23/on-veut-alerter-sur-la-vitesse-trois-ans-apres-le-passage-en-zone-30-il-faut-rappeler-la-reglementation-estiment-ces-benevoles',
			label:
				'Le Progrès (23 octobre 2026), mesure de vitesse sur le cours Émile-Zola à Villeurbanne',
		},
		{
			id: 'registre',
			href: 'https://elue.univ-gustave-eiffel.fr/fileadmin/contributeurs/ELUE/Seminaire_mars25/ELUE_2503025_Amoros.pdf',
			label:
				"Amoros et al. (2025), comparaison du Registre du Rhône et des données des forces de l'ordre, Université Gustave Eiffel (PDF)",
			note: 'fiabilité du critère « hospitalisé »',
		},
		{
			id: 'double-sens',
			href: 'https://www.banquedesterritoires.fr/plan-dactions-pour-les-mobilites-actives-un-decret-toilette-le-code-de-la-route',
			label: 'Décret du 2 juillet 2015 sur le double sens cyclable, Banque des territoires',
		},
		{
			id: 'metropole',
			href: 'https://mobilites.grandlyon.com/ville30',
			label: 'Page officielle de la Métropole de Lyon',
		},
	];

	let sourcesOpen = $state(false);
	let openNotes = $state({ distance: false, pietons: false, bruit: false });
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
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
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

{#snippet cite(id: string)}
	{@const n = SOURCES.findIndex((s) => s.id === id) + 1}
	<sup
		><a
			href="#source-{n}"
			aria-label="Source {n}"
			onclick={() => flushSync(() => (sourcesOpen = true))}
			class="font-normal text-brand-navy no-underline hover:underline">[{n}]</a
		></sup
	>
{/snippet}

{#snippet noteToggle(note: keyof typeof openNotes, label: string)}
	<button
		type="button"
		aria-expanded={openNotes[note]}
		aria-label={label}
		title={label}
		onclick={() => (openNotes[note] = !openNotes[note])}
		class="-m-1 inline-flex cursor-pointer p-1 align-text-bottom text-gray-400 hover:text-brand-navy"
	>
		<Info class="h-3.5 w-3.5" aria-hidden="true" />
	</button>
{/snippet}

<div class="space-y-6 py-4 md:py-6">
	<header class="space-y-4">
		<div class="space-y-2">
			<h1 class="text-2xl font-bold text-brand-navy md:text-3xl">Ville 30 dans la Métropole</h1>
			<p class="max-w-3xl text-gray-600">
				Rouler moins vite en ville, c'est des rues plus sûres et plus calmes. Dans une <strong
					>Ville 30</strong
				>, la vitesse est limitée à 30 km/h sur la plupart des rues, sauf sur les grands axes et
				dans les zones piétonnes.
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
					{data.metropole.pct === null ? '–' : `${numberFormatter.format(data.metropole.pct)} %`}
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
					Pourquoi 30 km/h
				</Tabs.Trigger>
				<Tabs.Trigger value="communes">
					<MapIcon />
					Carte des communes
				</Tabs.Trigger>
			</Tabs.List>
		</div>

		<Tabs.Content value="explication" class="space-y-6">
			<Ville30CommuneCta
				communes={data.communes}
				{params}
				ville30Count={data.metropole.ville30Count}
				totalCommunes={data.metropole.totalCommunes}
				populationPct={data.metropole.populationPct}
				{cite}
				onSelect={selectCommune}
				onShowMap={showCommunesTab}
			/>

			<section class="prose prose-sm max-w-3xl text-gray-700">
				<h2 class="text-xl font-bold text-brand-navy">Pourquoi 30 km/h&nbsp;?</h2>
				<ul class="list-disc pl-5">
					<li>
						<strong>Distance d'arrêt divisée par deux.</strong> 13 m à 30 km/h contre 28 m à 50
						km/h.{@render cite('cerema-zone30')}{@render cite('fiche-zone30')}
						{@render noteToggle('distance', "Précisions sur la distance d'arrêt")}
						{#if openNotes.distance}
							<em class="text-gray-500">
								Temps de réaction compris, sur chaussée sèche&nbsp;: environ 8 m de réaction et 5 m
								de freinage à 30 km/h, environ 14 m et 14 m à 50 km/h.
							</em>
						{/if}
					</li>
					<li>
						<strong>Des piétons mieux protégés.</strong> En cas de choc, le risque de décès est
						environ 6 fois plus faible à 30 km/h qu'à 50 km/h.{@render cite('cnsr')}{@render cite(
							'martin-wu',
						)}
						{@render noteToggle('pietons', 'Précisions sur le risque pour les piétons')}
						{#if openNotes.pietons}
							<em class="text-gray-500">
								Données nationales françaises, pour un choc frontal avec une voiture, selon la
								vitesse au moment du choc. Le risque augmente aussi fortement avec l'âge&nbsp;: à 50
								km/h, il est 7 fois plus élevé pour une personne de 75 ans ou plus que pour un
								adulte de 15 à 59 ans.{@render cite('cnsr')}
							</em>
						{/if}
					</li>
					<li>
						<strong>Moins de bruit.</strong> Quand la circulation est fluide, rouler à 30 plutôt
						qu'à 50 réduit le bruit presque autant que diviser le trafic par deux.{@render cite(
							'bruitparif',
						)}
						{@render noteToggle('bruit', 'Précisions sur le bruit')}
						{#if openNotes.bruit}
							<em class="text-gray-500">
								Environ 3 dB(A) en théorie. À Paris, les mesures faites un an après le passage à 30
								donnent entre 0,3 et 1,4 dB de moins selon les endroits.{@render cite('bruitparif')}
								Ces données ne sont pas encore disponibles pour Lyon.
							</em>
						{/if}
					</li>
					<li>
						<strong>Une rue mieux partagée.</strong> À 30 km/h, voitures, vélos et piétons se côtoient
						plus facilement.
					</li>
					<li>
						<strong>Peu de temps perdu.</strong> À Lyon, la vitesse moyenne a baissé d'environ 1
						km/h un an après le passage à 30.{@render cite('presentation')}
					</li>
				</ul>

				<details class="mt-4">
					<summary
						class="cursor-pointer text-base font-semibold text-brand-navy select-none hover:underline"
					>
						Résultats observés à Lyon
					</summary>
					<p>
						Lyon est passée en Ville 30 en mars 2022. On compare ici 2019, dernière année avant le
						Covid, à la moyenne de 2023 à 2025{@render cite('baac')}&nbsp;:
					</p>
					<table>
						<thead>
							<tr>
								<th>Évolution 2019 → moyenne 2023-2025</th>
								<th>Lyon</th>
								<th>Autres communes en Ville 30</th>
								<th>Communes sans Ville 30</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>Accidents corporels</td>
								<td>−42&nbsp;%</td>
								<td>−34&nbsp;%</td>
								<td>−29&nbsp;%</td>
							</tr>
							<tr>
								<td>Accidents impliquant un piéton</td>
								<td>−51&nbsp;%</td>
								<td>−44&nbsp;%</td>
								<td>−41&nbsp;%</td>
							</tr>
						</tbody>
					</table>
					<p>
						Il est difficile d'isoler l'effet de la Ville 30&nbsp;: le trafic a aussi baissé{@render cite(
							'plan-bruit',
						)}, et les chiffres varient beaucoup d'une année sur l'autre. En 2025, on compte à Lyon
						584 accidents, 11 tués et 137 blessés hospitalisés, contre 1&nbsp;021 accidents, 13 tués
						et 190 blessés hospitalisés en 2019.{@render cite('baac')}
					</p>
					<p>
						Aucun de ces chiffres n'indique d'effet négatif. Depuis 2023, les accidents à Lyon sont
						environ 15&nbsp;% plus bas que ce qu'aurait donné l'évolution des autres communes de la
						Métropole.{@render cite('baac')}
					</p>
					<p>
						Un an après le passage à 30, sur les rues passées de 50 à 30, la vitesse que seuls
						15&nbsp;% des véhicules dépassent n'avait baissé que d'environ 1 km/h.{@render cite(
							'presentation',
						)} Les aménagements et les contrôles restent insuffisants pour faire respecter le 30 km/h.
						En 2024, la police municipale a dressé 1&nbsp;174 PV pour excès de vitesse dans toute la
						ville.{@render cite('communique')} À Villeurbanne, trois ans après le passage à 30, une mesure
						d'une heure faite par La Ville à Vélo et les Droits du Piéton sur le cours Émile-Zola montre
						que plus de la moitié des deux-roues motorisés dépassent largement la limite.{@render cite(
							'progres',
						)}
					</p>
					<details class="mt-2">
						<summary
							class="cursor-pointer text-sm font-semibold text-gray-600 select-none hover:underline"
						>
							Notes additionnelles
						</summary>
						<ul class="list-disc pl-5">
							<li>
								L'écart de 15&nbsp;% reste le même avec la moyenne 2017-2019 comme base. La baisse
								des accidents est alors de 37&nbsp;% à Lyon, 27&nbsp;% dans les autres communes en
								Ville 30 et 23&nbsp;% dans les communes sans.{@render cite('baac')}
							</li>
							<li>
								En 2025 seule, par rapport à 2019&nbsp;: −43&nbsp;% d'accidents à Lyon, −35&nbsp;%
								dans les autres communes en Ville 30 et −33&nbsp;% dans les communes sans.{@render cite(
									'baac',
								)}
							</li>
							<li>
								On compare avec les autres communes pour tenir compte de ce qui a changé partout
								dans l'agglomération. Le trafic automobile a baissé partout depuis 2019, mais plus
								au centre&nbsp;: −22&nbsp;% dans l'hypercentre contre −12&nbsp;% sur la Métropole.{@render cite(
									'plan-bruit',
								)}
							</li>
							<li>
								Les tués et les blessés hospitalisés ne sont pas dans le tableau. À Lyon, de 2019 à
								2025&nbsp;: 13, 3, 13, 6, 13, 7 et 11 tués&nbsp;; 190, 126, 124, 130, 110, 83 et 137
								blessés hospitalisés.{@render cite('baac')} Il y a trop peu de tués pour conclure, et
								le nombre d'hospitalisés dépend de la saisie par les forces de l'ordre&nbsp;: il n'est
								plus labellisé par la statistique publique depuis 2019.{@render cite('registre')}
							</li>
							<li>
								À Lyon, les blessés hospitalisés avaient déjà nettement baissé en 2020 et 2021,
								pendant le Covid, surtout chez les piétons, alors que le nombre d'accidents avait
								peu changé en 2021.{@render cite('baac')} La raison n'est pas établie.
							</li>
							<li>
								Vitesses&nbsp;: en journée, la vitesse sous laquelle roulent 85&nbsp;% des véhicules
								est passée de 36,2 à 35,1 km/h entre février 2022 et février 2023 à Lyon, toutes
								rues confondues. Elle a baissé de 1,1 km/h sur les rues passées de 50 à 30, et de
								1,6 km/h sur celles restées à 50.{@render cite('presentation')}
							</li>
							<li>
								Les communes sont classées selon leur statut actuel. Plusieurs sont passées à 30
								km/h récemment, comme Villeurbanne en septembre 2023. Oullins-Pierre-Bénite, en
								Ville 30 pour partie seulement, n'est pas comptée.
							</li>
						</ul>
					</details>
				</details>

				<h2 class="text-xl font-bold text-brand-navy">Qu'est-ce qu'une Ville 30&nbsp;?</h2>
				<p>
					Dans une <strong>Ville 30</strong>, la limite de base en ville passe de 50 à
					<strong>30 km/h, avec un objectif d'environ 80&nbsp;% des rues</strong>{@render cite(
						'presentation',
					)}. Les grands axes (boulevards, voies rapides) restent généralement à 50 km/h. Certaines
					rues du centre passent en zone de rencontre (20 km/h) ou en aire piétonne.
				</p>
				<p>
					En passant à 30 km/h, on généralise aussi les
					<strong>doubles sens cyclables</strong> (la règle par défaut dans les rues à 30 km/h ou
					moins, sauf décision contraire{@render cite('double-sens')}). Les plans de circulation
					sont revus et, à terme, des ralentisseurs, écluses ou rétrécissements sont ajoutés là où
					les panneaux ne suffisent pas.{@render cite('presentation')}
				</p>

				<h3 class="mt-4 text-base font-semibold text-brand-navy">
					D'où viennent les données de la carte ?
				</h3>
				<p>
					Les limitations de vitesse proviennent du référentiel des chaussées de la Métropole
					(data.grandlyon.com). La part de rues à 30 km/h est calculée sur la longueur des tronçons
					situés dans chaque commune, <strong>hors voies rapides</strong> (70 km/h et plus) et
					<strong>aires piétonnes</strong> (5 km/h), qui ne sont pas concernées par le passage en Ville
					30. La date indiquée est celle du passage à 30 km/h, lorsqu'elle est connue.
				</p>

				<details class="mt-4" bind:open={sourcesOpen}>
					<summary
						class="cursor-pointer text-base font-semibold text-brand-navy select-none hover:underline"
					>
						Pour aller plus loin
					</summary>
					<ol class="list-decimal pl-5">
						{#each SOURCES as source, i (source.id)}
							<li id="source-{i + 1}" class="scroll-mt-20 rounded target:bg-brand-teal/20">
								<a
									href={source.href}
									target="_blank"
									rel="noopener"
									class="inline-flex items-center gap-1 font-semibold text-brand-navy hover:underline"
								>
									{source.label}
									<ExternalLink class="h-3 w-3" />
								</a>
								{#if source.note}
									<span class="text-sm text-gray-500">({source.note})</span>
								{/if}
							</li>
						{/each}
					</ol>
				</details>
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
						: 'mx-[calc(50%-50vw)] px-4 outline-none sm:px-6 lg:px-8'}
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
