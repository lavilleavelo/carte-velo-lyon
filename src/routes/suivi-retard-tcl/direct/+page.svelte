<script lang="ts">
	import TclLiveMap, { type MapVehicle } from '$lib/components/tcl/TclLiveMap.svelte';
	import TclLineSelect from '$lib/components/tcl/TclLineSelect.svelte';
	import TclSection from '$lib/components/tcl/TclSection.svelte';
	import { resolve } from '$app/paths';
	import { SvelteMap } from 'svelte/reactivity';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type FrameVehicle = [string, string, 0 | 1, number, number, number | null, number | null];
	type Frame = { t: number; v: FrameVehicle[] };
	type Shown = {
		id: string;
		line: string;
		direction: string;
		lat: number;
		lon: number;
		delay: number | null;
		destinationName: string | null;
		stopName: string | null;
		recordedAt: string | null;
	};

	const DELAY_BINS = [
		{ max: -60, color: '#2563eb', label: 'en avance' },
		{ max: 60, color: '#9ca3af', label: 'à l’heure (moins d’1 min)' },
		{ max: 180, color: '#fdba74', label: '1 à 3 min' },
		{ max: 300, color: '#fb923c', label: '3 à 5 min' },
		{ max: 600, color: '#ea580c', label: '5 à 10 min' },
		{ max: Infinity, color: '#9a3412', label: '10 min et plus' },
	];
	const UNKNOWN = '#d1d5db';

	const parisClock = new Intl.DateTimeFormat('fr-FR', {
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
		timeZone: 'Europe/Paris',
	});
	const parisSeconds = new Intl.DateTimeFormat('fr-FR', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
		timeZone: 'Europe/Paris',
	});
	const longDayFormat = new Intl.DateTimeFormat('fr-FR', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		timeZone: 'Europe/Paris',
	});
	const isoDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' });

	function parisMinute(epochMs: number): number {
		const [hours, minutes] = parisClock.format(epochMs).split(':').map(Number);
		return hours * 60 + minutes;
	}

	function minuteLabel(minute: number): string {
		return `${Math.floor(minute / 60)} h ${String(minute % 60).padStart(2, '0')}`;
	}

	function delayLabel(delay: number | null): string {
		if (delay === null) {
			return 'retard inconnu';
		}
		const minutes = Math.round(Math.abs(delay) / 60);
		if (Math.abs(delay) < 60) {
			return 'à l’heure';
		}
		return delay > 0 ? `${minutes} min de retard` : `${minutes} min d’avance`;
	}

	function delayColor(delay: number | null): string {
		if (delay === null) {
			return UNKNOWN;
		}
		return DELAY_BINS.find((bin) => delay < bin.max)?.color ?? UNKNOWN;
	}

	function firstMinute(day: string | null): number {
		const entry = data.replay.find((item) => item.day === day);
		if (!entry) {
			return 17 * 60;
		}
		const last = (entry.hours.at(-1) ?? 23) * 60 + 59;
		if (day === isoDay.format(new Date())) {
			return Math.min(Math.max(entry.hours[0] * 60, parisMinute(Date.now()) - 2), last);
		}
		return entry.hours.includes(17) ? 17 * 60 : entry.hours[0] * 60;
	}

	let mode = $state<'live' | 'replay'>('live');
	let colorMode = $state<'line' | 'delay'>('line');
	let live = $derived(data.live);
	let selectedId = $state<string | null>(null);
	let day = $derived<string | null>(data.replay.at(-1)?.day ?? null);
	let minute = $derived(firstMinute(data.replay.at(-1)?.day ?? null));
	let playing = $state(false);
	const frames = new SvelteMap<string, Map<number, Frame> | 'loading' | 'missing'>();

	const dayHours = $derived(data.replay.find((item) => item.day === day)?.hours ?? []);
	const minMinute = $derived(dayHours.length > 0 ? dayHours[0] * 60 : 0);
	const maxMinute = $derived(dayHours.length > 0 ? (dayHours.at(-1) ?? 23) * 60 + 59 : 1439);
	const hour = $derived(Math.floor(minute / 60));
	const hourKey = $derived(day ? `${day}|${hour}` : null);
	const hourEntry = $derived(hourKey ? frames.get(hourKey) : undefined);
	const lineFilter = $derived(data.lines ? new Set(data.lines) : null);

	$effect(() => {
		if (mode !== 'live') {
			return;
		}
		let timer: ReturnType<typeof setTimeout>;
		const refresh = async () => {
			const response = await fetch('/api/tcl/vehicules').catch(() => null);
			if (response?.ok) {
				live = await response.json();
			}
			timer = setTimeout(refresh, 30_000);
		};
		timer = setTimeout(refresh, 30_000);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		if (mode !== 'replay' || !day || hourKey === null || frames.has(hourKey)) {
			return;
		}
		const key = hourKey;
		frames.set(key, 'loading');
		fetch(`/api/tcl/rejeu/${day}/${hour}`)
			.then(async (response) => {
				if (!response.ok) {
					frames.set(key, 'missing');
					return;
				}
				const body = (await response.json()) as { frames: Frame[] };
				const byMinute = new Map<number, Frame>();
				for (const frame of body.frames) {
					byMinute.set(parisMinute(frame.t * 1000), frame);
				}
				frames.set(key, byMinute);
			})
			.catch(() => frames.set(key, 'missing'));
	});

	$effect(() => {
		if (!playing) {
			return;
		}
		const timer = setInterval(() => {
			if (minute >= maxMinute) {
				playing = false;
				return;
			}
			minute += 1;
		}, 400);
		return () => clearInterval(timer);
	});

	const shown = $derived.by((): Shown[] => {
		if (mode === 'live') {
			return live.vehicles
				.filter((vehicle) => !lineFilter || lineFilter.has(vehicle.line))
				.map((vehicle) => ({
					id: vehicle.id,
					line: vehicle.line,
					direction: vehicle.direction,
					lat: vehicle.lat,
					lon: vehicle.lon,
					delay: vehicle.delay,
					destinationName: vehicle.destinationName,
					stopName: vehicle.stopName,
					recordedAt: vehicle.recordedAt,
				}));
		}
		if (!(hourEntry instanceof Map)) {
			return [];
		}
		const frame = hourEntry.get(minute);
		if (!frame) {
			return [];
		}
		return frame.v
			.filter(([, line]) => !lineFilter || lineFilter.has(line))
			.map(([id, line, direction, lat, lon, , delay]) => ({
				id,
				line,
				direction: direction === 1 ? 'inbound' : 'outbound',
				lat,
				lon,
				delay,
				destinationName: null,
				stopName: null,
				recordedAt: null,
			}));
	});

	const mapVehicles = $derived(
		shown.map(
			(vehicle): MapVehicle => ({
				id: vehicle.id,
				line: vehicle.line,
				lat: vehicle.lat,
				lon: vehicle.lon,
				color:
					colorMode === 'delay'
						? delayColor(vehicle.delay)
						: (data.colors[vehicle.line]?.color ?? '#6b7280'),
				textColor:
					colorMode === 'delay' ? '#111827' : (data.colors[vehicle.line]?.text ?? '#ffffff'),
			}),
		),
	);

	const selected = $derived(shown.find((vehicle) => vehicle.id === selectedId) ?? null);

	const status = $derived.by(() => {
		if (mode === 'live') {
			return live.receivedAt
				? `${shown.length} véhicules, positions relevées à ${parisSeconds.format(new Date(live.receivedAt))}.`
				: 'Aucune position reçue depuis le démarrage du serveur.';
		}
		if (!day) {
			return 'Aucune journée enregistrée pour l’instant.';
		}
		if (hourEntry === 'loading' || hourEntry === undefined) {
			return 'Chargement de l’heure…';
		}
		if (hourEntry === 'missing') {
			return 'Pas de relevé pour cette heure.';
		}
		if ((hourEntry.get(minute)?.v.length ?? 0) === 0) {
			return `Pas de relevé à ${minuteLabel(minute)} ce jour-là : la collecte était interrompue.`;
		}
		return `${shown.length} véhicules le ${longDayFormat.format(new Date(`${day}T12:00:00`))} à ${minuteLabel(minute)}.`;
	});

	function chooseDay(value: string) {
		day = value;
		playing = false;
		minute = Math.min(Math.max(firstMinute(value), minMinute), maxMinute);
	}
