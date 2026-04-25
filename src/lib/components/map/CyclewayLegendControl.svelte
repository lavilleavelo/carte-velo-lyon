<script lang="ts">
	import { CustomControl } from 'svelte-maplibre-gl';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import type { LegendId } from '$lib/utils/cyclewayLegend';

	const COLOR = '#166534';

	type Render =
		| 'solid'
		| 'solid-thin'
		| 'double'
		| 'dashed'
		| 'dashed-long'
		| 'dotted'
		| 'dotted-bold'
		| 'velorue'
		| 'arrow';

	const items: { id: LegendId; label: string; render: Render }[] = [
		{ id: 'piste-bidir', label: 'Piste cyclable (bidir.)', render: 'solid' },
		{ id: 'piste-unidir', label: 'Piste cyclable (unidir.)', render: 'solid-thin' },
		{ id: 'voie-verte', label: 'Voie verte', render: 'dotted-bold' },
		{ id: 'bande', label: 'Bande cyclable', render: 'dashed' },
		{ id: 'bus-velo', label: 'Voie bus-vélo', render: 'dotted' },
		{ id: 'velorue', label: 'Vélorue', render: 'velorue' },
		{ id: 'dsc', label: 'Double sens cyclable', render: 'arrow' },
	];

	let {
		activeIds,
		onToggle,
		onHover,
		lengthByLegendId,
		position = 'bottom-right',
		initiallyOpen = true,
	}: {
		activeIds?: string[];
		onToggle?: (id: string) => void;
		onHover?: (id: LegendId | null) => void;
		lengthByLegendId?: Partial<Record<LegendId, number>>;
		position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
		initiallyOpen?: boolean;
	} = $props();

	let open = $state(initiallyOpen);

	const isInteractive = $derived(!!onToggle);
	const allActive = $derived(!activeIds || activeIds.length === 0);

	function isActive(id: string): boolean {
		if (allActive) return true;
		return (activeIds ?? []).includes(id);
	}

	const kmFormatter = new Intl.NumberFormat('fr-FR', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});

	function formatKm(id: LegendId): string | null {
		if (!lengthByLegendId) return null;
		const meters = lengthByLegendId[id];
		if (!meters) return null;
		return `${kmFormatter.format(meters / 1000)}\u00a0km`;
	}

	function hasKm(id: LegendId): boolean {
		return !!(lengthByLegendId && (lengthByLegendId[id] ?? 0) > 0);
	}

	const visibleItems = $derived.by(() => {
		if (!lengthByLegendId) return items;
		return items.filter((item) => hasKm(item.id));
	});

	const totalKm = $derived.by(() => {
		if (!lengthByLegendId) return null;
		let total = 0;
		for (const item of visibleItems) {
			if (!isActive(item.id)) continue;
			total += lengthByLegendId[item.id] ?? 0;
		}
		if (!total) return null;
		return `${kmFormatter.format(total / 1000)}\u00a0km`;
	});
</script>

