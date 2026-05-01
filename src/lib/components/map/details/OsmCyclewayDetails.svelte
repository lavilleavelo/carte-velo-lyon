<script lang="ts">
	import Route from '@lucide/svelte/icons/route';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';

	let { properties } = $props();

	let showRaw = $state(false);

	const CLASSIFICATION_KEYS = new Set([
		'id',
		'typeamenagement',
		'side',
		'bidirectional',
		'offset',
		'osmId',
		'osmType',
		'isSafe',
		'safetyReason',
		'safetyCaveat',
	]);

	const sideLabel = (side?: string) => {
		if (side === 'left') return 'Côté gauche';
		if (side === 'right') return 'Côté droit';
		return 'Au centre';
	};

	const rawEntries = $derived(
		Object.entries(properties ?? {})
			.filter(
				([k, v]) =>
					!CLASSIFICATION_KEYS.has(k) &&
					v !== undefined &&
					v !== null &&
					v !== '' &&
					typeof v !== 'object',
			)
			.sort((a, b) => a[0].localeCompare(b[0])),
	);

	const osmUrl = $derived(
		properties?.osmId
			? `https://www.openstreetmap.org/${properties.osmType ?? 'way'}/${properties.osmId}`
			: null,
	);
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-2 text-brand-navy">
		<div class="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-700">
			<Route size={18} />
		</div>
		<h3 class="text-sm font-bold tracking-wide uppercase">
			{properties?.typeamenagement || 'Aménagement cyclable'}
		</h3>
	</div>

	<div class="flex flex-col gap-1">
		<div class="flex flex-wrap gap-1.5 text-xs">
			{#if properties?.bidirectional}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800"
				>
					↔ Bidirectionnel
				</span>
			{:else if properties?.typeamenagement === 'Piste Cyclable'}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700"
				>
					→ Unidirectionnel
				</span>
			{/if}
			{#if properties?.side}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700"
				>
					{sideLabel(properties.side)}
				</span>
			{/if}
		</div>
		{#if properties?.name}
			<p class="mt-1 text-sm text-gray-600">{properties.name}</p>
		{/if}
	</div>

	{#if properties?.isSafe !== undefined}
		<div
			class="flex items-start gap-2 rounded-md border px-2 py-1.5 {properties.isSafe
				? 'border-blue-100 bg-blue-50 text-blue-900'
				: 'border-red-100 bg-red-50 text-red-900'}"
		>
			<div class="mt-0.5 shrink-0">
				{#if properties.isSafe}
					<ShieldCheck size={16} />
				{:else}
					<ShieldAlert size={16} />
				{/if}
			</div>
			<div class="flex flex-col">
				<span class="text-xs font-bold tracking-wide uppercase">
					{properties.isSafe ? 'Sécurisé' : 'Non sécurisé'}
				</span>
				{#if properties.safetyReason}
					<span class="text-xs">{properties.safetyReason}</span>
				{/if}
				{#if properties.safetyCaveat}
					<span class="mt-0.5 text-[11px] italic opacity-75">
						⚠ {properties.safetyCaveat}
					</span>
				{/if}
			</div>
		</div>
	{/if}

	<div class="border-t border-gray-100 pt-3">
		<button
			type="button"
			onclick={() => (showRaw = !showRaw)}
			class="flex w-full items-center justify-between text-left text-xs font-bold tracking-wider text-gray-500 uppercase hover:text-brand-navy"
		>
			<span class="flex items-center gap-1">
				{#if showRaw}
					<ChevronDown size={14} />
				{:else}
					<ChevronRight size={14} />
				{/if}
				Attributs OSM ({rawEntries.length})
			</span>
		</button>

		{#if showRaw}
			<div class="mt-2 space-y-1">
				{#if osmUrl}
					<a
						href={osmUrl}
						target="_blank"
						rel="noopener"
						onclick={(e) => e.stopPropagation()}
						class="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-brand-navy"
					>
						Voir sur OSM
						<ExternalLink size={12} />
					</a>
				{/if}

				{#each rawEntries as [k, v] (k)}
					<div
						class="flex flex-col gap-0.5 rounded border border-gray-100 bg-gray-50/50 px-2 py-1.5"
					>
						<span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">{k}</span>
						<span class="text-xs font-medium break-words text-gray-900">{v}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