</script>

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
		<a
			href={resolve('/suivi-retard-tcl')}
			class="text-sm font-medium tracking-wide text-white/70 uppercase hover:text-white"
			>Suivi des retards TCL</a
		>
		<h1 class="mt-1 text-2xl font-bold md:text-4xl">Les bus et les trams sur la carte</h1>
		<p class="mt-4 max-w-3xl leading-relaxed text-white/90">
			Position de chaque bus, trolleybus et tram TCL, mise à jour toutes les 30 secondes, et rejeu
			des journées passées minute par minute. Les métros et le funiculaire roulent sous terre et ne
			transmettent pas de position : ils n'apparaissent pas.
		</p>
	</header>

	<div
		class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-sm"
	>
		<form method="get" data-sveltekit-noscroll data-sveltekit-keepfocus>
			<TclLineSelect
				groups={data.groups}
				grenette={data.grenette}
				selected={data.lines === null ? null : [...data.lines]}
			/>
		</form>
		{@render toggle(
			[
				{ key: 'live', label: 'En direct' },
				{ key: 'replay', label: 'Journée passée' },
			],
			mode,
			(key) => {
				mode = key as 'live' | 'replay';
				playing = false;
				selectedId = null;
			},
		)}
		{@render toggle(
			[
				{ key: 'line', label: 'Couleur de la ligne' },
				{ key: 'delay', label: 'Retard' },
			],
			colorMode,
			(key) => (colorMode = key as 'line' | 'delay'),
		)}
	</div>

	{#if mode === 'replay'}
		<div
			class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-sm"
		>
			{#if data.replay.length === 0}
				<p class="text-sm text-gray-600">
					Aucune journée enregistrée pour l'instant : le rejeu se remplit au fil des relevés.
				</p>
			{:else}
				<label class="flex items-center gap-2 text-sm text-gray-700">
					Jour
					<select
						class="rounded-md border-gray-300 py-1.5 text-sm"
						value={day}
						onchange={(event) => chooseDay(event.currentTarget.value)}
					>
						{#each [...data.replay].reverse() as item (item.day)}
							<option value={item.day}
								>{longDayFormat.format(new Date(`${item.day}T12:00:00`))}</option
							>
						{/each}
					</select>
				</label>
				<button
					type="button"
					class="rounded-md bg-brand-navy px-3 py-1.5 text-sm text-white"
					onclick={() => {
						if (minute >= maxMinute) {
							minute = minMinute;
						}
						playing = !playing;
					}}
				>
					{playing ? 'Pause' : 'Lecture'}
				</button>
				<input
					type="range"
					class="min-w-48 flex-1 accent-brand-navy"
					min={minMinute}
					max={maxMinute}
					step="1"
					bind:value={minute}
					aria-label="Heure"
				/>
				<span class="w-16 text-right font-mono text-sm text-gray-900 tabular-nums"
					>{minuteLabel(minute)}</span
				>
			{/if}
		</div>
	{/if}

	<div class="relative overflow-hidden rounded-xl border border-gray-200 shadow-xs">
		<TclLiveMap vehicles={mapVehicles} {selectedId} onSelect={(id) => (selectedId = id)} />
		{#if selected}
			<div
				class="absolute top-3 right-3 z-10 w-72 rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-lg"
			>
				<div class="flex items-start justify-between gap-2">
					<div class="flex items-center gap-2">
						<span
							class="rounded px-2 py-0.5 text-sm font-bold"
							style:background={data.colors[selected.line]?.color ?? '#6b7280'}
							style:color={data.colors[selected.line]?.text ?? '#ffffff'}>{selected.line}</span
						>
						<span class="text-gray-900">
							{selected.destinationName
								? `vers ${selected.destinationName}`
								: selected.direction === 'inbound'
									? 'sens retour'
									: 'sens aller'}
						</span>
					</div>
					<button
						type="button"
						class="text-gray-500 hover:text-gray-900"
						aria-label="Fermer"
						onclick={() => (selectedId = null)}>×</button
					>
				</div>
				<dl class="mt-3 space-y-1 text-gray-700">
					<div class="flex justify-between gap-3">
						<dt>Retard annoncé</dt>
						<dd class="font-medium text-gray-900">{delayLabel(selected.delay)}</dd>
					</div>
					{#if selected.stopName}
						<div class="flex justify-between gap-3">
							<dt>Arrêt courant</dt>
							<dd class="text-right text-gray-900">{selected.stopName}</dd>
						</div>
					{/if}
					{#if selected.recordedAt}
						<div class="flex justify-between gap-3">
							<dt>Position relevée à</dt>
							<dd class="text-gray-900 tabular-nums">
								{parisSeconds.format(new Date(selected.recordedAt))}
							</dd>
						</div>
					{/if}
					<div class="flex justify-between gap-3">
						<dt>Véhicule</dt>
						<dd class="text-gray-900">{selected.id}</dd>
					</div>
				</dl>
			</div>
		{/if}
	</div>
	<p class="mt-2 text-sm text-gray-600">{status}</p>
	{#if colorMode === 'delay'}
		<div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-700">
			{#each DELAY_BINS as bin (bin.label)}
				<span class="flex items-center gap-1.5">
					<span class="size-3 rounded-full" style:background={bin.color}></span>
					{bin.label}
				</span>
			{/each}
			<span class="flex items-center gap-1.5">
				<span class="size-3 rounded-full" style:background={UNKNOWN}></span>
				retard inconnu
			</span>
		</div>
	{/if}

	<div class="mt-10">
		<TclSection id="explications" title="D'où viennent ces positions">
			{#snippet intro()}
				<p>
					Le serveur relève toutes les 30 secondes le flux des positions TCL (SIRI Lite,
					data.grandlyon.com). La carte en direct reprend le dernier relevé sans interroger TCL à
					nouveau : le nombre de visiteurs ne change rien à la charge de l'API.
				</p>
			{/snippet}
			{#snippet explain()}
				<p>
					Pour le rejeu, le serveur prépare une image par minute : chaque véhicule y est placé à sa
					dernière position connue, si elle date de moins de 2 minutes 30. Ces images sont rangées
					par heure, et le curseur ne charge que l'heure affichée.
				</p>
				<p>
					Le retard est celui que TCL annonce pour chaque véhicule. La couleur de ligne est la
					couleur officielle publiée dans les horaires théoriques de SYTRAL Mobilités. Au rejeu, la
					destination et l'arrêt courant ne sont pas gardés : seuls la ligne, le sens, la position
					et le retard le sont.
				</p>
			{/snippet}
			<p class="text-sm text-gray-600">
				<a class="underline hover:text-gray-900" href={resolve('/suivi-retard-tcl')}
					>Retour au suivi des retards</a
				>
			</p>
		</TclSection>
	</div>
</div>
