<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';

	let { open = $bindable(false), dataMaxYear }: { open?: boolean; dataMaxYear: number } = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="flex max-h-[90vh] flex-col sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Source et méthodologie</Dialog.Title>
			<Dialog.Description>
				Origine et périmètre des données affichées sur cette page.
			</Dialog.Description>
		</Dialog.Header>
		<div class="-mr-2 flex-1 space-y-3 overflow-y-auto pr-2 text-sm leading-relaxed text-gray-700">
			<div>
				<h3 class="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">Source</h3>
				<p>
					<a
						href="https://www.data.gouv.fr/datasets/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2024"
						target="_blank"
						rel="noopener"
						class="underline hover:text-brand-navy"
						>Fichier BAAC (Bulletin d'Analyse des Accidents Corporels)</a
					>, ministère de l'Intérieur, publié sur data.gouv.fr.
				</p>
			</div>

			<div>
				<h3 class="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">Périmètre</h3>
				<ul class="ml-4 list-disc space-y-1">
					<li>
						Années 2019 à {dataMaxYear} par défaut (2017-2018 disponibles, voir limite ci-dessous).
					</li>
					<li>
						Communes de la Métropole de Lyon (les 9 arrondissements de Lyon plus les 57 autres
						communes).
					</li>
					<li>Accidents corporels uniquement, impliquant au moins un vélo.</li>
				</ul>
			</div>

			<div>
				<h3 class="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
					Filtrage appliqué
				</h3>
				<p>À partir de la base BAAC complète (France entière), nous gardons :</p>
				<ul class="mt-1 ml-4 list-disc space-y-1">
					<li>
						Les véhicules de catégorie « Bicyclette » (code BAAC <code>catv = 1</code>) ainsi que
						les vélos à assistance électrique (<code>catv = 80</code>).
					</li>
					<li>
						Les usagers de ces véhicules : conducteurs et passagers, catégorisés par gravité
						(indemne, blessé léger, hospitalisé, tué).
					</li>
					<li>Les accidents géolocalisés dans une commune du périmètre.</li>
				</ul>
				<p class="mt-1.5">
					Le type de collision est déduit des autres véhicules présents dans l'accident (voiture,
					camion, bus, piéton, etc.). Une fiche est générée par victime.
				</p>
			</div>

			<div>
				<h3 class="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">Limites</h3>
				<p>
					Les accidents sans intervention de la police ou de la gendarmerie ne sont pas
					comptabilisés. Les chutes seules sans tiers sont également souvent absentes. Les chiffres
					sont donc légèrement sous-estimés, surtout pour les blessés légers.
				</p>
				<details>
					<summary class="cursor-pointer">
						<i>Rupture méthodologique 2018-2019.</i>
					</summary>
					<p class="mt-2">
						Les règles de saisie des forces de l'ordre ont changé en 2018, et l'indicateur « blessé
						hospitalisé » n'est plus labellisé par l'autorité de la statistique publique depuis
						2019. La période 2019-{dataMaxYear} est donc la seule strictement comparable. Les années
						2017-2018 restent disponibles via le curseur (avec barres atténuées et un trait pointillé
						sur l'histogramme) pour exposer des tendances de long terme, mais leurs comptes de blessés
						hospitalisés ne sont pas comparables aux années suivantes.
					</p>
				</details>
			</div>

			<div>
				<h3 class="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
					Évolution de la pratique cyclable
				</h3>
				<p>
					La courbe bleue sur l'histogramme annuel montre l'indice métropolitain de la pratique du
					vélo (base 100 en 2019) consultable sur Cyclopolis. Il est calculé d'après les compteurs
					présents dans la métropole. Comparer la hauteur des barres à cette courbe donne une idée
					de l'évolution du risque par usager, à l'échelle de la métropole.
				</p>
				<p class="mt-2">
					Pour plus de détails, vous pouvez consulter
					<a
						href="https://cyclopolis.fr/compteurs/velo"
						target="_blank"
						rel="noopener"
						class="underline hover:text-brand-navy">la page des compteurs sur cyclopolis.fr</a
					>.
				</p>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
