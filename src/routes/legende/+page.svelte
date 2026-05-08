<script lang="ts">
	import type { LegendId } from '$lib/utils/cyclewayLegend';
	import { PAVED_SURFACES } from '$lib/utils/osmCycleway';

	const COLOR = '#166534';
	const VOIE_VERTE_PAVED = '#0369a1';
	const VOIE_VERTE_NON_PAVED = '#03527d';

	type Render = 'solid' | 'solid-thin' | 'dashed' | 'dashed-thin' | 'dotted' | 'velorue' | 'arrow';

	type Cond = string | { or: string[] };
	type Group = { all: Cond[]; note?: string };

	type Row = {
		id: LegendId | string;
		label: string;
		render?: Render;
		customSwatch?: 'voie-verte';
		osm: Group[];
		grandLyon?: string;
		intro?: string;
	};

	const rows: Row[] = [
		{
			id: 'piste-bidir',
			label: 'Piste cyclable (bidirectionnelle)',
			render: 'solid',
			osm: [
				{
					all: ['highway=cycleway'],
					note: 'sauf si foot=designated ET segregated=no (alors voie verte). Bidir par défaut, sauf oneway=yes sans oneway:bicycle=no.',
				},
				{ all: ['cycleway:both=track'] },
				{
					all: [
						{ or: ['cycleway:left=track', 'cycleway:right=track'] },
						{ or: ['cycleway:left:oneway=no', 'cycleway:right:oneway=no'] },
					],
				},
			],
			grandLyon: 'typeamenagement=Piste Cyclable, senscirculation=Double',
		},
		{
			id: 'piste-unidir',
			label: 'Piste cyclable (unidirectionnelle)',
			render: 'solid-thin',
			osm: [
				{
					all: [{ or: ['cycleway:left=track', 'cycleway:right=track'] }],
					note: 'sans cycleway:*:oneway=no (sinon bidir)',
				},
				{
					all: ['cycleway=track'],
					note: 'sur voie à sens unique sans contre-sens vélo',
				},
			],
			grandLyon: 'typeamenagement=Piste Cyclable, senscirculation≠Double',
		},
		{
			id: 'voie-verte',
			label: 'Voie verte',
			customSwatch: 'voie-verte',
			intro:
				'Cette catégorie regroupe deux choses : les voies vertes officielles (panneau C115, infrastructure dédiée) et les pistes cyclables partagées avec les piétons sans séparation (highway=cycleway + foot=designated + segregated=no, ce que CyclOSM distingue sous le nom de "shared track"). Les deux sont rendues à l\'identique sur la carte.',
			osm: [
				{
					all: ['traffic_sign=FR:C115', { or: ['bicycle=designated', 'bicycle=yes'] }],
					note: 'panneau officiel C115',
				},
				{ all: ['highway=cycleway', 'foot=designated', 'segregated=no'] },
				{ all: ['highway=path', 'bicycle=designated'] },
				{
					all: [
						'highway=pedestrian',
						{ or: ['bicycle=yes', 'bicycle=designated'] },
						'sauf segregated=yes',
					],
				},
				{
					all: [
						{ or: ['highway=service', 'highway=track', 'highway=unclassified'] },
						'bicycle=designated',
						{
							or: [
								'motor_vehicle=no',
								'motor_vehicle=destination',
								'motorcar=no',
								'foot=designated',
							],
						},
					],
					note: 'heuristique au-delà du wiki OSM : chemins ruraux à accès motorisé restreint',
				},
			],
			grandLyon: 'typeamenagement=Voie verte',
		},
		{
			id: 'bande',
			label: 'Bande cyclable',
			render: 'dashed',
			osm: [
				{ all: [{ or: ['cycleway=lane', 'cycleway=opposite_lane'] }] },
				{ all: [{ or: ['cycleway:left=lane', 'cycleway:right=lane', 'cycleway:both=lane'] }] },
				{
					all: ['cycleway:both:lane=advisory'],
					note: 'bidirectionnelle (chaucidou)',
				},
			],
			grandLyon: 'typeamenagement=Bande Cyclable',
		},
		{
			id: 'bus-velo',
			label: 'Voie bus-vélo',
			render: 'dotted',
			osm: [
				{
					all: [{ or: ['cycleway=share_busway', 'cycleway=shared_busway'] }],
					note: 'shared_busway est une variante non documentée, acceptée pour compatibilité',
				},
				{
					all: [
						{
							or: [
								'cycleway:left=share_busway',
								'cycleway:right=share_busway',
								'cycleway:both=share_busway',
							],
						},
					],
				},
			],
			grandLyon: 'typeamenagement=Couloir bus vélo (élargi ou non)',
		},
		{
			id: 'velorue',
			label: 'Vélorue',
			render: 'velorue',
			osm: [{ all: ['bicycle_road=yes'] }, { all: ['cyclestreet=yes'] }],
		},
		{
			id: 'dsc',
			label: 'Double sens cyclable',
			render: 'arrow',
			osm: [
				{ all: ['oneway=yes', 'oneway:bicycle=no'], note: 'tagging recommandé' },
				{
					all: [{ or: ['cycleway=opposite', 'cycleway=opposite_lane', 'cycleway=opposite_track'] }],
					note: 'valeurs dépréciées par le wiki, conservées pour les données existantes',
				},
				{ all: ['highway=living_street', 'oneway=yes', 'sauf oneway:bicycle=yes'] },
			],
			grandLyon: 'typeamenagement=Double sens cyclable',
		},
		{
			id: 'trottoir',
			label: 'Voie piétonne (vélos autorisés)',
			render: 'dashed-thin',
			intro:
				"Trottoir, chemin ou cheminement piéton où les vélos sont tolérés ou autorisés, sans aménagement dédié. Peu de garanties : largeur, conflits piétons, qualité variable. Distinct d'une voie verte qui est une infrastructure officielle (et souvent plus large et/ou confortable).",
			osm: [
				{
					all: [
						'highway=footway',
						{ or: ['bicycle=designated', 'bicycle=yes', 'bicycle=permissive'] },
					],
				},
			],
		},
	];

	const pavedList = Array.from(PAVED_SURFACES).join(', ');
