<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CommuneMap from '$lib/components/map/CommuneMap.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const bounds = $derived<[[number, number], [number, number]]>([
		[data.bbox[0], data.bbox[1]],
		[data.bbox[2], data.bbox[3]],
	]);
</script>

<div class="space-y-6 py-6">
	<header class="flex flex-col gap-3">
		<a
			href="/communes"
			class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-navy"
		>
			<ArrowLeft class="h-4 w-4" />
			Retour aux communes
		</a>
		<h1 class="text-3xl font-bold text-brand-navy md:text-4xl">Lyon</h1>
		<p class="text-gray-600">
			Vue d'ensemble des {data.arrondissementCount} arrondissements de la ville de Lyon.
		</p>
	</header>

	<dl class="grid grid-cols-2 gap-4 rounded-lg bg-white p-4 shadow sm:grid-cols-3">
		<div>
			<dt class="text-xs text-gray-500 uppercase">Code INSEE</dt>
			<dd class="text-base font-semibold">69123</dd>
		</div>
		<div>
			<dt class="text-xs text-gray-500 uppercase">Codes postaux</dt>
			<dd class="text-base font-semibold">69001–69009</dd>
		</div>
		<div>
			<dt class="text-xs text-gray-500 uppercase">Arrondissements</dt>
			<dd class="text-base font-semibold">{data.arrondissementCount}</dd>
		</div>
	</dl>

	<CommuneMap boundary={data.boundary} {bounds} />
</div>
