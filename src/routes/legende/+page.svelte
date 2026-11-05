<script lang="ts">
	import type { LegendId } from '$lib/utils/cyclewayLegend';
	import { PAVED_SURFACES } from '$lib/utils/osmCycleway';
	import { CHAUCIDOU_COLOR, GREENWAY_COLOR } from '$lib/components/map/layers/cyclewayStyles';

	const COLOR = '#0369a1';

	type Render = 'solid' | 'solid-thin' | 'dashed' | 'dashed-thin' | 'dotted' | 'velorue' | 'arrow';

	type Cond = string | { or: string[] };
	type Group = { all: Cond[]; note?: string };

	type Width = { label: string; value: string; tone: 'min' | 'ok' | 'ideal' };

	type Row = {
		id: LegendId | string;
		label: string;
		render?: Render;
		color?: string;
		customSwatch?: 'voie-verte';
		osm: Group[];
		grandLyon?: string;
		intro?: string;
		definition?: string;
		widths?: Width[];
		notes?: string[];
		fiche?: string;
	};

	const GLIDE_URL = 'https://amenagements-cyclables.glide.page/';
	const fiche = (rowId: string) => `${GLIDE_URL}dl/liste/S/97a4c9/r/${rowId}`;

	const toneClass: Record<Width['tone'], string> = {
		min: 'text-pink-600',
		ok: 'text-amber-600',
		ideal: 'text-green-700',
	};

	const rows: Row[] = [
		{
			id: 'piste-bidir',
			label: 'Piste cyclable (bidirectionnelle)',
			render: 'solid',
			definition:
				'Aménagement exclusivement réservé aux cyclistes et séparé physiquement des autres usagers (bordure, séparateur, terre-plein). Les vélos y circulent dans les deux sens.',
			widths: [
				{ label: 'Minimale', value: '2,40 m', tone: 'min' },
				{ label: 'Satisfaisante', value: '3 m', tone: 'ok' },
				{ label: 'Idéale', value: '4 m', tone: 'ideal' },
			],
			notes: [
				'Séparateur : 30 cm recommandés, 50 cm idéal. 50 cm obligatoires si du stationnement le longe, pour limiter le risque d’emportiérage.',
			],
			fiche: fiche('bluE6UVRK9QYHjitHHMT'),
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
			definition:
				'Piste réservée aux cyclistes et séparée physiquement, dans un seul sens de circulation (en général une de chaque côté de la rue).',
			widths: [
				{ label: 'Minimale', value: '1,70 m', tone: 'min' },
				{ label: 'Satisfaisante', value: '2 m', tone: 'ok' },
				{ label: 'Idéale', value: '2,50 m', tone: 'ideal' },
			],
			notes: [
				'1,70 m permet le passage de la balayeuse ; 2 m permet de dépasser, 2,50 m de dépasser confortablement.',
			],
			fiche: fiche('7HNCQnAOhKPxeIdJNSJe'),
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
			definition:
				'Voie partagée entre piétons et cyclistes, interdite aux véhicules motorisés (panneau C115). La cohabitation ne fonctionne qu’avec de faibles flux de piétons et de vélos : peu adaptée en ville.',
			widths: [
				{ label: 'Minimale recommandée', value: '3 m', tone: 'min' },
				{ label: 'Idéale', value: '4 m', tone: 'ideal' },
			],
			notes: ['Les piétons marchent à droite, comme les vélos.'],
			fiche: fiche('Xe4JYNW3EmO01iAN9bQz'),
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
			definition:
				'Voie réservée aux cyclistes sur la chaussée, séparée des voitures uniquement par un marquage au sol.',
			widths: [
				{ label: 'Minimale', value: '1,20 m', tone: 'min' },
				{ label: 'Recommandée', value: '1,50 m', tone: 'ok' },
				{ label: 'Idéale', value: '2 m', tone: 'ideal' },
			],
			notes: [
				'Espace tampon de 50 cm obligatoire si du stationnement la longe, pour limiter le risque d’emportiérage.',
				'Trop large, une bande cyclable risque de servir de stationnement aux voitures.',
			],
			fiche: fiche('fLa5JUgqgWbmAlI0ulQs'),
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
			definition:
				'Chaussée à voie centrale banalisée, ou « chaussée à circulation douce ». Aménagement de dernier recours, pour assurer une continuité cyclable là où aucune autre solution n’est possible.',
			notes: [
				'Conditions : route limitée à 70 km/h maximum, moins de 5 000 véhicules par jour, bonne co-visibilité (pas de virages).',
			],
			fiche: fiche('y3WiGflVQcx4chPxIvKP'),
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
			definition: 'Couloir de bus dans lequel les cyclistes sont autorisés à circuler.',
			widths: [
				{ label: 'Minimale', value: '3,25 m (3,50 m à contresens)', tone: 'min' },
				{ label: 'Recommandée', value: '4,50 m', tone: 'ideal' },
			],
			notes: ['4,50 m permettent au bus de doubler un vélo.'],
			fiche: fiche('IeZ2UuswaLO6CznOxJPo'),
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
			definition:
				'Rue où vélos et voitures partagent la chaussée, mais où le trafic motorisé est quasi inexistant et le flux vélo fort. Les règles sont celles d’une rue « normale ».',
			notes: [
				'Pour qu’elle fonctionne : section à fort potentiel vélo reliée au réseau structurant, trafic motorisé limité à la desserte locale (moins de 1 000 véhicules par jour), à l’écart des lignes de transport en commun, stationnement limité.',
			],
			fiche: fiche('lWi3URAThvRahU6ilrAS'),
			osm: [{ all: ['bicycle_road=yes'] }, { all: ['cyclestreet=yes'] }],
		},
		{
			id: 'dsc',
			label: 'Double sens cyclable',
			render: 'arrow',
			definition:
				'Rue à sens unique pour les voitures, ouverte aux vélos dans les deux sens. Il crée des raccourcis pour les vélos ; le contact visuel avec les automobilistes limite le danger.',
			widths: [{ label: 'Chaussée minimale', value: '2,70 m', tone: 'min' }],
			notes: [
				'Obligatoire en zone 30 (art. R412-28-1 du Code de la route), sauf arrêté motivé : ligne de bus, virage dangereux, forte pente ou manque de visibilité.',
				'Rue étroite (voie < 3,5 m) : pictogrammes au sol ; rue large (voie > 4 m) : marquage séparatif.',
			],
			fiche: fiche('OeFd6fYLxKFk612M24O3'),
			intro: 'Flèche bleue : vélos à contresens ; flèche grise : sens des voitures.',
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
			Les types d'aménagements cyclables affichés sur la carte : définition, largeurs recommandées
			et identification à partir des tags OpenStreetMap et de la voirie Grand Lyon.
		</p>
		<p
			class="mt-3 rounded-lg border border-brand-navy/10 bg-brand-navy/5 p-3 text-sm text-gray-700"
		>
			Définitions et largeurs issues de la présentation « Introduction aux aménagements cyclables »
			de <a class="underline hover:text-brand-navy" href="https://lavilleavelo.org"
				>La Ville à Vélo</a
			>. Pour comparer les aménagements selon la vitesse, le trafic ou la largeur de la rue :
			<a
				class="font-semibold text-brand-navy underline"
				href={GLIDE_URL}
				target="_blank"
				rel="noopener">l'outil Aménagements cyclables ↗</a
			>.
		</p>
	</header>

	<div class="space-y-4">
		{#each rows as row (row.id)}
			<article
				id={row.id}
				class="scroll-mt-20 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
			>
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
					{#if row.fiche}
						<a
							href={row.fiche}
							target="_blank"
							rel="noopener"
							class="ml-auto shrink-0 text-xs text-gray-500 underline hover:text-brand-navy"
							>Fiche détaillée ↗</a
						>
					{/if}
				</div>

				{#if row.definition}
					<p class="mb-3 text-sm text-gray-700">{row.definition}</p>
				{/if}

				{#if row.widths}
					<ul class="mb-3 flex flex-wrap gap-2 text-xs">
						{#each row.widths as width (width.label)}
							<li class="rounded-md bg-gray-50 px-2 py-1 ring-1 ring-gray-200">
								<span class="font-semibold {toneClass[width.tone]}">{width.label}</span>
								<span class="text-gray-800">{width.value}</span>
							</li>
						{/each}
					</ul>
				{/if}

				{#if row.notes}
					<ul class="mb-3 list-disc space-y-1 pl-4 text-xs text-gray-600">
						{#each row.notes as note (note)}
							<li>{note}</li>
						{/each}
					</ul>
				{/if}

				{#if row.intro}
					<p class="mb-3 text-xs text-gray-600">
						{#if row.definition}<span class="font-semibold">Sur la carte :</span>{/if}
						{row.intro}
					</p>
				{/if}

				<details>
					<summary
						class="mb-2 cursor-pointer text-xs font-semibold text-gray-500 select-none hover:text-brand-navy"
					>
						Identification dans les données (OSM, Grand Lyon)
					</summary>
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
				</details>
			</article>
		{/each}
	</div>
</div>
