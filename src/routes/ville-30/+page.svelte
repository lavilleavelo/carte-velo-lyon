<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Ville30Map from '$lib/components/map/Ville30Map.svelte';
	import { buildCommuneHref } from '$lib/utils/communeNavigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
		year: 'numeric',
		month: 'long',
	});

	function formatAdoptedAt(date: string | null): string | null {
		if (!date) {
			return null;
		}

		const d = new Date(date);
		if (Number.isNaN(d.getTime())) {
			return null;
		}

		return dateFormatter.format(d);
	}
</script>

<div class="space-y-8 pb-4">
	<div class="mx-[calc(50%-50vw)]">
		<Ville30Map
			ville30Communes={data.ville30}
			fullInsees={data.ville30FullInsees}
			partialInsees={data.ville30PartialInsees}
			allCommuneLinks={data.allCommuneLinks}
		/>
	</div>

	<div class="space-y-8 px-4 sm:px-6 lg:px-0">
		<header class="flex flex-col gap-3">
			<a
				href="/"
				class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-navy"
			>
				<ArrowLeft class="h-4 w-4" />
				Retour à la carte
			</a>
			<h1 class="text-3xl font-bold text-brand-navy md:text-4xl">Ville 30 dans la Métropole</h1>
			<p class="max-w-3xl text-gray-600">
				{data.ville30.length} communes sur {data.totalCommunes} ont adopté le statut
				<strong>Ville 30</strong> : la vitesse y est limitée à 30 km/h par défaut sur l'essentiel des
				rues, à l'exception des grands axes et des zones piétonnes.
			</p>
		</header>

		<section class="prose prose-sm max-w-3xl text-gray-700">
			<h2 class="text-xl font-bold text-brand-navy">Qu'est-ce qu'une Ville 30 ?</h2>
			<p>
				Une <strong>Ville 30</strong> est une commune qui inverse le principe habituel de la voirie
				urbaine : au lieu d'autoriser 50 km/h partout sauf signalisation contraire, la limite par
				défaut devient
				<strong>30 km/h sur environ 80 % des rues</strong>. Les axes structurants (boulevards, voies
				rapides) restent généralement à 50 km/h, et certaines zones de cœur de ville passent en zone
				de rencontre (20 km/h) ou en aire piétonne.
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
					<strong>Temps de parcours peu impacté.</strong> Le passage à 30 km/h supprime les pointes de
					vitesse à 50 sans réduire significativement la vitesse moyenne d'un trajet urbain.
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
					Pour les <strong>véhicules légers et utilitaires</strong>&nbsp;: −15 % d'accidents, −71 %
					de tués, −20 % de blessés graves
				</li>
			</ul>

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

		<section class="space-y-3">
			<h2 class="text-xl font-bold text-brand-navy">Communes Ville 30</h2>
			<ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.ville30 as commune (commune.insee)}
					{@const label = formatAdoptedAt(commune.adoptedAt)}
					<li>
						{#if commune.slug}
							<a
								href={buildCommuneHref(commune.slug)}
								class="flex items-baseline justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm transition-colors hover:border-brand-navy/40 hover:bg-brand-navy/5"
							>
								<span class="flex items-baseline gap-2">
									<span class="font-semibold text-brand-navy">{commune.name}</span>
									{#if commune.partial}
										<span
											class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
											title="Une partie seulement de la commune est en Ville 30"
										>
											partiel
										</span>
									{/if}
								</span>
								<span class="text-xs text-gray-500">{label ?? '–'}</span>
							</a>
						{:else}
							<div
								class="flex items-baseline justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
							>
								<span class="flex items-baseline gap-2">
									<span class="font-semibold text-brand-navy">{commune.name}</span>
									{#if commune.partial}
										<span
											class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
										>
											partiel
										</span>
									{/if}
								</span>
								<span class="text-xs text-gray-500">{label ?? '–'}</span>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
			<p class="text-xs text-gray-500">
				La date affichée est celle de l'arrêté municipal, lorsqu'elle est connue. Le statut «
				partiel » indique qu'une partie seulement de la commune est passée à 30 km/h.
			</p>
		</section>
	</div>
</div>
