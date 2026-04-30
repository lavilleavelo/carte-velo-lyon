<script lang="ts">
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Calendar from '@lucide/svelte/icons/calendar';
	import User from '@lucide/svelte/icons/user';
	import Car from '@lucide/svelte/icons/car';

	let { properties } = $props();

	type GravityKey = 'Tué' | 'Blessé hospitalisé' | 'Blessé léger' | 'Indemne';
	const META: Record<
		GravityKey,
		{ ringClass: string; chipClass: string; iconClass: string; short: string }
	> = {
		Tué: {
			ringClass: 'ring-gray-900/20',
			chipClass: 'bg-gray-900 text-white',
			iconClass: 'bg-gray-100 text-gray-900',
			short: 'mortel',
		},
		'Blessé hospitalisé': {
			ringClass: 'ring-red-500/20',
			chipClass: 'bg-red-600 text-white',
			iconClass: 'bg-red-50 text-red-700',
			short: 'grave',
		},
		'Blessé léger': {
			ringClass: 'ring-yellow-400/30',
			chipClass: 'bg-yellow-400 text-gray-900',
			iconClass: 'bg-yellow-50 text-yellow-700',
			short: 'léger',
		},
		Indemne: {
			ringClass: 'ring-blue-400/30',
			chipClass: 'bg-blue-500 text-white',
			iconClass: 'bg-blue-50 text-blue-700',
			short: 'indemne',
		},
	};

	const gravity = $derived((properties.gravite as GravityKey) || 'Blessé léger');
	const meta = $derived(META[gravity] ?? META['Blessé léger']);

	const MONTHS_FR = [
		'janvier',
		'février',
		'mars',
		'avril',
		'mai',
		'juin',
		'juillet',
		'août',
		'septembre',
		'octobre',
		'novembre',
		'décembre',
	];

	const formattedDate = $derived.by(() => {
		const iso = String(properties.annee ?? '');
		const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
		if (!m) {
			return iso;
		}

		const day = Number(m[3]);
		const monthIdx = Number(m[2]) - 1;
		const year = Number(m[1]);
		if (monthIdx < 0 || monthIdx > 11) {
			return iso;
		}

		return `${day === 1 ? '1ᵉʳ' : day} ${MONTHS_FR[monthIdx]} ${year}`;
	});

	const victim = $derived.by(() => {
		const isPassenger = properties.categorie === 'Passager';
		const vehicle = String(properties.victim_vehicle ?? 'Vélo');
		let role: string;
		if (vehicle === 'Piéton') {
			role = 'Piéton·ne';
		} else if (vehicle === 'EDPM' || vehicle === 'EDP non motorisé') {
			role = isPassenger ? `Passager·ère ${vehicle}` : vehicle;
		} else if (vehicle === 'VAE') {
			role = isPassenger ? 'Passager·ère VAE' : 'Cycliste (VAE)';
		} else {
			role = isPassenger ? 'Passager·ère vélo' : 'Cycliste';
		}

		const sex = properties.sexe_victime ? String(properties.sexe_victime).toLowerCase() : '';
		const age = Number.isFinite(properties.age) ? `${properties.age} ans` : '';

		return [role, sex, age].filter(Boolean).join(' · ');
	});

	const casualty = $derived.by(() => {
		const t = Number(properties.tues) || 0;
		const h = Number(properties.hospitalises) || 0;
		const b = Number(properties.blesses_legers) || 0;
		const i = Number(properties.indemnes) || 0;
		const total = t + h + b + i;
		if (total <= 1) {
			return null;
		}

		const parts: string[] = [];
		if (t) parts.push(`${t} tué${t > 1 ? 's' : ''}`);
		if (h) parts.push(`${h} hospitalisé${h > 1 ? 's' : ''}`);
		if (b) parts.push(`${b} blessé${b > 1 ? 's' : ''} léger${b > 1 ? 's' : ''}`);
		if (i) parts.push(`${i} indemne${i > 1 ? 's' : ''}`);
		return { total, parts };
	});

	// BAAC resume opens with a sentence we already render via the badge;
	// strip it so we only show the per-vehicle details.
	const resumeTail = $derived.by(() => {
		const raw = properties.resume ? String(properties.resume).replace(/\s+/g, ' ').trim() : '';
		if (!raw) {
			return '';
		}

		const idx = raw.indexOf('. ');
		const tail = idx >= 0 ? raw.slice(idx + 2).trim() : raw;
		return tail;
	});

	const adresse = $derived(properties.adresse ? String(properties.adresse).trim() : '');
	const commune = $derived(
		properties.libelle_commune ? String(properties.libelle_commune).trim() : '',
	);
	const collisionType = $derived(
		properties.collision_type ? String(properties.collision_type) : '',
	);
	const otherVehicles = $derived.by<string[]>(() => {
		const raw = properties.other_vehicles;
		if (Array.isArray(raw)) {
			return raw.filter((s: unknown) => typeof s === 'string') as string[];
		}

		if (typeof raw === 'string') {
			try {
				const parsed = JSON.parse(raw);
				return Array.isArray(parsed) ? parsed : [];
			} catch {
				return [];
			}
		}
		return [];
	});

	const intersection = $derived(properties.intersection ? String(properties.intersection) : '');
	const collisionShape = $derived(
		properties.collision_shape ? String(properties.collision_shape) : '',
	);

	const manoeuvre = $derived(properties.manoeuvre ? String(properties.manoeuvre) : '');
	const lateral = $derived(Boolean(properties.lateral));

	const conditions = $derived.by(() => {
		const items: { label: string; value: string }[] = [];
		if (intersection) {
			const isCarrefour = intersection !== 'Hors intersection';
			items.push({
				label: isCarrefour ? 'Carrefour' : 'Lieu',
				value: isCarrefour ? intersection : 'Hors intersection',
			});
		}

		if (collisionShape && collisionShape !== 'Sans collision') {
			items.push({
				label: lateral ? 'Choc latéral' : 'Choc',
				value: collisionShape,
			});
		}

		if (manoeuvre) {
			items.push({ label: 'Manœuvre', value: manoeuvre });
		}

		return items;
	});
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-2 text-brand-navy">
		<div
			class="flex h-8 w-8 items-center justify-center rounded-full {meta.iconClass}"
			aria-hidden="true"
		>
			<AlertTriangle size={18} />
		</div>
		<div class="flex flex-1 items-center justify-between gap-2">
			<h3 class="text-sm font-bold tracking-wide uppercase">Accident vélo</h3>
			<span
				class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ring-2 {meta.chipClass} {meta.ringClass}"
			>
				{gravity}
			</span>
		</div>
	</div>

	<div class="space-y-2 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
		<div class="flex items-start gap-2">
			<User size={14} class="mt-0.5 shrink-0 text-gray-400" />
			<div class="flex-1">
				<p class="text-sm font-semibold text-gray-900">{victim}</p>
			</div>
		</div>
		{#if formattedDate}
			<div class="flex items-start gap-2">
				<Calendar size={14} class="mt-0.5 shrink-0 text-gray-400" />
				<p class="text-sm text-gray-700">{formattedDate}</p>
			</div>
		{/if}
		{#if adresse || commune}
			<div class="flex items-start gap-2">
				<MapPin size={14} class="mt-0.5 shrink-0 text-gray-400" />
				<div class="flex-1">
					{#if adresse}
						<p class="text-sm text-gray-900">{adresse}</p>
					{/if}
					{#if commune}
						<p class="text-xs text-gray-500">{commune}</p>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	{#if collisionType}
		<div class="rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2">
			<div class="flex items-start gap-2">
				<Car size={14} class="mt-0.5 shrink-0 text-gray-400" />
				<div class="flex-1">
					<p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
						Type de collision
					</p>
					<p class="mt-0.5 text-sm font-semibold text-gray-900">{collisionType}</p>
					{#if otherVehicles.length > 0}
						<div class="mt-1 flex flex-wrap gap-1">
							{#each otherVehicles as v}
								<span
									class="inline-flex items-center rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-700 ring-1 ring-gray-200"
								>
									{v}
								</span>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if conditions.length > 0}
		<div class="rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2">
			<p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Circonstances</p>
			<dl class="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-xs">
				{#each conditions as c (c.label)}
					<dt class="text-gray-500">{c.label}</dt>
					<dd class="text-gray-800">{c.value}</dd>
				{/each}
			</dl>
		</div>
	{/if}

	{#if casualty}
		<div class="rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2">
			<p class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
				Bilan total ({casualty.total} victimes)
			</p>
			<p class="mt-0.5 text-sm text-gray-800">{casualty.parts.join(' · ')}</p>
		</div>
	{/if}

	{#if resumeTail}
		<details class="group rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2">
			<summary
				class="cursor-pointer text-[10px] font-bold tracking-wider text-gray-500 uppercase select-none hover:text-gray-700"
			>
				Détails de l'accident
			</summary>
			<p class="mt-2 text-xs leading-relaxed text-gray-600">{resumeTail}</p>
		</details>
	{/if}

	<div class="flex items-center gap-2 text-[10px] text-gray-400">
		<span>
			Données :
			<a
				href="https://www.data.gouv.fr/datasets/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2024"
				target="_blank"
				rel="noopener"
				class="hover:underline">BAAC, data.gouv.fr</a
			>
		</span>
	</div>
</div>
