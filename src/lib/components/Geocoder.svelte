<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { Debounced } from 'runed';
	import Check from '@lucide/svelte/icons/check';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { cn } from '$lib/utils';
	import * as Command from '$lib/components/ui/command';

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
	let selectedValue = $state('');
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
				if (feature.properties.city && feature.properties.city !== feature.properties.name)
					parts.push(feature.properties.city);
				const label = parts.filter(Boolean).join(', ');

				if (seen.has(label)) return false;
				seen.add(label);
				return true;
			});
		},
		enabled: debouncedQuery.current.length >= 2,
	}));

	const results = $derived(geocoderQuery.data ?? []);
	const isLoading = $derived(geocoderQuery.isLoading);

	function getResultTitle(props: GeocoderResult['properties']): string {
		if (props.name) return props.name;
		if (props.housenumber && props.street) return `${props.housenumber} ${props.street}`;
		if (props.street) return props.street;
		return props.city || '';
	}

	function getResultSubtitle(props: GeocoderResult['properties']): string {
		const parts = [];
		if (props.city && props.city !== props.name) parts.push(props.city);
		if (props.state) parts.push(props.state);
		if (props.country) parts.push(props.country);
		return parts.filter(Boolean).join(', ');
	}

	function handleSelect(result: GeocoderResult) {
		const name = getResultTitle(result.properties);
		selectedValue = name;
		inputValue = name;
		open = false;
		onSelect?.(result.geometry.coordinates, name);
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
</script>

<div bind:this={wrapperRef} class={cn('relative z-50', className)}>
	<Command.Root shouldFilter={false} class="overflow-visible rounded-lg border bg-white shadow-md">
		<Command.Input
			bind:ref={inputRef}
			placeholder="Rechercher un lieu..."
			bind:value={inputValue}
			onfocus={() => (open = true)}
			oninput={() => (open = true)}
			class="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
		/>

		{#if open && (results.length > 0 || inputValue.length >= 2)}
			<div
				class="absolute top-[calc(100%+4px)] left-0 w-full animate-in rounded-md border bg-popover text-popover-foreground shadow-md fade-in-0 outline-none zoom-in-95"
			>
				<Command.List class="max-h-[300px] overflow-x-hidden overflow-y-auto p-1">
					{#if !isLoading && results.length === 0 && inputValue.length >= 2}
						<Command.Empty class="py-6 text-center text-sm">Aucun résultat trouvé.</Command.Empty>
					{/if}

					<Command.Group>
						{#each results as result}
							{@const title = getResultTitle(result.properties)}
							{@const subtitle = getResultSubtitle(result.properties)}
							<Command.Item
								value={title}
								onSelect={() => handleSelect(result)}
								class="relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
							>
								<Check
									class={cn('mr-2 h-4 w-4', selectedValue === title ? 'opacity-100' : 'opacity-0')}
								/>
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
				</Command.List>
			</div>
		{/if}
	</Command.Root>
</div>
