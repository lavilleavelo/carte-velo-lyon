<script lang="ts">
	import type { LegendId } from '$lib/utils/cyclewayLegend';

	const COLOR = '#166534';

	const items: {
		id: LegendId;
		label: string;
		render:
			| 'solid'
			| 'solid-thin'
			| 'double'
			| 'dashed'
			| 'dotted'
			| 'dotted-bold'
			| 'velorue'
			| 'arrow';
	}[] = [
		{ id: 'piste-bidir', label: 'Piste cyclable (bidirectionnelle)', render: 'solid' },
		{ id: 'piste-unidir', label: 'Piste cyclable (unidirectionnelle)', render: 'solid-thin' },
		{ id: 'voie-verte', label: 'Voie verte', render: 'dotted-bold' },
		{ id: 'bande', label: 'Bande cyclable', render: 'dashed' },
		{ id: 'bus-velo', label: 'Voie bus-vélo', render: 'dotted' },
		{ id: 'velorue', label: 'Vélorue', render: 'velorue' },
		{ id: 'dsc', label: 'Double sens cyclable', render: 'arrow' },
	];

	export const legendItemIds = items.map((i) => i.id);

	let {
		activeIds,
		onToggle,
	}: {
		activeIds?: string[];
		onToggle?: (id: string) => void;
	} = $props();

	const isInteractive = $derived(!!onToggle);
	const allActive = $derived(!activeIds || activeIds.length === 0);

	function isActive(id: string): boolean {
		if (allActive) return true;
		return (activeIds ?? []).includes(id);
	}
</script>

<div class="rounded-lg bg-white p-4 shadow">
	<div class="mb-3 flex items-center justify-between">
		<h2 class="text-sm font-semibold text-brand-navy uppercase">Légende</h2>
		{#if isInteractive && !allActive}
			<button
				type="button"
				onclick={() => {
					for (const item of items) {
						if (!isActive(item.id)) onToggle?.(item.id);
					}
				}}
				class="text-xs text-gray-400 transition-colors hover:text-brand-navy hover:underline"
			>
				Tout afficher
			</button>
		{/if}
	</div>
	<ul class="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
		{#each items as item (item.id)}
			{@const active = isActive(item.id)}
			<li>
				{#if isInteractive}
					<button
						type="button"
						onclick={() => onToggle?.(item.id)}
						aria-pressed={active}
						class="flex w-full items-center gap-3 rounded-md px-1.5 py-1 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
						class:opacity-40={!active}
					>
						<svg
							viewBox="0 0 48 12"
							class="h-3 w-12 shrink-0"
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
						<span>{item.label}</span>
					</button>
				{:else}
					<div class="flex items-center gap-3 text-sm text-gray-700">
						<svg
							viewBox="0 0 48 12"
							class="h-3 w-12 shrink-0"
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
						<span>{item.label}</span>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
</div>