</script>

<div class="mx-auto max-w-3xl py-8">
	<header class="mb-6">
		<h1 class="mb-3 text-3xl font-bold text-brand-navy md:text-4xl">Légende</h1>
		<p class="text-gray-700">
			Comment chaque type d'aménagement cyclable est identifié à partir des tags OpenStreetMap et de
			la voirie Grand Lyon.
		</p>
	</header>

	<div class="space-y-4">
		{#each rows as row (row.id)}
			<article class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
				<div class="mb-3 flex items-center gap-3">
					{#if row.customSwatch === 'voie-verte'}
						<div class="flex flex-col gap-1">
							<svg
								viewBox="0 0 48 12"
								class="h-3 w-12 shrink-0"
								role="presentation"
								aria-hidden="true"
							>
								<line
									x1="0"
									y1="6"
									x2="48"
									y2="6"
									stroke={VOIE_VERTE_PAVED}
									stroke-width="4"
									stroke-linecap="round"
									stroke-dasharray="0.1 6"
								/>
							</svg>
							<svg
								viewBox="0 0 48 12"
								class="h-3 w-12 shrink-0"
								role="presentation"
								aria-hidden="true"
							>
								<line
									x1="0"
									y1="6"
									x2="48"
									y2="6"
									stroke={VOIE_VERTE_NON_PAVED}
									stroke-width="4"
									stroke-linecap="round"
									stroke-dasharray="0.1 6"
								/>
							</svg>
						</div>
					{:else}
						<svg
							viewBox="0 0 48 12"
							class="h-3 w-12 shrink-0"
							role="presentation"
							aria-hidden="true"
						>
							{#if row.render === 'solid'}
								<line
									x1="0"
									y1="6"
									x2="48"
									y2="6"
									stroke={COLOR}
									stroke-width="4"
									stroke-linecap="round"
								/>
							{:else if row.render === 'solid-thin'}
								<line
									x1="0"
									y1="6"
									x2="48"
									y2="6"
									stroke={COLOR}
									stroke-width="2"
									stroke-linecap="round"
								/>
							{:else if row.render === 'dashed'}
								<line
									x1="0"
									y1="6"
									x2="48"
									y2="6"
									stroke={COLOR}
									stroke-width="3"
									stroke-dasharray="5 3"
								/>
							{:else if row.render === 'dashed-thin'}
								<line
									x1="0"
									y1="6"
									x2="48"
									y2="6"
									stroke={COLOR}
									stroke-width="1.5"
									stroke-dasharray="3 3"
								/>
							{:else if row.render === 'dotted'}
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
							{:else if row.render === 'velorue'}
								<line
									x1="0"
									y1="6"
									x2="48"
									y2="6"
									stroke={COLOR}
									stroke-width="4"
									stroke-dasharray="8 4"
								/>
							{:else if row.render === 'arrow'}
								<line x1="8" y1="6" x2="24" y2="6" stroke="#000000" stroke-width="2" />
								<polygon points="0,6 8,2 8,10" fill="#000000" />
								<line x1="24" y1="6" x2="40" y2="6" stroke="#0369a1" stroke-width="2" />
								<polygon points="48,6 40,2 40,10" fill="#0369a1" />
							{/if}
						</svg>
					{/if}
					<h2 class="text-lg font-semibold text-brand-navy">{row.label}</h2>
				</div>

				{#if row.intro}
					<p class="mb-3 text-xs text-gray-600">{row.intro}</p>
				{/if}

				{#if row.customSwatch === 'voie-verte'}
					<p class="mb-3 text-xs text-gray-500">
						Deux variantes de rendu : revêtue (clair) ou stabilisée (foncé), selon le tag
						<code class="rounded bg-gray-100 px-1 py-0.5 font-mono">surface</code>. Surfaces
						revêtues : {pavedList}. Surface absente = considérée revêtue.
					</p>
				{/if}

				<dl class="grid grid-cols-1 gap-2 text-sm md:grid-cols-[max-content_1fr] md:gap-x-4">
					<dt class="font-semibold text-gray-600">OSM</dt>
					<dd>
						<ul class="space-y-1">
							{#each row.osm as group, i (i)}
								{#if i > 0}
									<li class="flex items-center gap-2 py-0.5" aria-hidden="true">
										<span
											class="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800"
											>OU</span
										>
										<span class="h-px flex-1 bg-gray-200"></span>
									</li>
								{/if}
								<li class="flex flex-wrap items-center gap-1 text-gray-700">
									{#each group.all as cond, j (j)}
										{#if j > 0}
											<span
												class="rounded bg-gray-200 px-1 py-0.5 text-[10px] font-semibold text-gray-700"
												>ET</span
											>
										{/if}
										{#if typeof cond === 'string'}
											<code
												class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800"
												>{cond}</code
											>
										{:else}
											<span class="inline-flex flex-wrap items-center gap-1">
												{#each cond.or as alt, k (k)}
													{#if k > 0}
														<span
															class="rounded bg-blue-100 px-1 py-0.5 text-[10px] font-semibold text-blue-800"
															>OU</span
														>
													{/if}
													<code
														class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800"
														>{alt}</code
													>
												{/each}
											</span>
										{/if}
									{/each}
									{#if group.note}
										<span class="text-xs text-gray-500 italic">→ {group.note}</span>
									{/if}
								</li>
							{/each}
						</ul>
					</dd>
					{#if row.grandLyon}
						<dt class="font-semibold text-gray-600">Grand Lyon</dt>
						<dd>
							<code class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800"
								>{row.grandLyon}</code
							>
						</dd>
					{/if}
				</dl>
			</article>
		{/each}
	</div>
</div>
