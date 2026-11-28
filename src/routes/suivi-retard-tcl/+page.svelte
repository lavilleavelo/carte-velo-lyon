<script lang="ts">
	import TclLineChart from '$lib/components/tcl/TclLineChart.svelte';
	import TclDelayMap from '$lib/components/tcl/TclDelayMap.svelte';
	import TclHeatmap from '$lib/components/tcl/TclHeatmap.svelte';
	import TclLineSelect from '$lib/components/tcl/TclLineSelect.svelte';
	import TclStopSelect from '$lib/components/tcl/TclStopSelect.svelte';
	import TclSection from '$lib/components/tcl/TclSection.svelte';
	import TclStat from '$lib/components/tcl/TclStat.svelte';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const report = $derived(data.report);

	type WindowKey = 'day' | 'morning' | 'evening';
	type Metric = 'median' | 'p90';

	const DIRECTIONS = [
		{
			key: 'east',
			label: 'Saône → Cordeliers',
			detail: 'du quai Saint-Antoine vers la place des Cordeliers',
		},
		{
			key: 'west',
			label: 'Cordeliers → Saône',
			detail: 'de la place des Cordeliers vers le quai Saint-Antoine',
		},
	] as const;

	const FEEDS = [
		{ key: 'vm', label: 'Positions des véhicules' },
		{ key: 'et', label: 'Horaires aux arrêts' },
		{ key: 'sx', label: 'Perturbations' },
		{ key: 'stops', label: 'Liste des arrêts' },
	] as const;

	const SERIES_COLORS: Record<string, string> = {
		selection: 'var(--chart-1)',
		fortes: 'var(--chart-2)',
		trams: 'var(--chart-6)',
	};

	const MAP_BINS = [
		{ min: 1, color: '#ffd6a7', label: '1 à 5 s' },
		{ min: 5, color: '#ffb86a', label: '5 à 15 s' },
		{ min: 15, color: '#ff8904', label: '15 à 30 s' },
		{ min: 30, color: '#f54900', label: '30 à 60 s' },
		{ min: 60, color: '#9f2d00', label: '60 s et plus' },
	];
	const SPENT_BINS = [
		{ min: 15, color: '#ffd6a7', label: '15 à 30 s' },
		{ min: 30, color: '#ffb86a', label: '30 à 45 s' },
		{ min: 45, color: '#ff8904', label: '45 à 60 s' },
		{ min: 60, color: '#f54900', label: '60 à 90 s' },
		{ min: 90, color: '#9f2d00', label: '90 s et plus' },
	];
	const HEATMAP_BINS: Record<Metric, { min: number; color: string; label: string }[]> = {
		median: [
			{ min: 1, color: '#ffd6a7', label: '1 à 2 min' },
			{ min: 2, color: '#ffb86a', label: '2 à 4 min' },
			{ min: 4, color: '#ff8904', label: '4 à 6 min' },
			{ min: 6, color: '#f54900', label: '6 à 10 min' },
			{ min: 10, color: '#9f2d00', label: '10 min et plus' },
		],
		p90: [
			{ min: 2, color: '#ffd6a7', label: '2 à 4 min' },
			{ min: 4, color: '#ffb86a', label: '4 à 7 min' },
			{ min: 7, color: '#ff8904', label: '7 à 10 min' },
			{ min: 10, color: '#f54900', label: '10 à 15 min' },
			{ min: 15, color: '#9f2d00', label: '15 min et plus' },
		],
	};
	const NEUTRAL = '#d1d5db';

	const COLUMN_LABELS: Record<string, string> = {
		selection: 'sélection',
		fortes: 'autres C et TB',
		trams: 'trams',
	};

	const dayFormat = new Intl.DateTimeFormat('fr-FR', {
		day: 'numeric',
		month: 'short',
		timeZone: 'Europe/Paris',
	});
	const shortDayFormat = new Intl.DateTimeFormat('fr-FR', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		timeZone: 'Europe/Paris',
	});
	const longDayFormat = new Intl.DateTimeFormat('fr-FR', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		timeZone: 'Europe/Paris',
	});
	const fullDayFormat = new Intl.DateTimeFormat('fr-FR', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Europe/Paris',
	});
	const timeFormat = new Intl.DateTimeFormat('fr-FR', {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Europe/Paris',
	});
	const yearDayFormat = new Intl.DateTimeFormat('fr-FR', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'Europe/Paris',
	});
	const numberFormat = new Intl.NumberFormat('fr-FR');

	let timeWindow = $state<WindowKey>('day');
	let metric = $state<Metric>('median');
	let mapPeriod = $state<'before' | 'after'>('before');
	let mapMetric = $state<'spent' | 'lost'>('spent');
	let liveFeeds = $state.raw<typeof report.collector.feeds | null>(null);

	$effect(() => {
		const timer = setInterval(async () => {
			const response = await fetch('/api/tcl/status').catch(() => null);
			if (response?.ok) {
				liveFeeds = (await response.json()).feeds;
			}
		}, 60_000);
		return () => clearInterval(timer);
	});

	function noonOf(day: string): Date {
		return new Date(`${day}T12:00:00`);
	}

	function formatDuration(seconds: number | null | undefined): string {
		if (seconds === null || seconds === undefined) {
			return '—';
		}
		const negative = seconds < 0;
		const total = Math.round(Math.abs(seconds));
		const hours = Math.floor(total / 3600);
		const minutes = Math.floor((total % 3600) / 60);
		const rest = total % 60;
		let text: string;
		if (hours > 0) {
			text = minutes > 0 ? `${hours} h ${String(minutes).padStart(2, '0')}` : `${hours} h`;
		} else if (minutes > 0) {
			text = rest > 0 ? `${minutes} min ${String(rest).padStart(2, '0')} s` : `${minutes} min`;
		} else {
			text = `${rest} s`;
		}
		return negative ? `−${text}` : text;
	}

	function capitalize(text: string): string {
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	function formatHour(value: unknown): string {
		return Number.isInteger(value) ? `${value} h` : '';
	}

	function formatHourRange(value: unknown): string {
		return `de ${value} h à ${Number(value) + 1} h`;
	}

	function fillHours<T extends { hour: number }>(rows: T[], empty: Omit<T, 'hour'>): T[] {
		const byHour = new Map(rows.map((row) => [row.hour, row]));
		const hours = [...Array.from({ length: 19 }, (_, index) => index + 5), 0, 1, 2, 3, 4].filter(
			(hour) => hour >= 5 || byHour.has(hour),
		);
		return hours.map((hour) => byHour.get(hour) ?? ({ ...empty, hour } as T));
	}

	function formatClock(seconds: number): string {
		return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
	}

	function formatMinutes(value: number | null | undefined): string {
		return value === null || value === undefined
			? '—'
			: `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} min`;
	}

	function minutesDelta(after: number | null, before: number | null): string | null {
		if (after === null || before === null) {
			return null;
		}
		const delta = Math.round((after - before) * 10) / 10;
		const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
		return `${sign}${Math.abs(delta).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} min`;
	}

	function secondsDelta(after: number | null, before: number | null): string | null {
		if (after === null || before === null) {
			return null;
		}
		const delta = after - before;
		return `${delta > 0 ? '+' : delta < 0 ? '' : '±'}${formatDuration(delta)}`;
	}

	function formatBytes(bytes: number): string {
		if (bytes >= 1e9) {
			return `${(bytes / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Go`;
		}
		if (bytes >= 1e6) {
			return `${(bytes / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
		}
		return `${Math.round(bytes / 1e3).toLocaleString('fr-FR')} Ko`;
	}

	function formatTime(value: string | null | undefined): string {
		return value ? timeFormat.format(new Date(value)) : '—';
	}

	function formatDay(value: unknown): string {
		return value instanceof Date ? dayFormat.format(value) : String(value);
	}

	function formatLongDay(value: unknown): string {
		return value instanceof Date ? longDayFormat.format(value) : String(value);
	}

	function compactDay(value: string | null): string {
		if (!value || value.length !== 8) {
			return value ?? '—';
		}
		return yearDayFormat.format(
			noonOf(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`),
		);
	}

	const feeds = $derived(liveFeeds ?? report.collector.feeds);
	const reopening = $derived(noonOf(report.reopeningDay));
	const ranges = $derived(report.ranges);
	const hasAfter = $derived(
		report.days.some((row) => row.day >= ranges.after.from && row.day <= ranges.after.to),
	);
	const rangeLabels = $derived({
		before: `du ${dayFormat.format(noonOf(ranges.before.from))} au ${dayFormat.format(noonOf(ranges.before.to))}`,
		after: `du ${dayFormat.format(noonOf(ranges.after.from))} au ${dayFormat.format(noonOf(ranges.after.to))}`,
	});
	const windowLabel = $derived(report.windows[timeWindow].toLowerCase());
	const metricLabel = $derived(
		metric === 'median' ? 'retard médian' : 'retard dépassé par 1 véhicule sur 10',
	);
	const isGrenette = $derived(report.selection.key === 'grenette');
	const showCrossings = $derived(isGrenette || report.crossings.total > 0);
	const firstDay = $derived(report.days[0]?.day ?? null);

	const sections = $derived([
		{ id: 'resume', label: 'Résumé' },
		{ id: 'retards', label: 'Retard par jour' },
		{ id: 'heures', label: 'Heure par heure' },
		...(showCrossings ? [{ id: 'grenette', label: 'Rue Grenette' }] : []),
		{ id: 'carte', label: 'Carte' },
		...(report.selection.lines !== null ? [{ id: 'arrets', label: 'Entre deux arrêts' }] : []),
		{ id: 'collecte', label: 'Collecte' },
		{ id: 'methode', label: 'Méthode et limites' },
	]);

	const annotations = $derived(
		hasAfter
			? [
					{
						type: 'line' as const,
						x: new Date(`${ranges.after.from}T00:00:00`),
						label: 'Période comparée',
						labelPlacement: 'top-right' as const,
						props: {
							line: { class: 'stroke-gray-500 [stroke-dasharray:4_4]' },
							label: { class: 'fill-gray-600 text-xs' },
						},
					},
				]
			: [],
	);

	const delaySeries = $derived(
		report.delays.series.map((item) => ({
			key: item.key,
			label: item.label,
			color: SERIES_COLORS[item.key],
		})),
	);

	const delayDaily = $derived(
		report.delays.daily[timeWindow].map((row) => ({
			date: noonOf(row.day),
			...Object.fromEntries(
				report.delays.series.map((item) => [item.key, row[item.key]?.[metric] ?? null]),
			),
		})),
	);

	const delayHourly = $derived(
		fillHours(
			report.delays.hourly.map((row) => ({
				hour: row.hour,
				before: row.before[metric] as number | null,
				after: row.after[metric] as number | null,
			})),
			{ before: null, after: null },
		),
	);

	const beforeAfterSeries = $derived([
		{ key: 'before', label: `Référence (${rangeLabels.before})`, color: 'var(--chart-2)' },
		...(hasAfter
			? [{ key: 'after', label: `Comparée (${rangeLabels.after})`, color: 'var(--chart-1)' }]
			: []),
	]);

	const crossingDaily = $derived(
		Object.fromEntries(
			DIRECTIONS.map((direction) => [
				direction.key,
				report.crossings.daily[timeWindow][direction.key].map((row) => ({
					date: noonOf(row.day),
					median: row.median,
					p90: row.p90,
				})),
			]),
		) as Record<'east' | 'west', { date: Date; median: number | null; p90: number | null }[]>,
	);

	const delayPeriods = $derived(report.delays.periods[timeWindow]);
	const crossingPeriods = $derived(report.crossings.periods[timeWindow]);
	const totalBytes = $derived(report.days.reduce((sum, row) => sum + row.bytes, 0));
	const completeDays = $derived(report.days.filter((row) => row.complete));
	const averageDayBytes = $derived(
		completeDays.length > 0
			? completeDays.reduce((sum, row) => sum + row.bytes, 0) / completeDays.length
			: null,
	);
	const mapCells = $derived(report.cells[mapPeriod]);
	const segment = $derived(report.segment);
	const segmentDaily = $derived(
		segment
			? segment.daily[timeWindow].map((row) => ({
					date: noonOf(row.day),
					planned: row.planned,
					actual: row.actual,
					actualP90: row.actualP90,
				}))
			: [],
	);

	let fromStop = $derived<number | null>(report.selectedStops.from);
	let toStop = $derived<number | null>(report.selectedStops.to);

	async function submitFilters() {
		await tick();
		(document.getElementById('tcl-filters') as HTMLFormElement | null)?.requestSubmit();
	}

	const arrivalOptions = $derived(
		fromStop === null
			? []
			: report.stopOptions.flatMap((group) => {
					const index = group.stops.findIndex((stop) => stop.id === fromStop);
					return index >= 0 && index < group.stops.length - 1
						? [{ ...group, stops: group.stops.slice(index + 1) }]
						: [];
				}),
	);

	function chooseFrom(id: number | null) {
		fromStop = id;
		if (
			toStop !== null &&
			!arrivalOptions.some((group) => group.stops.some((stop) => stop.id === toStop))
		) {
			toStop = null;
		}
		submitFilters();
	}

	function chooseTo(id: number | null) {
		toStop = id;
		submitFilters();
	}

	function chooseStop(id: number) {
		if (fromStop === null || toStop !== null) {
			fromStop = id;
			toStop = null;
		} else if (id !== fromStop) {
			toStop = id;
		}
		submitFilters();
	}
