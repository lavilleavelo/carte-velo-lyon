<script lang="ts">
	import { Facebook, Linkedin, Instagram, Github, Link, Mail } from '@lucide/svelte';
</script>

<div class="rounded-lg bg-brand-navy p-6 text-white shadow-lg">
	<h1 class="text-2xl opacity-90">Carte des aménagements cyclables dans la Métropole de Lyon</h1>
</div>

<section style="view-transition-name: main-map;">
	<div class="mt-10 mb-8 space-y-2 text-center text-2xl text-gray-600 hover:text-gray-800">
		<a
			href="/carte"
			class="block overflow-hidden rounded-lg shadow-md transition-shadow hover:shadow-xl"
		>
			<img
				src="/carte.jpg"
				class="h-auto w-full object-cover transition-transform duration-300 hover:scale-105"
				alt="Cliquer pour voir la carte des aménagements cyclables dans la Métropole de Lyon"
			/>
		</a>
		<a href="/carte">Voir la carte</a>
	</div>
</section>

<section class="mx-auto mt-18 max-w-6xl px-4">
	<h2 class="mb-8 text-center text-2xl font-bold text-gray-800">
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

<section class="mt-16">
	<div class="bg-white" id="cta-lvv">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div
				class="rounded-3xl bg-brand-navy px-6 py-10 sm:px-12 sm:py-16 lg:flex lg:items-center lg:p-16"
			>
				<div class="text-center lg:w-0 lg:flex-1 lg:text-left">
					<h2 class="text-3xl font-extrabold tracking-tight text-white">
						Adhérez à <a class="animated-underline" href="https://lavilleavelo.org"
							>La ville à Vélo</a
						>
					</h2>
					<p class="mt-4 max-w-3xl text-lg text-indigo-100">
						Soutenez la promotion et l'usage du vélo dans l'agglomération lyonnaise, ainsi que le
						développement d'infrastructures cyclables continues et sécurisées en adhérant à
						l'association.
					</p>
				</div>
				<div
					class="mt-12 flex flex-wrap items-center justify-center gap-2 sm:justify-between lg:mt-0 lg:ml-8"
				>
					<div class="flex items-center justify-center gap-2 lg:flex-col">
						<a
							href="https://lavilleavelo.org/sinvestir/adherer/"
							target="_blank"
							class="flex max-h-12 w-24 transform items-center justify-center rounded-md border border-transparent bg-white px-5 py-3 text-base font-medium text-brand-navy transition duration-300 hover:scale-105 sm:shrink-0"
						>
							Adhérer
						</a>
						<a
							target="_blank"
							href="https://lavilleavelo.org/sinvestir/faire-un-don/"
							class="flex max-h-12 w-24 transform items-center justify-center rounded-md border-2 border-white bg-brand-navy px-5 py-3 text-base font-medium text-white transition duration-300 hover:scale-105 sm:shrink-0"
						>
							Donner
						</a>
					</div>
					<a
						href="https://lavilleavelo.org"
						target="_blank"
						type="button"
						class="flex max-h-12 transform items-center justify-center rounded-md border-2 border-white bg-brand-navy px-5 py-3 text-base font-medium text-white transition duration-300 hover:scale-105 sm:w-auto sm:shrink-0"
					>
						En&nbsp;savoir&nbsp;+
					</a>
				</div>
			</div>
		</div>
	</div>

	<div
		class="mx-auto mt-2 w-full max-w-7xl rounded-lg p-6 px-4 sm:px-6 lg:px-8"
		style="view-transition-name: about-section;"
		id="about-data"
	>
		<div class="prose prose-sm max-w-none">
			<p class="px-2 text-gray-500">
				Données relatives aux aménagements cyclables et aux initiatives vélo des communes de la
				Métropole de Lyon. <a
					class="underline hover:text-brand-navy"
					href="https://data.grandlyon.com">data.grandlyon.com</a
				>. <a href="/mentions-legales" class="hover:text-brand-navy">Mentions légales</a>
			</p>
		</div>
	</div>
</section>

<footer class="mx-auto w-full max-w-7xl px-4 sm:px-2">
	<div class="mx-auto overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
		<div class="space-y-4 md:flex md:items-center md:justify-between">
			<a href="https://lavilleavelo.org" class="text-center text-base text-gray-500"
				>La Ville à Vélo</a
			>
			<div class="flex justify-center space-x-4 md:order-2">
				<a
					href="https://bsky.app/profile/lavilleavelo.bsky.social"
					target="_blank"
					class="text-gray-500 hover:text-gray-700"
				>
					<span class="sr-only">Bluesky</span>
					<svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path
							d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z"
						/>
					</svg>
				</a>
				<a
					href="https://masto.bike/@lavilleavelo"
					target="_blank"
					class="text-gray-500 hover:text-gray-700"
				>
					<span class="sr-only">Mastodon</span>
					<svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path
							d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403h-2.546V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.67 1.977v6.218H4.822V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.5 2.962 1.498l.638 1.06.638-1.06c.66-.999 1.65-1.498 2.96-1.498 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12z"
						/>
					</svg>
				</a>
				<a
					href="https://www.facebook.com/lavilleavelolyon/"
					target="_blank"
					class="text-gray-500 hover:text-gray-700"
				>
					<span class="sr-only">Facebook</span>
					<Facebook class="h-6 w-6" aria-hidden="true" />
				</a>
				<a
					href="https://www.linkedin.com/company/la-ville-%C3%A0-v%C3%A9lo"
					target="_blank"
					class="text-gray-500 hover:text-gray-700"
				>
					<span class="sr-only">LinkedIn</span>
					<Linkedin class="h-6 w-6" aria-hidden="true" />
				</a>
				<a
					href="https://www.instagram.com/lavilleavelolyon"
					target="_blank"
					class="text-gray-500 hover:text-gray-700"
				>
					<span class="sr-only">Instagram</span>
					<Instagram class="h-6 w-6" aria-hidden="true" />
				</a>
				<a
					href="https://github.com/lavilleavelo/carte-velo-lyon"
					target="_blank"
					class="text-gray-500 hover:text-gray-700"
				>
					<span class="sr-only">Github</span>
					<Github class="h-6 w-6" aria-hidden="true" />
				</a>
				<a
					href="https://lavilleavelo.org/"
					target="_blank"
					class="text-gray-500 hover:text-gray-700"
				>
					<span class="sr-only">Site web</span>
					<Link class="h-6 w-6" aria-hidden="true" />
				</a>
				<a
					href="mailto:contact_at_lavilleavelo.org"
					target="_blank"
					class="text-gray-500 hover:text-gray-700"
				>
					<span class="sr-only">Email</span>
					<Mail class="h-6 w-6" aria-hidden="true" />
				</a>
			</div>
		</div>
	</div>
</footer>