{#if visibleItems.length > 0}
	<CustomControl {position}>
		<div
			class="cycleway-legend-control rounded-lg bg-white/85 shadow-md ring-1 ring-black/5 backdrop-blur-sm"
		>
			<button
				type="button"
				onclick={() => (open = !open)}
				class="flex items-center gap-2 rounded-lg text-left"
				aria-expanded={open}
			>
				<span class="text-xs font-semibold tracking-wide text-brand-navy uppercase">Légende</span>
				{#if totalKm}
					<span class="ml-auto text-xs font-semibold text-gray-700 tabular-nums">{totalKm}</span>
				{/if}
				<ChevronDown
					size={16}
					class="{totalKm ? '' : 'ml-auto'} text-gray-500 transition-transform duration-200 {open
						? 'rotate-180'
						: ''}"
				/>
			</button>

			{#if open}
				<ul
					class="cycleway-legend-grid grid grid-cols-1 gap-x-4 gap-y-1 px-3 pb-2 sm:grid-flow-col sm:grid-cols-2"
					style="--legend-rows: {Math.ceil(visibleItems.length / 2)};"
				>
					{#each visibleItems as item (item.id)}
						{@const active = isActive(item.id)}
						{@const km = formatKm(item.id)}
						<li>
							{#if isInteractive}
								<button
									type="button"
									onclick={() => onToggle?.(item.id)}
									onpointerenter={() => onHover?.(item.id)}
									onpointerleave={() => onHover?.(null)}
									onfocus={() => onHover?.(item.id)}
									onblur={() => onHover?.(null)}
									aria-pressed={active}
									class="flex w-full items-center gap-2 rounded-md py-0.5 text-left text-xs whitespace-nowrap text-gray-700 transition-colors hover:text-brand-navy [&_svg]:shrink-0"
									class:opacity-40={!active}
								>
									<svg
										viewBox="0 0 48 12"
										class="h-3 w-10 shrink-0"
										role="presentation"
										aria-hidden="true"
									>
										{#if item.render === 'solid'}
											<line
												x1="0"
												y1="6"
												x2="48"
												y2="6"
												stroke={COLOR}
												stroke-width="4"
												stroke-linecap="round"
											/>
										{:else if item.render === 'solid-thin'}
											<line
												x1="0"
												y1="6"
												x2="48"
												y2="6"
												stroke={COLOR}
												stroke-width="2"
												stroke-linecap="round"
											/>
										{:else if item.render === 'double'}
											<line x1="0" y1="3" x2="48" y2="3" stroke={COLOR} stroke-width="1.5" />
											<line x1="0" y1="9" x2="48" y2="9" stroke={COLOR} stroke-width="1.5" />
										{:else if item.render === 'dashed'}
											<line
												x1="0"
												y1="6"
												x2="48"
												y2="6"
												stroke={COLOR}
												stroke-width="3"
												stroke-dasharray="5 3"
											/>
										{:else if item.render === 'dashed-long'}
											<line
												x1="0"
												y1="6"
												x2="48"
												y2="6"
												stroke={COLOR}
												stroke-width="3"
												stroke-dasharray="6 6"
											/>
										{:else if item.render === 'dotted'}
											<line
												x1="0"
												y1="6"
												x2="48"
												y2="6"
												stroke={COLOR}
												stroke-width="3"
												stroke-linecap="round"
												stroke-dasharray="0.1 5"
											/>
										{:else if item.render === 'dotted-bold'}
											<line
												x1="0"
												y1="6"
												x2="48"
												y2="6"
												stroke={COLOR}
												stroke-width="4"
												stroke-linecap="round"
												stroke-dasharray="0.1 6"
											/>
										{:else if item.render === 'velorue'}
											<line
												x1="0"
												y1="6"
												x2="48"
												y2="6"
												stroke={COLOR}
												stroke-width="4"
												stroke-dasharray="8 4"
											/>
										{:else if item.render === 'arrow'}
											<line x1="0" y1="6" x2="40" y2="6" stroke={COLOR} stroke-width="2" />
											<polygon points="40,2 48,6 40,10" fill={COLOR} />
										{/if}
									</svg>
									<span class="leading-tight">{item.label}</span>
									{#if km}
										<span class="ml-auto pl-1 text-gray-500 tabular-nums">{km}</span>
									{/if}
								</button>
							{:else}
								<div
									class="flex items-center gap-2 py-0.5 text-xs whitespace-nowrap text-gray-700"
									class:opacity-40={!active}
								>
									<svg
										viewBox="0 0 48 12"
										class="h-3 w-10 shrink-0"
										role="presentation"
										aria-hidden="true"
									>
										{#if item.render === 'solid'}
											<line
												x1="0"
												y1="6"
												x2="48"
												y2="6"
												stroke={COLOR}
												stroke-width="4"
												stroke-linecap="round"
											/>
										{:else if item.render === 'solid-thin'}
											<line
												x1="0"
												y1="6"
												x2="48"
												y2="6"
												stroke={COLOR}
												stroke-width="2"
												stroke-linecap="round"
											/>
										{:else if item.render === 'double'}
											<line x1="0" y1="3" x2="48" y2="3" stroke={COLOR} stroke-width="1.5" />
											<line x1="0" y1="9" x2="48" y2="9" stroke={COLOR} stroke-width="1.5" />
										{:else if item.render === 'dashed'}
											<line
												x1="0"
												y1="6"
												x2="48"
												y2="6"
												stroke={COLOR}
												stroke-width="3"
												stroke-dasharray="5 3"
											/>
										{:else if item.render === 'dashed-long'}
											<line
												x1="0"
												y1="6"
												x2="48"
												y2="6"
												stroke={COLOR}
												stroke-width="3"
												stroke-dasharray="6 6"
											/>
										{:else if item.render === 'dotted'}
											<line
												x1="0"
												y1="6"
												x2="48"
												y2="6"
												stroke={COLOR}
												stroke-width="3"
												stroke-linecap="round"
												stroke-dasharray="0.1 5"
											/>
										{:else if item.render === 'dotted-bold'}
											<line
												x1="0"
												y1="6"
												x2="48"
												y2="6"
												stroke={COLOR}
												stroke-width="4"
												stroke-linecap="round"
												stroke-dasharray="0.1 6"
											/>
										{:else if item.render === 'velorue'}
											<line
												x1="0"
												y1="6"
												x2="48"
												y2="6"
												stroke={COLOR}
												stroke-width="4"
												stroke-dasharray="8 4"
											/>
										{:else if item.render === 'arrow'}
											<line x1="0" y1="6" x2="40" y2="6" stroke={COLOR} stroke-width="2" />
											<polygon points="40,2 48,6 40,10" fill={COLOR} />
										{/if}
									</svg>
									<span class="leading-tight">{item.label}</span>
									{#if km}
										<span class="ml-auto pl-1 text-gray-500 tabular-nums">{km}</span>
									{/if}
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</CustomControl>
{/if}

<style>
	:global(.cycleway-legend-control) {
		width: auto !important;
		max-width: calc(100vw - 16px);
	}
	@media (min-width: 640px) {
		:global(.cycleway-legend-control) {
			min-width: 380px;
		}
		:global(.cycleway-legend-grid) {
			grid-template-rows: repeat(var(--legend-rows), minmax(0, auto));
		}
	}
	:global(.cycleway-legend-control button) {
		width: auto !important;
		height: auto !important;
		display: flex !important;
		padding: 0 !important;
		background: transparent !important;
		border: none !important;
		box-shadow: none !important;
		cursor: pointer !important;
	}
	:global(.cycleway-legend-control button:hover) {
		background-color: transparent !important;
	}
	:global(.cycleway-legend-control > button) {
		padding: 0.5rem 0.75rem !important;
		width: 100% !important;
	}
</style>
