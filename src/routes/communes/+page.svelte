<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Map from '@lucide/svelte/icons/map';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import Gauge from '@lucide/svelte/icons/gauge';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import MetropoleInfrastructureChart from '$lib/components/charts/MetropoleInfrastructureChart.svelte';
	import CommuneSelectorMap from '$lib/components/map/CommuneSelectorMap.svelte';
	import LavilleaveloCta from '$lib/components/LavilleaveloCta.svelte';
	import * as Tabs from '$lib/components/ui/tabs';
	import { LYON_INSEE } from '$lib/config/lyon';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const arrondissements = $derived(data.communes.filter((c) => c.slug.startsWith('lyon-')));
	const communes = $derived(data.communes.filter((c) => !c.slug.startsWith('lyon-')));
</script>

<div class="space-y-8 py-6">
	<header class="flex flex-col gap-3">
		<a href="/" class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-navy">
			<ArrowLeft class="h-4 w-4" />
			Retour à la carte
		</a>
		<h1 class="text-3xl font-bold text-brand-navy md:text-4xl">Communes de la Métropole</h1>
		<p class="text-gray-600">
			Sélectionnez une commune pour afficher ses limites et son aménagement cyclable.
		</p>
	</header>

	<Tabs.Root value="map" class="w-full gap-4">
		<Tabs.List>
			<Tabs.Trigger value="map">
				<Map />
				Carte
			</Tabs.Trigger>
			<Tabs.Trigger value="chart">
				<ChartLine />
				Statistiques
			</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="map">
			<CommuneSelectorMap communes={data.communes} />
		</Tabs.Content>
		<Tabs.Content value="chart">
			<MetropoleInfrastructureChart />
		</Tabs.Content>
	</Tabs.Root>

	<a
		href="/ville-30"
		class="group flex items-center gap-3 rounded-lg border border-brand-teal/40 bg-brand-teal/10 px-4 py-3 transition-colors hover:bg-brand-teal/20"
	>
		<span
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-teal/30 text-brand-navy"
			aria-hidden="true"
		>
			<Gauge class="h-5 w-5" />
		</span>
		<span class="flex flex-col gap-0.5">
			<span class="text-sm font-semibold text-brand-navy">Ville 30 dans la Métropole</span>
			<span class="text-xs text-gray-600">
				Voir la carte des communes ayant adopté la limitation à 30 km/h par défaut.
			</span>
		</span>
		<ChevronRight
			class="ml-auto h-5 w-5 shrink-0 text-brand-navy transition-transform group-hover:translate-x-0.5"
			aria-hidden="true"
		/>
	</a>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold text-brand-navy">Lyon, vue d'ensemble</h2>
		<a
			href="/communes/lyon"
			class="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-brand-navy"
		>
			<span class="text-sm font-medium text-gray-800">Lyon (ville entière)</span>
			<span class="flex items-center gap-2 text-xs text-gray-500">
				<span>69001–69009</span>
				<span aria-hidden="true">·</span>
				<span>INSEE {LYON_INSEE}</span>
				<span aria-hidden="true">·</span>
				<span>9 arrondissements</span>
			</span>
		</a>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold text-brand-navy">Arrondissements de Lyon</h2>
		<ul class="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
			{#each arrondissements as commune (commune.slug)}
				<li>
					<a
						href="/communes/{commune.slug}"
						class="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-brand-navy"
					>
						<span class="text-sm font-medium text-gray-800">{commune.name}</span>
						<span class="flex items-center gap-2 text-xs text-gray-500">
							{#if commune.codePostal}
								<span>{commune.codePostal}</span>
								<span aria-hidden="true">·</span>
							{/if}
							<span>INSEE {commune.insee}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold text-brand-navy">
			Autres communes
			<span class="text-sm font-normal text-gray-500">({communes.length})</span>
		</h2>
		<ul class="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
			{#each communes as commune (commune.slug)}
				<li>
					<a
						href="/communes/{commune.slug}"
						class="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-brand-navy"
					>
						<span class="text-sm font-medium text-gray-800">{commune.name}</span>
						<span class="flex items-center gap-2 text-xs text-gray-500">
							{#if commune.codePostal}
								<span>{commune.codePostal}</span>
								<span aria-hidden="true">·</span>
							{/if}
							<span>INSEE {commune.insee}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>

	<LavilleaveloCta />
</div>