</script>

{#snippet legend(
	bins: { min: number; color: string; label: string }[],
	neutral: string,
	unit: string,
)}
	<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-700">
		<span class="flex items-center gap-1.5">
			<span class="size-3 rounded-[2px]" style:background={NEUTRAL}></span>
			{neutral}
		</span>
		{#each bins as bin (bin.min)}
			<span class="flex items-center gap-1.5">
				<span class="size-3 rounded-[2px]" style:background={bin.color}></span>
				{bin.label}
			</span>
		{/each}
		<span class="text-gray-500">{unit}</span>
	</div>
{/snippet}

{#snippet toggle(
	options: { key: string; label: string }[],
	current: string,
	onSelect: (key: string) => void,
)}
	<div class="inline-flex flex-wrap rounded-lg border border-gray-200 bg-white p-1" role="group">
		{#each options as option (option.key)}
			<button
				type="button"
				class={[
					'rounded-md px-3 py-1.5 text-sm transition-colors',
					current === option.key ? 'bg-brand-navy text-white' : 'text-gray-700 hover:bg-gray-100',
				]}
				aria-pressed={current === option.key}
				onclick={() => onSelect(option.key)}
			>
				{option.label}
			</button>
		{/each}
	</div>
{/snippet}

<div class="py-8">
	<header class="mb-6 rounded-2xl bg-brand-navy p-6 text-white shadow-lg md:p-8">
		<p class="text-sm font-medium tracking-wide text-white/70 uppercase">Suivi des retards TCL</p>
		<h1 class="mt-1 text-2xl font-bold md:text-4xl">{report.selection.label}</h1>
		<p class="mt-4 max-w-3xl leading-relaxed text-white/90">
			Cette page mesure les retards des bus et des trams lyonnais à partir des données temps réel
			que TCL publie sur data.grandlyon.com. Elle a été créée pour suivre la rue Grenette, dans le 2<sup
				>e</sup
			>
			arrondissement : réservée depuis juin 2025 aux lignes {report.grenette.join(', ')}, aux vélos
			et aux piétons, elle rouvre aux voitures le {fullDayFormat.format(reopening)}. Comparer les
			semaines avant et après cette date dira si les bus y perdent du temps.
		</p>
		<a
			href={resolve('/suivi-retard-tcl/direct')}
			class="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
			>Voir les bus et les trams sur la carte, en direct ou en rejeu →</a
		>
		<dl class="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/80">
			<div>
				<dt class="inline">Relevés depuis le</dt>
				<dd class="inline font-medium text-white">
					{firstDay ? longDayFormat.format(noonOf(firstDay)) : '—'}
				</dd>
			</div>
			<div>
				<dt class="inline">Jours complets :</dt>
				<dd class="inline font-medium text-white">{completeDays.length}</dd>
			</div>
			<div>
				<dt class="inline">Dernier calcul :</dt>
				<dd class="inline font-medium text-white">
					{formatTime(report.summaries.lastRunAt ?? report.lastComputedAt)}
				</dd>
			</div>
		</dl>
	</header>

	<div
		class="sticky top-0 z-20 -mx-2 mb-4 space-y-2 rounded-xl border border-gray-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur"
	>
		<form
			id="tcl-filters"
			method="get"
			class="flex flex-wrap items-center gap-x-4 gap-y-2"
			data-sveltekit-noscroll
			data-sveltekit-keepfocus
		>
			<TclLineSelect
				groups={report.groups}
				grenette={report.grenette}
				selected={report.selection.lines === null ? null : [...report.selection.lines]}
			/>
			{#if report.selection.lines !== null}
				<label class="flex items-center gap-2 text-sm text-gray-700">
					Sens
					<select
						name="sens"
						class="rounded-md border-gray-300 py-1 text-sm"
						value={report.selection.direction === 'outbound'
							? 'aller'
							: report.selection.direction === 'inbound'
								? 'retour'
								: ''}
						onchange={(event) => event.currentTarget.form?.requestSubmit()}
					>
						<option value="">Les deux sens</option>
						<option value="aller">{capitalize(report.directionLabels.outbound)}</option>
						<option value="retour">{capitalize(report.directionLabels.inbound)}</option>
					</select>
				</label>
			{/if}
			{#each [{ key: 'before', label: 'Référence', from: 'ref_du', to: 'ref_au', color: 'var(--chart-2)' }, { key: 'after', label: 'Comparée', from: 'cmp_du', to: 'cmp_au', color: 'var(--chart-1)' }] as const as period (period.key)}
				<fieldset class="flex items-center gap-1.5 text-sm text-gray-700">
					<legend class="sr-only">Période {period.label.toLowerCase()}</legend>
					<span class="size-2.5 rounded-[2px]" style:background={period.color}></span>
					{period.label} du
					<input
						type="date"
						name={period.from}
						value={ranges[period.key].from}
						class="rounded-md border-gray-300 py-1 text-sm"
						onchange={(event) => event.currentTarget.form?.requestSubmit()}
					/>
					au
					<input
						type="date"
						name={period.to}
						value={ranges[period.key].to}
						class="rounded-md border-gray-300 py-1 text-sm"
						onchange={(event) => event.currentTarget.form?.requestSubmit()}
					/>
				</fieldset>
			{/each}
			<noscript><button type="submit" class="text-sm underline">Afficher</button></noscript>
		</form>
		<div class="flex flex-wrap items-center gap-3">
			{@render toggle(
				Object.entries(report.windows).map(([key, label]) => ({ key, label })),
				timeWindow,
				(key) => (timeWindow = key as WindowKey),
			)}
			{@render toggle(
				[
					{ key: 'median', label: 'Retard médian' },
					{ key: 'p90', label: '1 véhicule sur 10 au-delà' },
				],
				metric,
				(key) => (metric = key as Metric),
			)}
		</div>
	</div>

	<nav aria-label="Sommaire" class="mb-10 flex flex-wrap gap-2 text-sm">
		{#each sections as section (section.id)}
			<a
				href={`#${section.id}`}
				class="rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700 hover:border-gray-400 hover:text-gray-900"
				>{section.label}</a
			>
		{/each}
	</nav>

	<TclSection id="resume" title="Résumé">
		{#snippet intro()}
			<p>
				{hasAfter
					? `Chiffres de la période comparée (${rangeLabels.after}), avec ceux de la période de référence (${rangeLabels.before}) sous chaque valeur ; plage horaire : ${windowLabel}.`
					: `Chiffres de la période de référence (${rangeLabels.before}) ; plage horaire : ${windowLabel}. La période comparée commence le ${longDayFormat.format(noonOf(ranges.after.from))}.`}
			</p>
		{/snippet}
		<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
			<TclStat
				label="Retard médian"
				value={formatMinutes(hasAfter ? delayPeriods.after.median : delayPeriods.before.median)}
				reference={hasAfter ? formatMinutes(delayPeriods.before.median) : null}
				delta={hasAfter
					? minutesDelta(delayPeriods.after.median, delayPeriods.before.median)
					: null}
				note="la moitié des véhicules font mieux"
			/>
			<TclStat
				label="1 véhicule sur 10 au-delà de"
				value={formatMinutes(hasAfter ? delayPeriods.after.p90 : delayPeriods.before.p90)}
				reference={hasAfter ? formatMinutes(delayPeriods.before.p90) : null}
				delta={hasAfter ? minutesDelta(delayPeriods.after.p90, delayPeriods.before.p90) : null}
				note="les gros retards"
			/>
			{#if showCrossings}
				{#each DIRECTIONS as direction (direction.key)}
					{@const periods = crossingPeriods[direction.key]}
					<TclStat
						label={`Rue Grenette, ${direction.label}`}
						value={formatDuration(hasAfter ? periods.after.median : periods.before.median)}
						reference={hasAfter ? formatDuration(periods.before.median) : null}
						delta={hasAfter ? secondsDelta(periods.after.median, periods.before.median) : null}
						note={`traversée médiane, ${numberFormat.format(hasAfter ? periods.after.n : periods.before.n)} mesures`}
					/>
				{/each}
			{:else}
				<TclStat
					label="Positions analysées"
					value={numberFormat.format(delayPeriods.before.n + delayPeriods.after.n)}
					note={windowLabel}
				/>
				<TclStat
					label="Jours collectés"
					value={numberFormat.format(report.days.length)}
					note={`${completeDays.length} complets`}
				/>
			{/if}
		</div>
	</TclSection>

	<TclSection id="retards" title="Retard par jour">
		{#snippet intro()}
			<p>
				Chaque point est le {metricLabel} de la journée, {windowLabel}. Les lignes témoins (autres
				lignes fortes et trams) subissent les mêmes aléas que la sélection, comme la Fête des
				Lumières, les vacances, la météo ou une grève, sans passer par la rue Grenette. Si l'écart
				entre la sélection et les témoins se creuse après le 9 décembre, la réouverture en est
				probablement la cause.
			</p>
		{/snippet}
		{#snippet explain()}
			<p>
				Le retard est celui que TCL annonce pour chaque véhicule dans son flux temps réel (champ
				<code>Delay</code> du format SIRI), c'est-à-dire son écart à l'horaire publié. Il est relevé
				toutes les 30 secondes pour chaque véhicule en circulation, soit environ 120 valeurs par véhicule
				et par heure.
			</p>
			<p>
				La médiane coupe ces valeurs en deux : la moitié des véhicules ont moins de retard, l'autre
				moitié plus. Le 90<sup>e</sup> centile montre les gros retards : 1 véhicule sur 10 fait pire.
				Les véhicules encore à leur terminus de départ ne sont pas comptés, car ils attendent souvent
				l'heure.
			</p>
			<p>
				La pointe du matin va de 7 h à 9 h, celle du soir de 16 h à 19 h. Le trait vertical marque
				le début de la période comparée.
			</p>
		{/snippet}
		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
			{#if delayDaily.length === 0}
				<p class="p-6 text-sm text-gray-500">Aucune donnée pour l'instant.</p>
			{:else}
				<TclLineChart
					data={delayDaily}
					x="date"
					series={delaySeries}
					yFormat={(value) => formatMinutes(value)}
					xFormat={formatDay}
					labelFormat={formatLongDay}
					{annotations}
					xTicks={6}
				/>
			{/if}
		</div>
	</TclSection>

	<TclSection id="heures" title="Heure par heure">
		{#snippet intro()}
			<p>
				Une valeur par jour lisse les pointes. La grille donne le {metricLabel} heure par heure, un jour
				par ligne, pour la sélection ({report.selection.label}) ; la courbe compare le profil
				horaire des deux périodes.
			</p>
		{/snippet}
		{#snippet explain()}
			<p>
				Chaque case regroupe toutes les positions relevées pendant l'heure. Une case vide correspond
				à une heure sans service ou sans relevé. Le trait horizontal sépare les jours de la période
				comparée de ceux qui la précèdent.
			</p>
			<p>
				Le profil horaire additionne tous les jours de chaque période : il montre à quelle heure les
				retards apparaissent en temps normal, et si la réouverture les déplace.
			</p>
		{/snippet}
		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
			<TclHeatmap
				rows={[...report.delays.heatmap].reverse()}
				{metric}
				bins={HEATMAP_BINS[metric]}
				neutralColor={NEUTRAL}
				dividerDay={ranges.after.from}
				formatDay={(day) => shortDayFormat.format(noonOf(day))}
				formatValue={(value) => formatMinutes(value)}
			/>
			{@render legend(
				HEATMAP_BINS[metric],
				`moins de ${HEATMAP_BINS[metric][0].min} min`,
				metric === 'median' ? 'de retard médian' : 'de retard au 90e centile',
			)}
		</div>
		<div class="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
			<h3 class="mb-2 font-semibold text-gray-900">Profil horaire des deux périodes</h3>
			{#if delayHourly.length === 0}
				<p class="p-6 text-sm text-gray-500">Aucune donnée pour l'instant.</p>
			{:else}
				<TclLineChart
					data={delayHourly}
					x="hour"
					series={beforeAfterSeries}
					yFormat={(value) => formatMinutes(value)}
					xFormat={formatHour}
					labelFormat={formatHourRange}
				/>
			{/if}
		</div>
	</TclSection>

	{#if showCrossings}
		<TclSection id="grenette" title="Traversée de la rue Grenette">
			{#snippet intro()}
				<p>
					Temps mis par les bus pour parcourir la rue Grenette entre deux lignes tracées en travers
					de la rue, l'une côté quai Saint-Antoine, l'autre côté rue de la République, à environ 250
					m l'une de l'autre. Les arrêts Terrasses Presqu'île et Cordeliers sont en dehors de ce
					tronçon : l'attente aux arrêts n'est pas comptée. {numberFormat.format(
						report.crossings.total,
					)} traversées mesurées en tout.
				</p>
			{/snippet}
			{#snippet explain()}
				<p>
					Une traversée est comptée quand un même bus franchit une ligne puis l'autre, à moins de 20
					minutes d'intervalle. L'heure de franchissement de chaque ligne est interpolée entre les
					deux positions GPS qui l'encadrent, relevées à environ 30 secondes d'écart.
				</p>
				<p>
					La médiane du jour est la traversée du milieu ; le 90<sup>e</sup> centile est celle que 1 bus
					sur 10 dépasse. Le profil horaire ne montre une heure que si elle compte au moins 3 traversées.
				</p>
			{/snippet}
			<div class="grid gap-6 md:grid-cols-2">
				{#each DIRECTIONS as direction (direction.key)}
					{@const periods = crossingPeriods[direction.key]}
					<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
						<h3 class="font-semibold text-gray-900">{direction.label}</h3>
						<p class="mb-3 text-xs text-gray-500">
							{direction.detail}. Médiane de référence : {formatDuration(
								periods.before.median,
							)}{hasAfter ? `, comparée : ${formatDuration(periods.after.median)}` : ''}.
						</p>
						<TclLineChart
							data={crossingDaily[direction.key]}
							x="date"
							series={[
								{ key: 'median', label: 'Médiane', color: 'var(--chart-1)' },
								{ key: 'p90', label: '1 bus sur 10 au-delà', color: 'var(--chart-6)' },
							]}
							yFormat={formatClock}
							xFormat={formatDay}
							labelFormat={formatLongDay}
							{annotations}
							xTicks={6}
						/>
						<h4 class="mt-4 mb-1 text-sm font-medium text-gray-700">
							Selon l'heure d'entrée dans la rue
						</h4>
						{#if report.crossings.hourly[direction.key].length === 0}
							<p class="p-4 text-sm text-gray-500">Pas encore assez de traversées.</p>
						{:else}
							<TclLineChart
								data={fillHours(report.crossings.hourly[direction.key], {
									before: null,
									after: null,
								})}
								x="hour"
								series={beforeAfterSeries}
								yFormat={formatClock}
								xFormat={formatHour}
								labelFormat={formatHourRange}
							/>
						{/if}
					</div>
				{/each}
			</div>
		</TclSection>
	{/if}

	<TclSection id="carte" title="Où les véhicules perdent du temps">
		{#snippet intro()}
			<p>
				{mapMetric === 'spent'
					? 'Chaque carré d’environ 100 m montre le temps moyen qu’un véhicule y passe. Cette mesure ne dépend que des positions GPS : elle reste comparable si SYTRAL modifie ses horaires après la réouverture.'
					: 'Chaque carré d’environ 100 m montre de combien le retard d’un véhicule augmente, en moyenne, quand il le traverse. Gris : il n’en prend pas, ou en regagne. Cette mesure dépend de l’horaire publié : si SYTRAL ajoute du temps prévu sur un tronçon, le retard pris y baisse même si les bus roulent aussi lentement.'}
				{report.showRoutes
					? ' Le trait noir est le tracé officiel de chaque ligne, les points blancs ses arrêts.'
					: ' Choisissez une ou plusieurs lignes pour voir leur tracé et leurs arrêts.'}
			</p>
		{/snippet}
		{#snippet explain()}
			<p>
				Les positions d'un véhicule sont relevées toutes les 30 secondes environ. Chaque intervalle
				entre deux positions est attribué au carré situé à mi-chemin, avec sa durée et la variation
				du retard annoncé. Le temps passé d'un carré est la somme de ces durées divisée par le
				nombre de passages ; le retard pris, la somme des variations de retard divisée par le même
				nombre. Toutes les heures de la période choisie sont additionnées.
			</p>
			<p>
				Le temps passé dépend aussi de la longueur du trajet dans le carré : un bus qui en coupe un
				coin y reste moins longtemps. Il se compare donc d'une période à l'autre pour un même carré,
				pas d'un carré à l'autre.
			</p>
			<p>
				Avec un sens choisi en haut de page, seuls les passages des véhicules qui roulent dans ce
				sens sont comptés, et seuls le tracé et les arrêts de ce sens sont affichés.
			</p>
			<p>
				Un carré n'apparaît que s'il a été traversé au moins {report.minJourneys} fois, pour écarter
				les cas isolés. Survolez un carré pour voir ses deux valeurs et le nombre de passages. Cliquez
				sur deux arrêts pour mesurer le temps de parcours entre eux, dans la section suivante.
			</p>
		{/snippet}
		<div class="mb-3 flex flex-wrap items-center gap-3">
			{@render toggle(
				[
					{ key: 'spent', label: 'Temps passé' },
					{ key: 'lost', label: 'Retard pris' },
				],
				mapMetric,
				(key) => (mapMetric = key as 'spent' | 'lost'),
			)}
			{@render toggle(
				[
					{ key: 'before', label: `Référence (${rangeLabels.before})` },
					{ key: 'after', label: `Comparée (${rangeLabels.after})` },
				],
				mapPeriod,
				(key) => (mapPeriod = key as 'before' | 'after'),
			)}
		</div>
		<div class="overflow-hidden rounded-xl border border-gray-200 shadow-xs">
			<TclDelayMap
				cells={mapCells}
				cellSize={report.cell}
				bins={mapMetric === 'spent' ? SPENT_BINS : MAP_BINS}
				neutralColor={NEUTRAL}
				metric={mapMetric}
				routes={report.routes}
				fitKey={report.selection.key}
				stops={report.stops}
				{fromStop}
				{toStop}
				onStopClick={chooseStop}
			/>
		</div>
		{#if mapMetric === 'spent'}
			{@render legend(SPENT_BINS, 'moins de 15 s', 'passées par passage')}
		{:else}
			{@render legend(MAP_BINS, 'aucun retard pris', 'de retard pris par passage')}
		{/if}
		{#if mapCells.length === 0}
			<p class="mt-2 text-sm text-gray-500">Pas encore de données pour cette période.</p>
		{/if}
	</TclSection>

	{#if report.selection.lines !== null}
		<TclSection id="arrets" title="Temps de parcours entre deux arrêts">
			{#snippet intro()}
				<p>
					Choisissez un arrêt de départ puis un arrêt d'arrivée, dans les menus ou en cliquant sur
					la carte. La page compare le temps prévu par les horaires théoriques au temps réellement
					mis par les véhicules, course par course.
				</p>
			{/snippet}
			{#snippet explain()}
				<p>
					Le temps prévu vient des horaires théoriques que SYTRAL Mobilités publie au format GTFS
					sur data.gouv.fr, rechargés chaque jour. Le temps réel vient des positions GPS : un
					véhicule passe à un arrêt au moment où sa trajectoire en est la plus proche, à moins de 40
					m, par interpolation entre deux positions.
				</p>
				<p>
					Chaque course du flux temps réel est rattachée à la course correspondante des horaires
					théoriques, par son identifiant quand l'heure prévue annoncée concorde, sinon par l'arrêt
					et l'heure prévue qu'elle annonce. Le retard pris entre les deux arrêts est le temps réel
					moins le temps prévu, calculé pour chaque course.
				</p>
				<p>
					La liste des arrivées ne propose que les arrêts situés après le départ sur la même ligne
					et dans le même sens.
				</p>
			{/snippet}
			{#if report.stopOptions.length === 0}
				<p class="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
					{report.gtfs.trips === 0
						? 'Les horaires théoriques (GTFS) ne sont pas encore chargés.'
						: 'Pas encore de passages mesurés pour cette sélection.'}
				</p>
			{:else}
				<div class="mb-4 flex flex-wrap items-center gap-3 text-sm text-gray-700">
					<TclStopSelect
						name="de"
						form="tcl-filters"
						label="Départ"
						color="#1e3a8a"
						groups={report.stopOptions}
						value={fromStop}
						onChange={chooseFrom}
					/>
					<TclStopSelect
						name="a"
						form="tcl-filters"
						label="Arrivée"
						color="#f54900"
						groups={arrivalOptions}
						value={toStop}
						placeholder={fromStop === null ? 'Choisir d’abord le départ' : 'Choisir un arrêt'}
						onChange={chooseTo}
					/>
				</div>
				{#if segment}
					{@const periods = segment.periods[timeWindow]}
					{@const current = hasAfter && periods.after.n > 0 ? periods.after : periods.before}
					{@const compared = hasAfter && periods.after.n > 0}
					<h3 class="mb-3 text-lg font-semibold text-gray-900">
						{segment.from.name} → {segment.to.name}
						<span class="text-sm font-normal text-gray-500">
							{segment.lines.length > 0 ? `(${segment.lines.join(', ')})` : ''}
						</span>
					</h3>
					{#if periods.before.n + periods.after.n === 0}
						<p class="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
							Aucune course mesurée entre ces deux arrêts sur la plage choisie.
						</p>
					{:else}
						<div class="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
							<TclStat
								label="Temps prévu"
								value={formatDuration(current.planned)}
								reference={compared ? formatDuration(periods.before.planned) : null}
								note={`${numberFormat.format(current.n)} trajets mesurés`}
							/>
							<TclStat
								label="Temps réel médian"
								value={formatDuration(current.actual)}
								reference={compared ? formatDuration(periods.before.actual) : null}
								delta={compared ? secondsDelta(periods.after.actual, periods.before.actual) : null}
							/>
							<TclStat
								label="1 trajet sur 10 au-delà de"
								value={formatDuration(current.actualP90)}
								reference={compared ? formatDuration(periods.before.actualP90) : null}
								delta={compared
									? secondsDelta(periods.after.actualP90, periods.before.actualP90)
									: null}
							/>
							<TclStat
								label="Retard pris entre les deux"
								value={formatDuration(current.lost)}
								reference={compared ? formatDuration(periods.before.lost) : null}
								note={`retard médian au départ ${formatDuration(current.delayFrom)}, à l'arrivée ${formatDuration(current.delayTo)}`}
							/>
						</div>
						<div class="grid gap-6 md:grid-cols-2">
							<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
								<h4 class="mb-2 text-sm font-medium text-gray-700">Par jour</h4>
								<TclLineChart
									data={segmentDaily}
									x="date"
									series={[
										{ key: 'planned', label: 'Prévu', color: 'var(--chart-2)' },
										{ key: 'actual', label: 'Réel médian', color: 'var(--chart-1)' },
										{ key: 'actualP90', label: '1 sur 10 au-delà', color: 'var(--chart-6)' },
									]}
									yFormat={formatClock}
									xFormat={formatDay}
									labelFormat={formatLongDay}
									{annotations}
									xTicks={6}
								/>
							</div>
							<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
								<h4 class="mb-2 text-sm font-medium text-gray-700">Selon l'heure de départ</h4>
								{#if segment.hourly.length === 0}
									<p class="p-4 text-sm text-gray-500">Pas encore assez de trajets.</p>
								{:else}
									<TclLineChart
										data={fillHours(segment.hourly, { planned: null, before: null, after: null })}
										x="hour"
										series={[
											{ key: 'planned', label: 'Prévu', color: 'var(--chart-6)' },
											...beforeAfterSeries,
										]}
										yFormat={formatClock}
										xFormat={formatHour}
										labelFormat={formatHourRange}
									/>
								{/if}
							</div>
						</div>
					{/if}
				{:else if fromStop !== null}
					<p class="text-sm text-gray-600">Choisissez maintenant l'arrêt d'arrivée.</p>
				{/if}
			{/if}
		</TclSection>
	{/if}

	<TclSection id="collecte" title="État de la collecte">
		{#snippet intro()}
			<p>
				{#if report.collector.enabled}
					La collecte tourne depuis le {formatTime(report.collector.startedAt)}.
				{:else}
					La collecte est arrêtée sur ce serveur : les identifiants Grand Lyon ne sont pas
					renseignés.
				{/if}
				Les chiffres de la page sont recalculés toutes les 15 minutes ; dernier calcul le {formatTime(
					report.summaries.lastRunAt,
				)}{report.summaries.running ? ', en cours' : ''}.
				{#if report.summaries.lastError}
					<span class="text-red-700">Dernière erreur : {report.summaries.lastError}</span>
				{/if}
			</p>
		{/snippet}
		<div class="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-xs">
			<table class="min-w-full text-sm">
				<thead class="bg-gray-50 text-left text-gray-600">
					<tr>
						<th class="px-3 py-2 font-medium">Flux</th>
						<th class="px-3 py-2 font-medium">Fréquence</th>
						<th class="px-3 py-2 font-medium">Dernier relevé réussi</th>
						<th class="px-3 py-2 text-right font-medium">Relevés</th>
						<th class="px-3 py-2 text-right font-medium">Éléments gardés aujourd'hui</th>
						<th class="px-3 py-2 font-medium">Dernière erreur</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each FEEDS as feed (feed.key)}
						{@const state = feeds[feed.key]}
						<tr>
							<td class="px-3 py-2 font-medium text-gray-900">{feed.label}</td>
							<td class="px-3 py-2 text-gray-700">
								{state ? formatDuration(state.intervalMs / 1000) : '—'}
							</td>
							<td class="px-3 py-2 text-gray-700">{formatTime(state?.lastSuccessAt)}</td>
							<td class="px-3 py-2 text-right text-gray-700 tabular-nums">
								{state ? numberFormat.format(state.polls) : '—'}
							</td>
							<td class="px-3 py-2 text-right text-gray-700 tabular-nums">
								{state ? numberFormat.format(state.storedToday) : '—'}
							</td>
							<td class="px-3 py-2 text-gray-700">
								{#if state?.lastError}
									<span class={state.consecutiveFailures > 0 ? 'text-red-700' : 'text-gray-500'}>
										{formatTime(state.lastErrorAt)} : {state.lastError}
									</span>
								{:else}
									—
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<div class="mt-3 grid gap-1 text-sm text-gray-600">
			<p>
				Horaires théoriques :
				{#if report.gtfs.trips > 0}
					{numberFormat.format(report.gtfs.trips)} courses, valables du {compactDay(
						report.gtfs.validFrom,
					)} au {compactDay(report.gtfs.validTo)}, chargées le {formatTime(report.gtfs.importedAt)}.
				{:else}
					pas encore chargés.
				{/if}
				{#if report.gtfs.lastError}
					<span class="text-red-700">Erreur : {report.gtfs.lastError}</span>
				{/if}
			</p>
			<p>
				Les versions du GTFS sont détectées sur le contenu des horaires, pas sur la date d'export :
				une nouvelle ligne apparaît ci-dessous seulement quand des courses, des arrêts ou des
				calendriers changent. Chaque version est archivée, et les 14 derniers jours qu'elle couvre
				sont recalculés.
			</p>
			<p>
				Relevés bruts stockés : {formatBytes(totalBytes)}{averageDayBytes !== null
					? `, soit ${formatBytes(averageDayBytes)} par jour complet en moyenne`
					: ''}.
			</p>
		</div>

		{#if report.gtfs.versions.length > 0}
			<h3 class="mt-8 mb-3 text-lg font-semibold text-gray-900">
				Versions des horaires théoriques
			</h3>
			<div class="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-xs">
				<table class="min-w-full text-sm">
					<thead class="bg-gray-50 text-left text-gray-600">
						<tr>
							<th class="px-3 py-2 font-medium">Chargée le</th>
							<th class="px-3 py-2 font-medium">Valable</th>
							<th class="px-3 py-2 text-right font-medium">Courses</th>
							<th class="px-3 py-2 font-medium">Changements</th>
							<th class="px-3 py-2 font-medium">Jours recalculés</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{#each report.gtfs.versions as version (version.importedAt)}
							<tr>
								<td class="px-3 py-2 whitespace-nowrap text-gray-900">
									{formatTime(version.importedAt)}
								</td>
								<td class="px-3 py-2 whitespace-nowrap text-gray-700">
									{version.validFrom && version.validTo
										? `du ${yearDayFormat.format(noonOf(version.validFrom))} au ${yearDayFormat.format(noonOf(version.validTo))}`
										: '—'}
								</td>
								<td class="px-3 py-2 text-right text-gray-700 tabular-nums">
									{numberFormat.format(version.trips)}
								</td>
								<td class="px-3 py-2 text-gray-700">
									{#if version.changes === null}
										première version chargée
									{:else if version.changes.length === 0}
										même nombre de courses par ligne
									{:else}
										{version.changes.length} ligne{version.changes.length > 1 ? 's' : ''} :
										{version.changes
											.slice(0, 8)
											.map(
												(change) =>
													`${change.line} ${change.after - change.before > 0 ? '+' : '−'}${numberFormat.format(Math.abs(change.after - change.before))}`,
											)
											.join(', ')}{version.changes.length > 8 ? '…' : ''}
									{/if}
								</td>
								<td class="px-3 py-2 whitespace-nowrap text-gray-700">
									{version.recomputedFrom && version.recomputedTo
										? `du ${dayFormat.format(noonOf(version.recomputedFrom))} au ${dayFormat.format(noonOf(version.recomputedTo))}`
										: '—'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="mt-2 text-xs text-gray-500">
				Changements : écart du nombre de courses par ligne avec la version précédente.
			</p>
		{/if}

		<h3 class="mt-8 mb-3 text-lg font-semibold text-gray-900">Détail par jour</h3>
		<div class="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-xs">
			<table class="min-w-full text-sm">
				<thead class="bg-gray-50 text-left text-gray-600">
					<tr>
						<th class="px-3 py-2 font-medium">Jour</th>
						<th class="px-3 py-2 text-right font-medium">Couverture</th>
						<th class="px-3 py-2 text-right font-medium">Plus long trou</th>
						<th class="px-3 py-2 text-right font-medium">Stockage</th>
						{#each report.delays.series as item (item.key)}
							<th class="px-3 py-2 text-right font-medium">
								{metric === 'median' ? 'Médiane' : '90e centile'}
								{COLUMN_LABELS[item.key] ?? item.label}
							</th>
						{/each}
						{#if showCrossings}
							{#each DIRECTIONS as direction (direction.key)}
								<th class="px-3 py-2 text-right font-medium">Traversée {direction.label}</th>
							{/each}
						{/if}
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each [...report.days].reverse() as row, index (row.day)}
						{@const delayRow = report.delays.daily[timeWindow][report.days.length - 1 - index]}
						<tr
							class={[
								row.day >= ranges.after.from && row.day <= ranges.after.to && 'bg-orange-50/40',
								(row.day < ranges.before.from || row.day > ranges.before.to) &&
									(row.day < ranges.after.from || row.day > ranges.after.to) &&
									'text-gray-400',
							]}
						>
							<td class="px-3 py-2 whitespace-nowrap">
								{formatLongDay(noonOf(row.day))}
								{#if !row.complete}<span class="text-xs text-gray-500">(en cours)</span>{/if}
							</td>
							<td class="px-3 py-2 text-right tabular-nums"
								>{Math.round(row.coverage * 100)}&nbsp;%</td
							>
							<td class="px-3 py-2 text-right tabular-nums">{formatDuration(row.vmMaxGapS)}</td>
							<td class="px-3 py-2 text-right tabular-nums">{formatBytes(row.bytes)}</td>
							{#each report.delays.series as item (item.key)}
								<td class="px-3 py-2 text-right tabular-nums">
									{formatMinutes(delayRow?.[item.key]?.[metric])}
								</td>
							{/each}
							{#if showCrossings}
								{#each DIRECTIONS as direction (direction.key)}
									{@const crossing =
										report.crossings.daily[timeWindow][direction.key][
											report.days.length - 1 - index
										]}
									<td class="px-3 py-2 text-right whitespace-nowrap tabular-nums">
										{formatDuration(crossing?.[metric])}
										<span class="text-xs text-gray-500">({crossing?.n ?? 0})</span>
									</td>
								{/each}
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="mt-2 text-xs text-gray-500">
			La couverture compare le nombre de relevés de positions aux 2&nbsp;880 attendus sur une
			journée (un toutes les 30 secondes). Les jours de la période comparée sont surlignés ; les
			jours hors des deux périodes sont grisés.
		</p>
	</TclSection>

	<TclSection id="methode" title="Méthode et limites">
		<div class="max-w-3xl space-y-6 text-[15px] leading-relaxed text-gray-700">
			<div>
				<h3 class="mb-2 font-semibold text-gray-900">Les données</h3>
				<ul class="list-disc space-y-1.5 pl-5">
					<li>
						Positions des véhicules (flux SIRI Lite <code>vehicle-monitoring</code> de data.grandlyon.com),
						relevées toutes les 30 secondes pour tout le réseau. Pour chaque bus ou tram en circulation,
						elles donnent sa position, sa ligne, son sens, sa course et le retard annoncé par TCL.
					</li>
					<li>
						Horaires aux arrêts (<code>estimated-timetables</code>), relevés toutes les minutes pour
						les lignes {report.grenette.join(', ')} et archivés pour des vérifications ultérieures.
					</li>
					<li>
						Perturbations (<code>situation-exchange</code>), relevées toutes les 10 minutes et
						gardées quand elles changent.
					</li>
					<li>
						Liste des arrêts (<code>tcl_sytral.tclarret</code>), relue toutes les 6 heures, et
						tracés des lignes (service WFS du Grand Lyon), relus une fois par jour.
					</li>
					<li>
						Horaires théoriques au format GTFS, publiés par SYTRAL Mobilités sur data.gouv.fr et
						vérifiés chaque jour. Quand leur contenu change, la nouvelle version est archivée, notée
						dans le tableau des versions, et les 14 derniers jours qu'elle couvre sont recalculés :
						un horaire publié en retard complète ainsi les jours déjà passés.
					</li>
				</ul>
			</div>
			<div>
				<h3 class="mb-2 font-semibold text-gray-900">Les calculs</h3>
				<p>
					Les relevés bruts sont gardés tels quels, compressés, dans un fichier par jour et par
					flux. Toutes les 15 minutes, le serveur relit ceux du jour et met à jour une base de
					données : les retards par ligne et par heure, les traversées de la rue Grenette, les
					carrés de la carte et les passages aux arrêts. Une journée terminée n'est plus recalculée.
					Les relevés bruts permettent de refaire tous ces calculs plus tard si la méthode change.
				</p>
				<p class="mt-2">
					Pour les retards, chaque position compte une fois : une même position relevée deux fois
					(le serveur de TCL renvoie parfois une copie déjà vue) est écartée. Les médianes et les 90<sup
						>es</sup
					> centiles viennent de la répartition des retards de chaque heure, comptée par tranches d'une
					minute.
				</p>
			</div>
			<div>
				<h3 class="mb-2 font-semibold text-gray-900">Le contrôle</h3>
				<p>
					Le retard mesuré par GPS aux arrêts et le retard annoncé par TCL viennent de deux calculs
					indépendants. Sur les relevés des 27 et 28 novembre 2026, ils diffèrent de 31 secondes en
					médiane pour une même course, et 93&nbsp;% des 1&nbsp;308 courses comparées sont à moins
					de 3 minutes près.
				</p>
			</div>
			<div>
				<h3 class="mb-2 font-semibold text-gray-900">Les limites</h3>
				<ul class="list-disc space-y-1.5 pl-5">
					<li>
						Une position toutes les 30 secondes environ : un passage interpolé peut être décalé de
						quelques secondes, et un arrêt à plus de 40 m de la trajectoire n'est pas détecté.
					</li>
					<li>
						Une course qui ne se retrouve pas dans les horaires théoriques n'a pas de temps prévu.
						Elle compte quand même dans les retards et sur la carte.
					</li>
					<li>
						Le retard annoncé est celui que calcule TCL ; la page le reprend tel quel. Lui et le
						retard pris sur la carte dépendent de l'horaire publié : si SYTRAL rallonge les temps
						prévus après la réouverture, ils baissent même si les bus roulent aussi lentement. La
						traversée de la rue Grenette, le temps passé sur la carte et le temps réel entre deux
						arrêts ne dépendent que des positions GPS.
					</li>
					<li>
						Une coupure du serveur ou de l'API laisse un trou dans les données, visible dans la
						colonne « Plus long trou » du détail par jour.
					</li>
					<li>
						Les périodes comparées doivent éviter les semaines exceptionnelles, comme la Fête des
						Lumières début décembre ou les vacances de Noël. Les dates se règlent en haut de la
						page.
					</li>
				</ul>
			</div>
		</div>
	</TclSection>
</div>
