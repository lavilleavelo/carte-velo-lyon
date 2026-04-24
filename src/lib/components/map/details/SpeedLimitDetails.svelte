<script lang="ts">
	import Gauge from '@lucide/svelte/icons/gauge';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { SPEED_BUCKET_COLORS, SPEED_BUCKET_LABELS, bucketForSpeed } from '$lib/utils/speedLimits';

	let { properties } = $props();

	let showRaw = $state(false);

	const bucket = $derived(bucketForSpeed(properties?.limitationvitesse));
	const color = $derived(SPEED_BUCKET_COLORS[bucket]);
	const bucketLabel = $derived(SPEED_BUCKET_LABELS[bucket]);

	const streetName = $derived(
		properties?.nomvoie1 || properties?.nomvoie || properties?.nomvoie2 || null,
	);

	const rawSpeed = $derived(
		properties?.limitationvitesse !== undefined &&
			properties?.limitationvitesse !== null &&
			properties?.limitationvitesse !== ''
			? String(properties.limitationvitesse)
			: null,
	);

	const zone = $derived(properties?.reglementationzca || null);

	const lengthMeters = $derived(Number(properties?.longueurcalculee));
	const lengthLabel = $derived.by(() => {
		if (!Number.isFinite(lengthMeters) || lengthMeters <= 0) return null;
		return `${Math.round(lengthMeters).toLocaleString('fr-FR')} m`;
	});

	const rawEntries = $derived(
		Object.entries(properties ?? {})
			.filter(([, v]) => v !== undefined && v !== null && v !== '' && typeof v !== 'object')
			.sort((a, b) => a[0].localeCompare(b[0])),
	);
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-2 text-brand-navy">
		<div
			class="flex h-8 w-8 items-center justify-center rounded-full"
			style="background-color: {color}26; color: {color};"
		>
			<Gauge size={18} />
		</div>
		<h3 class="text-sm font-bold tracking-wide uppercase">
			{#if streetName}
				<span>{streetName}</span>
			{:else}
				<span>Voie sans nom</span>
			{/if}
		</h3>
	</div>

	<div class="flex flex-col gap-1.5">
		<div class="flex flex-wrap items-center gap-1.5 text-xs">
			<span
				class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
				style="background-color: {color}26; color: {color};"
			>
				<span class="h-2 w-2 rounded-full" style="background-color: {color};"></span>
				{rawSpeed ? `${rawSpeed} km/h` : bucketLabel}
			</span>
			{#if zone}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700"
				>
					{zone}
				</span>
			{/if}
			{#if lengthLabel}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700"
				>
					{lengthLabel}
				</span>
			{/if}
		</div>
	</div>

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
				Attributs ({rawEntries.length})
			</span>
		</button>

		{#if showRaw}
			<div class="mt-2 space-y-1">
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
