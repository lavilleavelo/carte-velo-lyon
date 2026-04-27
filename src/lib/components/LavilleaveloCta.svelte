<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<section class={className} id="cta-lvv">
	<div
		class="rounded-3xl bg-brand-navy px-6 py-10 sm:px-12 sm:py-16 lg:flex lg:items-center lg:p-16"
	>
		<div class="text-center lg:w-0 lg:flex-1 lg:text-left">
			<h2 class="text-3xl font-extrabold tracking-tight text-white">
				Adhérez à <a class="animated-underline" href="https://lavilleavelo.org">La ville à Vélo</a>
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
					rel="noopener noreferrer"
					class="flex max-h-12 w-24 transform items-center justify-center rounded-md border border-transparent bg-white px-5 py-3 text-base font-medium text-brand-navy transition duration-300 hover:scale-105 sm:shrink-0"
				>
					Adhérer
				</a>
				<a
					href="https://lavilleavelo.org/sinvestir/faire-un-don/"
					target="_blank"
					rel="noopener noreferrer"
					class="flex max-h-12 w-24 transform items-center justify-center rounded-md border-2 border-white bg-brand-navy px-5 py-3 text-base font-medium text-white transition duration-300 hover:scale-105 sm:shrink-0"
				>
					Donner
				</a>
			</div>
			<a
				href="https://lavilleavelo.org"
				target="_blank"
				rel="noopener noreferrer"
				class="flex max-h-12 transform items-center justify-center rounded-md border-2 border-white bg-brand-navy px-5 py-3 text-base font-medium text-white transition duration-300 hover:scale-105 sm:w-auto sm:shrink-0"
			>
				En&nbsp;savoir&nbsp;+
			</a>
		</div>
	</div>
</section>
