<script lang="ts">
	import LavilleaveloCta from '$lib/components/LavilleaveloCta.svelte';
</script>

<div class="py-8">
	<header class="mb-12 rounded-xl bg-brand-navy p-8 text-white shadow-lg">
		<h1 class="text-center text-3xl font-bold md:text-4xl">
			Carte des aménagements cyclables dans la Métropole de Lyon
		</h1>
	</header>

	<section class="mx-auto mb-12 max-w-4xl">
		<div class="mx-auto prose prose-lg text-gray-700">
			<p>
				Envie de savoir où garer votre vélo en sécurité&nbsp;? Besoin d'une pompe ou d'une fontaine
				à eau&nbsp;?
			</p>
			<p>
				Cette carte recense tous les services et équipements vélo de la Métropole de Lyon : pistes
				cyclables, Voies Lyonnaises, stations Vélo'v, arceaux, box sécurisées, vélostations, pompes,
				fontaines à eau, etc.
			</p>
		</div>
	</section>

	<section class="mx-auto mb-16 max-w-3xl" style="view-transition-name: main-map;">
		<a
			href="/"
			class="group block overflow-hidden rounded-xl shadow-lg transition-shadow hover:shadow-2xl"
		>
			<img
				src="/carte.jpg"
				class="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
				alt="Cliquer pour voir la carte des aménagements cyclables dans la Métropole de Lyon"
			/>
		</a>
		<p class="mt-4 text-center">
			<a
				href="/"
				class="inline-flex items-center gap-2 text-xl font-medium text-brand-navy transition-colors hover:text-brand-pink"
			>
				Voir la carte →
			</a>
		</p>

		<p class="mt-6 text-center text-gray-600">
			Cliquez sur n'importe quel élément de la carte pour obtenir plus d'informations et utilisez
			les filtres pour n'afficher que ce qui vous intéresse. Avec un clic droit ou un appui long,
			vous pouvez ouvrir l'emplacement dans panoramax.
		</p>
	</section>

	<section class="mb-16">
		<h2 class="mb-10 text-center text-2xl font-bold text-gray-800 md:text-3xl">
			Retrouvez nos autres réalisations
		</h2>

		<div class="grid grid-cols-1 gap-8 md:grid-cols-3">
			<div class="flex flex-col items-center">
				<a
					href="https://lavilleavelo.org/plaidoyer-2026/"
					class="group mb-4 text-center text-xl font-semibold text-gray-800 hover:text-brand-navy"
				>
					Plaidoyer Marche et Vélo
				</a>
				<a
					href="https://lavilleavelo.org/plaidoyer-2026/"
					class="block overflow-hidden rounded-lg shadow-md transition-shadow hover:shadow-xl"
				>
					<img
						alt="plaidoyer Marche et Vélo"
						decoding="async"
						width="932"
						height="945"
						src="https://lavilleavelo.org/wp-content/uploads/2026/01/Coeur_PlanMarcheVelo2026.png"
						class="aspect-square h-auto w-full object-cover transition-transform duration-300 hover:scale-105"
						srcset="https://lavilleavelo.org/wp-content/uploads/2026/01/Coeur_PlanMarcheVelo2026.png 932w, https://lavilleavelo.org/wp-content/uploads/2026/01/Coeur_PlanMarcheVelo2026-296x300.png 296w, https://lavilleavelo.org/wp-content/uploads/2026/01/Coeur_PlanMarcheVelo2026-768x779.png 768w"
						sizes="(max-width: 932px) 100vw, 932px"
					/>
				</a>
			</div>

			<div class="flex flex-col items-center">
				<a
					href="https://cyclopolis.fr/"
					target="_blank"
					rel="noreferrer noopener"
					class="group mb-4 text-center text-xl font-semibold text-gray-800 hover:text-brand-navy"
				>
					Cyclopolis, Avancement des voies lyonnaises
				</a>
				<a
					href="https://cyclopolis.fr/"
					target="_blank"
					rel="noopener"
					class="block overflow-hidden rounded-lg shadow-md transition-shadow hover:shadow-xl"
				>
					<img
						alt="Cyclopolis Preview"
						decoding="async"
						width="800"
						height="801"
						src="https://lavilleavelo.org/wp-content/uploads/2026/01/cyclopolis-preview.jpg"
						class="aspect-square h-auto w-full object-cover transition-transform duration-300 hover:scale-105"
						srcset="https://lavilleavelo.org/wp-content/uploads/2026/01/cyclopolis-preview.jpg 800w, https://lavilleavelo.org/wp-content/uploads/2026/01/cyclopolis-preview-300x300.jpg 300w, https://lavilleavelo.org/wp-content/uploads/2026/01/cyclopolis-preview-150x150.jpg 150w, https://lavilleavelo.org/wp-content/uploads/2026/01/cyclopolis-preview-768x769.jpg 768w"
						sizes="(max-width: 800px) 100vw, 800px"
					/>
				</a>
			</div>

			<div class="flex flex-col items-center">
				<a
					href="https://veloscore.lavilleavelo.org/"
					target="_blank"
					rel="noreferrer noopener"
					class="group mb-4 text-center text-xl font-semibold text-gray-800 hover:text-brand-navy"
				>
					Vélo-score des communes de la métropole de Lyon
				</a>
				<a
					href="https://veloscore.lavilleavelo.org/"
					target="_blank"
					rel="noopener"
					class="block overflow-hidden rounded-lg shadow-md transition-shadow hover:shadow-xl"
				>
					<img
						alt="Vélo-score Preview"
						loading="lazy"
						decoding="async"
						width="800"
						height="802"
						src="https://lavilleavelo.org/wp-content/uploads/2026/01/velo-score-preview.jpg"
						class="aspect-square h-auto w-full object-cover transition-transform duration-300 hover:scale-105"
						srcset="https://lavilleavelo.org/wp-content/uploads/2026/01/velo-score-preview.jpg 800w, https://lavilleavelo.org/wp-content/uploads/2026/01/velo-score-preview-300x300.jpg 300w, https://lavilleavelo.org/wp-content/uploads/2026/01/velo-score-preview-150x150.jpg 150w, https://lavilleavelo.org/wp-content/uploads/2026/01/velo-score-preview-768x770.jpg 768w"
						sizes="auto, (max-width: 800px) 100vw, 800px"
					/>
				</a>
			</div>
		</div>
	</section>

	<LavilleaveloCta class="mb-16" />

	<section
		class="mb-8 rounded-lg bg-gray-50 p-6"
		style="view-transition-name: about-section;"
		id="about-data"
	>
		<div class="prose prose-sm max-w-none">
			<p class="text-center text-gray-500">
				Données relatives aux aménagements cyclables et aux initiatives vélo des communes de la
				Métropole de Lyon. <a
					class="underline hover:text-brand-navy"
					href="https://data.grandlyon.com">data.grandlyon.com</a
				>
				·
				<a href="/mentions-legales" class="underline hover:text-brand-navy">Mentions légales</a>
			</p>
		</div>
	</section>
</div>
