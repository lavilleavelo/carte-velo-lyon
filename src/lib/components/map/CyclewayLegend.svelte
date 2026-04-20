<script lang="ts">
	const COLOR = '#166534';

	const items: {
		label: string;
		render: 'solid' | 'solid-thin' | 'double' | 'dashed' | 'dotted' | 'dashdot' | 'arrow';
	}[] = [
		{ label: 'Piste cyclable (bidirectionnelle)', render: 'solid' },
		{ label: 'Piste cyclable (unidirectionnelle)', render: 'solid-thin' },
		{ label: 'Voie verte', render: 'double' },
		{ label: 'Bande cyclable', render: 'dashed' },
		{ label: 'Voie bus-vélo', render: 'dotted' },
		{ label: 'CVCB (vélorue)', render: 'dashdot' },
		{ label: 'Double sens cyclable', render: 'arrow' },
	];
</script>

<div class="rounded-lg bg-white p-4 shadow">
	<h2 class="mb-3 text-sm font-semibold text-brand-navy uppercase">Légende</h2>
	<ul class="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
		{#each items as item (item.label)}
			<li class="flex items-center gap-3 text-sm text-gray-700">
				<svg viewBox="0 0 48 12" class="h-3 w-12 shrink-0" role="presentation" aria-hidden="true">
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
					{:else if item.render === 'dashdot'}
						<line
							x1="0"
							y1="6"
							x2="48"
							y2="6"
							stroke={COLOR}
							stroke-width="3"
							stroke-dasharray="8 3 1 3"
						/>
					{:else if item.render === 'arrow'}
						<line x1="0" y1="6" x2="40" y2="6" stroke={COLOR} stroke-width="2" />
						<polygon points="40,2 48,6 40,10" fill={COLOR} />
					{/if}
				</svg>
				<span>{item.label}</span>
			</li>
		{/each}
	</ul>
</div>
