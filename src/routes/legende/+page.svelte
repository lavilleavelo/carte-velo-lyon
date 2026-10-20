<script lang="ts">
	import type { LegendId } from '$lib/utils/cyclewayLegend';
	import { PAVED_SURFACES } from '$lib/utils/osmCycleway';
	import { CHAUCIDOU_COLOR, GREENWAY_COLOR } from '$lib/components/map/layers/cyclewayStyles';

	const COLOR = '#0369a1';

	type Render = 'solid' | 'solid-thin' | 'dashed' | 'dashed-thin' | 'dotted' | 'velorue' | 'arrow';

	type Cond = string | { or: string[] };
	type Group = { all: Cond[]; note?: string };

	type Row = {
		id: LegendId | string;
		label: string;
		render?: Render;
		color?: string;
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
				'Cette catégorie regroupe deux choses : les voies vertes officielles (panneau C115, infrastructure dédiée) et les pistes cyclables partagées avec les piétons sans séparation (highway=cycleway + foot=designated + segregated=no, ce que CyclOSM distingue sous le nom de "shared track"). Les deux sont rendues à l\'identique sur la carte. Sur une rue piétonne (highway=pedestrian), elles sont classées en zone piétonne.',
			osm: [
				{
					all: ['traffic_sign=FR:C115', { or: ['bicycle=designated', 'bicycle=yes'] }],
					note: 'panneau officiel C115',
				},
				{ all: ['highway=cycleway', 'foot=designated', 'segregated=no'] },
				{ all: ['highway=path', 'bicycle=designated'] },
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
			id: 'zone-pietonne',
			label: 'Zone piétonne, allée de parc',
			render: 'dotted',
			color: GREENWAY_COLOR,
			intro:
				'Rue piétonne ou allée de parc où les vélos sont admis : les piétons sont prioritaires et les vélos roulent à allure modérée (au pas dans une aire piétonne, panneau B54).',
			osm: [
				{
					all: [
						'highway=pedestrian',
						{ or: ['bicycle=yes', 'bicycle=designated'] },
						'sauf segregated=yes',
					],
				},
			],
		},
		{
			id: 'bande',
			label: 'Bande cyclable',
			render: 'dashed',
			osm: [
				{ all: [{ or: ['cycleway=lane', 'cycleway=opposite_lane'] }] },
				{ all: [{ or: ['cycleway:left=lane', 'cycleway:right=lane', 'cycleway:both=lane'] }] },
			],
			grandLyon: 'typeamenagement=Bande Cyclable',
		},
		{
			id: 'chaucidou',
			label: 'Chaucidou (CVCB)',
			render: 'dashed-thin',
			color: CHAUCIDOU_COLOR,
			intro:
				"Chaussée à voie centrale banalisée : une voie centrale pour les voitures dans les deux sens et une rive cyclable de chaque côté. Les voitures roulent sur la rive pour se croiser : beaucoup moins protecteur qu'une bande cyclable, d'où un trait plus fin et plus pâle.",
			osm: [
				{
					all: [
						{ or: ['cycleway=lane', 'cycleway:both=lane'] },
						{ or: ['cycleway:lane=advisory', 'cycleway:both:lane=advisory'] },
					],
				},
				{
					all: [
						{ or: ['cycleway:left=lane', 'cycleway:right=lane'] },
						{ or: ['cycleway:left:lane=advisory', 'cycleway:right:lane=advisory'] },
					],
					note: 'du côté concerné',
				},
			],
			grandLyon: 'typeamenagement=Bande Cyclable (non distinguée)',
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
			intro:
				'Rue à sens unique pour les voitures, ouverte aux vélos dans les deux sens. Flèche bleue : vélos à contresens ; flèche grise : sens des voitures.',
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
									stroke={GREENWAY_COLOR}
									stroke-width="4"
									stroke-linecap="round"
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
									stroke={GREENWAY_COLOR}
									stroke-width="4"
									stroke-dasharray="5 3"
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
									stroke={row.color ?? COLOR}
									stroke-width="4"
									stroke-linecap="round"
								/>
							{:else if row.render === 'solid-thin'}
								<line
									x1="0"
									y1="6"
									x2="48"
									y2="6"
									stroke={row.color ?? COLOR}
									stroke-width="2"
									stroke-linecap="round"
								/>
							{:else if row.render === 'dashed'}
								<line
									x1="0"
									y1="6"
									x2="48"
									y2="6"
									stroke={row.color ?? COLOR}
									stroke-width="3"
									stroke-dasharray="5 3"
								/>
							{:else if row.render === 'dashed-thin'}
								<line
									x1="0"
									y1="6"
									x2="48"
									y2="6"
									stroke={row.color ?? COLOR}
									stroke-width="1.5"
									stroke-dasharray="3 3"
								/>
							{:else if row.render === 'dotted'}
								<line
									x1="0"
									y1="6"
									x2="48"
									y2="6"
									stroke={row.color ?? COLOR}
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
									stroke={row.color ?? COLOR}
									stroke-width="4"
									stroke-dasharray="8 4"
								/>
							{:else if row.render === 'arrow'}
								<line x1="0" y1="6" x2="48" y2="6" stroke="#73b3e0" stroke-width="1.5" />
								<g transform="translate(14 0.5) scale(0.5)">
									<g fill="#ffffff" stroke="#ffffff" stroke-width="2.6" stroke-linejoin="round">
										<path d="M2 6 L10 1 V4.5 H37 V7.5 H10 V11 Z" />
										<path d="M38 16 L31 11.5 V14.8 H6 V17.2 H31 V20.5 Z" />
									</g>
									<path fill="#0369a1" d="M2 6 L10 1 V4.5 H37 V7.5 H10 V11 Z" />
									<path fill="#6b7280" d="M38 16 L31 11.5 V14.8 H6 V17.2 H31 V20.5 Z" />
								</g>
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
						Deux variantes de rendu : revêtue (trait plein) ou non revêtue (tirets), selon le tag
						<code class="rounded bg-gray-100 px-1 py-0.5 font-mono">surface</code>. Surfaces
						revêtues : {pavedList}. Surface absente = considérée revêtue ; valeur multiple (a;b) =
						revêtue si toutes ses parties le sont.
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
