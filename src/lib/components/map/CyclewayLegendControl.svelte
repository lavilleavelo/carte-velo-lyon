<script lang="ts">
	import { CustomControl } from 'svelte-maplibre-gl';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Info from '@lucide/svelte/icons/info';
	import type { LegendId } from '$lib/utils/cyclewayLegend';

	const COLOR = '#166534';

	type Render =
		| 'solid'
		| 'solid-thin'
		| 'double'
		| 'dashed'
		| 'dashed-long'
		| 'dashed-thin'
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
		{ id: 'trottoir', label: 'Voie piétonne (vélos autorisés)', render: 'dashed-thin' },
	];

	type SafetyKey = 'safe' | 'unsafe';

	let {
		activeIds,
		onToggle,
		onHover,
		lengthByLegendId,
		safetyMode = false,
		safetyLengths,
		activeSafety,
		onToggleSafety,
		onHoverSafety,
		position = 'bottom-right',
		initiallyOpen = true,
	}: {
		activeIds?: string[];
		onToggle?: (id: string) => void;
		onHover?: (id: LegendId | null) => void;
		lengthByLegendId?: Partial<Record<LegendId, number>>;
		safetyMode?: boolean;
		safetyLengths?: { safe: number; unsafe: number };
		activeSafety?: SafetyKey | null;
		onToggleSafety?: (key: SafetyKey) => void;
		onHoverSafety?: (key: SafetyKey | null) => void;
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
		if (safetyMode && safetyLengths) {
			const total = safetyLengths.safe + safetyLengths.unsafe;
			if (!total) return null;
			return `${kmFormatter.format(total / 1000)}\u00a0km`;
		}
		if (!lengthByLegendId) return null;
		let total = 0;
		for (const item of visibleItems) {
			if (!isActive(item.id)) continue;
			total += lengthByLegendId[item.id] ?? 0;
		}
		if (!total) return null;
		return `${kmFormatter.format(total / 1000)}\u00a0km`;
	});

	const safetyRows = $derived.by(() => {
		if (!safetyMode || !safetyLengths) return null;
		return [
			{
				key: 'safe' as const,
				label: 'S\u00e9curis\u00e9',
				color: '#2563eb',
				meters: safetyLengths.safe,
			},
			{
				key: 'unsafe' as const,
				label: 'Non s\u00e9curis\u00e9',
				color: '#dc2626',
				meters: safetyLengths.unsafe,
			},
		];
	});

	function isSafetyActive(key: SafetyKey): boolean {
		if (!activeSafety) {
			return true;
		}

		return activeSafety === key;
	}
</script>

{#if visibleItems.length > 0 || safetyRows}
	<CustomControl {position}>
		<div
			class="cycleway-legend-control rounded-lg bg-white/85 shadow-md ring-1 ring-black/5 backdrop-blur-sm"
			data-open={open}
		>
			<div class="flex items-center gap-2 rounded-lg p-2 text-left">
				<span class="text-xs font-semibold tracking-wide text-brand-navy uppercase">Légende</span>
				<a
					href="/legende"
					class="text-gray-400 transition-colors hover:text-brand-navy"
					aria-label="Documentation de la légende"
					title="Documentation de la légende"
				>
					<Info size={14} />
				</a>
				{#if totalKm}
					<span class="ml-auto text-xs font-semibold text-gray-700 tabular-nums">{totalKm}</span>
				{/if}
				<button type="button" onclick={() => (open = !open)} aria-expanded={open}>
					<ChevronDown
						size={16}
						class="{totalKm ? '' : 'ml-auto'} text-gray-500 transition-transform duration-200 {open
							? 'rotate-180'
							: ''}"
					/>
				</button>
			</div>

			{#if open && safetyRows}
				<ul class="flex flex-col gap-0.5 border-b border-gray-200/70 px-3 pb-2">
					{#each safetyRows as row (row.key)}
						{@const active = isSafetyActive(row.key)}
						<li>
							<button
								type="button"
								onclick={() => onToggleSafety?.(row.key)}
								onpointerenter={() => active && onHoverSafety?.(row.key)}
								onpointerleave={() => onHoverSafety?.(null)}
								onfocus={() => active && onHoverSafety?.(row.key)}
								onblur={() => onHoverSafety?.(null)}
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
									<line
										x1="0"
										y1="6"
										x2="48"
										y2="6"
										stroke={row.color}
										stroke-width="4"
										stroke-linecap="round"
									/>
								</svg>
								<span class="leading-tight">{row.label}</span>
								{#if row.meters > 0}
									<span class="ml-auto pl-1 text-gray-500 tabular-nums">
										{kmFormatter.format(row.meters / 1000)}&nbsp;km
									</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}

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
									onpointerenter={() => active && onHover?.(item.id)}
									onpointerleave={() => onHover?.(null)}
									onfocus={() => active && onHover?.(item.id)}
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
										{:else if item.render === 'dashed-thin'}
											<line
												x1="0"
												y1="6"
												x2="48"
												y2="6"
												stroke={COLOR}
												stroke-width="1.5"
												stroke-dasharray="3 3"
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
											<line x1="8" y1="6" x2="24" y2="6" stroke="#000000" stroke-width="2" />
											<polygon points="0,6 8,2 8,10" fill="#000000" />
											<line x1="24" y1="6" x2="40" y2="6" stroke="#0369a1" stroke-width="2" />
											<polygon points="48,6 40,2 40,10" fill="#0369a1" />
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
										{:else if item.render === 'dashed-thin'}
											<line
												x1="0"
												y1="6"
												x2="48"
												y2="6"
												stroke={COLOR}
												stroke-width="1.5"
												stroke-dasharray="3 3"
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
											<line x1="8" y1="6" x2="24" y2="6" stroke="#000000" stroke-width="2" />
											<polygon points="0,6 8,2 8,10" fill="#000000" />
											<line x1="24" y1="6" x2="40" y2="6" stroke="#0369a1" stroke-width="2" />
											<polygon points="48,6 40,2 40,10" fill="#0369a1" />
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
