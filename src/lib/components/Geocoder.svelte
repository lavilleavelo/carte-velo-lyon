<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { Debounced } from 'runed';
	import { goto } from '$app/navigation';
	import { buildCommuneHref } from '$lib/utils/communeNavigation';
	import Check from '@lucide/svelte/icons/check';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import Building2 from '@lucide/svelte/icons/building-2';
	import MapIcon from '@lucide/svelte/icons/map';
	import Gauge from '@lucide/svelte/icons/gauge';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Bike from '@lucide/svelte/icons/bike';
	import Info from '@lucide/svelte/icons/info';
	import FileText from '@lucide/svelte/icons/file-text';
	import { cn } from '$lib/utils';
	import * as Command from '$lib/components/ui/command';
	import communesIndex from '$lib/data/communes/_index.json';
	import communeMetadata from '$lib/data/communeMetadata.json';
	import { LYON_INSEE, LYON_SLUG } from '$lib/config/lyon';
	import { getAllFiches } from '$lib/content/fiches';
	import { normalizeForSearch as normalize } from '$lib/utils/textSearch';

	interface GeocoderResult {
		properties: {
			name?: string;
			country?: string;
			city?: string;
			state?: string;
			street?: string;
			housenumber?: string;
			osm_value?: string;
			osm_id?: number;
			osm_type?: string;
		};
		geometry: {
			coordinates: [number, number];
		};
	}

	interface Props {
		class?: string;
		bbox?: [number, number, number, number];
		onSelect?: (coordinates: [number, number], name: string) => void;
	}

	let { class: className, bbox, onSelect }: Props = $props();

	let open = $state(false);
	let inputValue = $state('');
	let selectedId = $state<number | undefined>(undefined);
	let selectedName = $state('');
	let inputRef = $state<HTMLInputElement>(null!);
	let wrapperRef = $state<HTMLDivElement>(null!);

	const debouncedQuery = new Debounced(() => inputValue, 300);

	const geocoderQuery = createQuery(() => ({
		queryKey: ['geocoder', debouncedQuery.current, bbox],
		queryFn: async () => {
			const q = debouncedQuery.current;
			if (!q || q.length < 2) return [];

			let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10`;
			if (bbox) {
				url += `&bbox=${bbox.join(',')}`;
			}

			const response = await fetch(url);
			const data = await response.json();
			const features = (data.features || []) as GeocoderResult[];

			const seen = new Set<string>();
			return features.filter((feature) => {
				const parts = [
					feature.properties.name,
					feature.properties.housenumber,
					feature.properties.street,
				];
				if (feature.properties.city && feature.properties.city !== feature.properties.name) {
					parts.push(feature.properties.city);
				}

				const keyParts = [...parts];
				if (feature.properties.osm_value) {
					keyParts.push(feature.properties.osm_value);
				}
				const label = keyParts.filter(Boolean).join('|');

				if (seen.has(label)) return false;
				seen.add(label);
				return true;
			});
		},
		enabled: debouncedQuery.current.length >= 2,
	}));

	const results = $derived(geocoderQuery.data ?? []);
	const isLoading = $derived(geocoderQuery.isLoading);
	const isSearching = $derived(isLoading || inputValue !== debouncedQuery.current);

	const populationByInsee = (() => {
		const m = new Map<string, number>();
		const records = communeMetadata as Record<string, { population?: number | null }>;
		for (const [insee, data] of Object.entries(records)) {
			m.set(insee, data.population ?? 0);
		}
		return m;
	})();

	const allCommunes = [
		{ slug: LYON_SLUG, name: 'Lyon (ville entière)', insee: LYON_INSEE },
		...communesIndex,
	].sort((a, b) => (populationByInsee.get(b.insee) ?? 0) - (populationByInsee.get(a.insee) ?? 0));

	const communeMatches = $derived.by(() => {
		const q = inputValue.trim();
		if (q.length < 2) {
			return allCommunes;
		}

		const nq = normalize(q);
		return allCommunes.filter((c) => normalize(c.name).includes(nq)).slice(0, 5);
	});

	const allFiches = getAllFiches();
	const ficheMatches = $derived.by(() => {
		const q = inputValue.trim();
		if (q.length < 2) {
			return [];
		}

		const nq = normalize(q);
		return allFiches
			.filter((f) => {
				const haystack = normalize([f.title, f.subtitle ?? '', f.address ?? '', f.slug].join(' '));
				return haystack.includes(nq);
			})
			.slice(0, 5);
	});

	type NavEntry = {
		href: string;
		label: string;
		hint: string;
		icon: typeof Building2;
		keywords: string[];
	};
	const NAV_ENTRIES: NavEntry[] = [
		{
			href: '/communes',
			label: 'Toutes les communes',
			hint: 'Liste complète et carte par commune',
			icon: Building2,
			keywords: ['communes', 'liste', 'arrondissements', 'metropole'],
		},
		{
			href: '/accidents',
			label: 'Accidents vélo',
			hint: 'Carte des accidents corporels (BAAC)',
			icon: AlertTriangle,
			keywords: ['accidents', 'accident', 'baac', 'velo', 'cyclistes'],
		},
		{
			href: '/ville-30',
			label: 'Ville 30',
			hint: 'Communes ayant adopté le 30 km/h',
			icon: Gauge,
			keywords: ['ville 30', 'vitesse', 'limitation', '30 km/h'],
		},
		{
			href: '/velov',
			label: 'Vélo’v',
			hint: 'Stations Vélo’v et disponibilités en temps réel',
			icon: Bike,
			keywords: ['velov', "vélo'v", 'stations'],
		},
		{
			href: '/a-propos',
			label: 'À propos',
			hint: 'Informations, mentions légales, contact',
			icon: Info,
			keywords: ['a propos', 'about', 'mentions legales', 'contact'],
		},
		{
			href: '/',
			label: 'Carte (accueil)',
			hint: 'Retour à la carte principale',
			icon: MapIcon,
			keywords: ['carte', 'accueil', 'home', 'map'],
		},
	];

	const navMatches = $derived.by<NavEntry[]>(() => {
		const q = inputValue.trim();
		if (q.length < 2) {
			return NAV_ENTRIES.filter((e) => e.href === '/communes');
		}
		const nq = normalize(q);
		return NAV_ENTRIES.filter((entry) => {
			if (normalize(entry.label).includes(nq)) return true;
			if (normalize(entry.hint).includes(nq)) return true;
			return entry.keywords.some((k) => normalize(k).includes(nq));
		});
	});

	function getResultTitle(props: GeocoderResult['properties']): string {
		if (props.name) return props.name;
		if (props.housenumber && props.street) return `${props.housenumber} ${props.street}`;
		if (props.street) return props.street;
		return props.city || '';
	}

	const typeTranslations: Record<string, string> = {
		bus_stop: 'Arrêt de bus',
		tram_stop: 'Arrêt de tram',
		subway_entrance: 'Bouche de métro',
		park: 'Parc',
		school: 'École',
		university: 'Université',
		kindergarten: 'Jardin d’enfants',
		college: 'Collège',
		public_building: 'Bâtiment public',
		residential: 'Résidentiel',
		commercial: 'Commercial',
		industrial: 'Industriel',
		place_of_worship: 'Lieu de culte',
		restaurant: 'Restaurant',
		cafe: 'Café',
		bar: 'Bar',
		fast_food: 'Restauration rapide',
		biergarten: 'Brasserie en plein air',
		cinema: 'Cinéma',
		arts_centre: 'Centre artistique',
		bank: 'Banque',
		pharmacy: 'Pharmacie',
		hospital: 'Hôpital',
		clinic: 'Clinique',
		doctors: 'Médecin',
		dentist: 'Dentiste',
		veterinary: 'Vétérinaire',
		theatre: 'Théâtre',
		nightclub: 'Boîte de nuit',
		playground: 'Aire de jeux',
		sports_centre: 'Centre sportif',
		pitch: 'Terrain de sport',
		swimming_pool: 'Piscine',
		stadium: 'Stade',
		attraction: 'Attraction touristique',
		information: 'Information',
		hotel: 'Hôtel',
		motel: 'Motel',
		guest_house: 'Maison d’hôtes',
		hostel: 'Auberge de jeunesse',
		camp_site: 'Camping',
		alpine_hut: 'Refuge de montagne',
		museum: 'Musée',
		zoo: 'Zoo',
		district: 'Quartier',
		city: 'Ville',
		village: 'Village',
		town: 'Ville',
		house: 'Maison',
		detached: 'Maison individuelle',
		apartments: 'Appartements',
		dormitory: 'Dortoir',
		terrace: 'Terrasse',
	};

	function getResultSubtitle(props: GeocoderResult['properties']): string {
		const parts = [];
		if (props.osm_value && typeTranslations[props.osm_value]) {
			parts.push(typeTranslations[props.osm_value]);
		}
		if (props.city && props.city !== props.name) parts.push(props.city);
		if (props.state) parts.push(props.state);
		if (props.country) parts.push(props.country);
		return parts.filter(Boolean).join(', ');
	}

	function handleSelect(result: GeocoderResult) {
		const name = getResultTitle(result.properties);
		const id = result.properties.osm_id;
		selectedId = id;
		selectedName = name;
		inputValue = name;
		open = false;
		onSelect?.(result.geometry.coordinates, name);
	}

	function handleCommuneSelect(slug: string, name: string) {
		inputValue = name;
		open = false;
		goto(buildCommuneHref(slug));
	}

	function handleNavSelect(entry: NavEntry) {
		inputValue = '';
		open = false;
		goto(entry.href);
	}

	function handleFicheSelect(slug: string, title: string) {
		inputValue = title;
		open = false;
		goto(`/fiches/${slug}`);
	}

	function handleClickOutside(event: MouseEvent) {
		if (wrapperRef && !wrapperRef.contains(event.target as Node)) {
			open = false;
		}
	}

	$effect(() => {
		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	});

	$effect(() => {
		function handleKeydown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				e.stopImmediatePropagation();
				inputRef?.focus();
				inputRef?.select?.();
				open = true;
			}
		}
		window.addEventListener('keydown', handleKeydown, { capture: true });
		return () => window.removeEventListener('keydown', handleKeydown, { capture: true });
	});
</script>

<div
	bind:this={wrapperRef}
	class={cn('relative z-50', className)}
	onpointerdown={(e) => e.stopPropagation()}
	ontouchstart={(e) => e.stopPropagation()}
>
	<Command.Root shouldFilter={false} class="overflow-visible rounded-lg border bg-white shadow-md">
		<Command.Input
			bind:ref={inputRef}
			placeholder="Un lieu ou une commune..."
			bind:value={inputValue}
			onfocus={() => (open = true)}
			oninput={() => (open = true)}
			class="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
		/>

		{#if open && (results.length > 0 || communeMatches.length > 0 || navMatches.length > 0 || ficheMatches.length > 0 || inputValue.length >= 2)}
			<div
				class="absolute top-[calc(100%+4px)] left-0 w-full animate-in rounded-md border bg-popover text-popover-foreground shadow-md fade-in-0 outline-none zoom-in-95"
			>
				<Command.List class="max-h-[300px] overflow-x-hidden overflow-y-auto p-1">
					{#if navMatches.length > 0}
						<Command.Group>
							<div
								class="px-2 pt-1 pb-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
							>
								Pages
							</div>
							{#each navMatches as entry (entry.href)}
								<Command.Item
									value={`nav-${entry.href}`}
									onSelect={() => handleNavSelect(entry)}
									class="relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none aria-selected:bg-accent aria-selected:text-accent-foreground"
								>
									<entry.icon class="mr-2 h-4 w-4 shrink-0 text-brand-navy" />
									<div class="flex flex-col">
										<span class="font-medium">{entry.label}</span>
										<span class="text-xs text-muted-foreground">{entry.hint}</span>
									</div>
								</Command.Item>
							{/each}
						</Command.Group>
					{/if}

					{#if communeMatches.length > 0}
						<Command.Group>
							<div
								class="px-2 pt-1 pb-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
							>
								Communes
							</div>
							{#each communeMatches as commune (commune.slug)}
								<Command.Item
									value={`commune-${commune.slug}`}
									onSelect={() => handleCommuneSelect(commune.slug, commune.name)}
									class="relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none aria-selected:bg-accent aria-selected:text-accent-foreground"
								>
									<Building2 class="mr-2 h-4 w-4 shrink-0 text-brand-navy" />
									<div class="flex flex-col">
										<span class="font-medium">{commune.name}</span>
										<span class="text-xs text-muted-foreground">Voir la carte de la commune</span>
									</div>
								</Command.Item>
							{/each}
						</Command.Group>
					{/if}

					{#if ficheMatches.length > 0}
						<Command.Group>
							<div
								class="px-2 pt-1 pb-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
							>
								Fiches
							</div>
							{#each ficheMatches as fiche (fiche.slug)}
								<Command.Item
									value={`fiche-${fiche.slug}`}
									onSelect={() => handleFicheSelect(fiche.slug, fiche.title)}
									class="relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none aria-selected:bg-accent aria-selected:text-accent-foreground"
								>
									<FileText class="mr-2 h-4 w-4 shrink-0 text-brand-navy" />
									<div class="flex flex-col">
										<span class="font-medium">{fiche.title}</span>
										{#if fiche.subtitle}
											<span class="text-xs text-muted-foreground">{fiche.subtitle}</span>
										{/if}
									</div>
								</Command.Item>
							{/each}
						</Command.Group>
					{/if}

					{#if isSearching}
						<div class="flex items-center justify-center py-6 text-sm text-muted-foreground">
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Recherche en cours...
						</div>
					{:else if results.length === 0 && communeMatches.length === 0 && navMatches.length === 0 && ficheMatches.length === 0}
						<Command.Empty class="py-6 text-center text-sm">Aucun résultat trouvé.</Command.Empty>
					{/if}

					{#if !isSearching && results.length > 0}
						<Command.Group>
							{#each results as result, i}
								{@const title = getResultTitle(result.properties)}
								{@const subtitle = getResultSubtitle(result.properties)}
								{@const isSelected = selectedId === result.properties.osm_id}
								<Command.Item
									value={`${title}-${subtitle}-${i}`}
									onSelect={() => handleSelect(result)}
									class="relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
								>
									<Check class={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
									<div class="flex flex-col">
										<span class="font-medium">{title}</span>
										{#if subtitle}
											<span class="text-xs text-muted-foreground">
												{subtitle}
											</span>
										{/if}
									</div>
								</Command.Item>
							{/each}
						</Command.Group>
					{/if}
				</Command.List>
			</div>
		{/if}
	</Command.Root>
</div>
