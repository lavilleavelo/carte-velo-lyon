<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { Debounced } from 'runed';
	import { tick } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { cn } from '$lib/utils';
	import * as Command from '$lib/components/ui/command';
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';

	interface GeocoderResult {
		properties: {
			name: string;
			country?: string;
			city?: string;
			state?: string;
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
	let triggerRef = $state<HTMLButtonElement>(null!);

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
				const parts = [feature.properties.name];
				if (feature.properties.city && feature.properties.city !== feature.properties.name)
					parts.push(feature.properties.city);
				if (feature.properties.state) parts.push(feature.properties.state);
				if (feature.properties.country) parts.push(feature.properties.country);
				const label = parts.filter(Boolean).join(', ');

				if (seen.has(label)) return false;
				seen.add(label);
				return true;
			});
		},
		enabled: debouncedQuery.current.length >= 2
	}));

	const results = $derived(geocoderQuery.data ?? []);
	const isLoading = $derived(geocoderQuery.isLoading);

	function formatResultLabel(result: GeocoderResult): string {
		const parts = [result.properties.name];
		if (result.properties.city && result.properties.city !== result.properties.name)
			parts.push(result.properties.city);
		if (result.properties.state) parts.push(result.properties.state);
		if (result.properties.country) parts.push(result.properties.country);
		return parts.filter(Boolean).join(', ');
	}

	function closeAndFocusTrigger() {
		open = false;
		tick().then(() => {
			triggerRef.focus();
		});
	}

	function handleSelect(result: GeocoderResult) {
		const name = result.properties.name;
		selectedValue = name;
		inputValue = '';
		closeAndFocusTrigger();
		onSelect?.(result.geometry.coordinates, name);
	}

	$effect(() => {
		if (!open) {
			inputValue = '';
		}
	});
</script>

<Popover.Root bind:open>
	<Popover.Trigger bind:ref={triggerRef}>
		{#snippet child({ props })}
			<Button
				variant="outline"
				role="combobox"
				aria-expanded={open}
				{...props}
				class="w-full min-w-[200px] justify-between"
			>
				<span class="truncate">
					{selectedValue || 'Rechercher un lieu...'}
				</span>
				<SearchIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content align="start">
		<Command.Root shouldFilter={false} class="[&_[data-slot=command-input-wrapper]]:pr-3">
			<Command.Input placeholder="Rechercher un lieu..." bind:value={inputValue} />
			<Command.List>
				{#if !isLoading && results.length === 0 && inputValue.length >= 2}
					<Command.Empty>Aucun résultat trouvé.</Command.Empty>
				{/if}

				<Command.Group>
					{#each results as result}
						<Command.Item value={formatResultLabel(result)} onSelect={() => handleSelect(result)}>
							<Check
								class={cn(
									'mr-2 h-4 w-4',
									selectedValue === result.properties.name ? 'opacity-100' : 'opacity-0'
								)}
							/>
							<div class="flex flex-col">
								<span>{result.properties.name}</span>
								{#if result.properties.city || result.properties.state || result.properties.country}
									<span class="text-xs text-muted-foreground">
										{formatResultLabel(result)}
									</span>
								{/if}
							</div>
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
