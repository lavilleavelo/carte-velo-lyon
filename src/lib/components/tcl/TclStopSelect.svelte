<script lang="ts">
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { containsFilter } from './search';

	type Group = {
		line: string;
		direction: string;
		label: string;
		stops: { id: number; name: string; order: number }[];
	};

	interface Props {
		name: string;
		form: string;
		label: string;
		color: string;
		groups: Group[];
		value: number | null;
		placeholder?: string;
		onChange: (id: number | null) => void;
	}

	let {
		name,
		form,
		label,
		color,
		groups,
		value,
		placeholder = 'Choisir un arrêt',
		onChange,
	}: Props = $props();

	let open = $state(false);

	const selectedName = $derived(
		value === null
			? null
			: (groups.flatMap((group) => group.stops).find((stop) => stop.id === value)?.name ?? null),
	);

	function choose(id: number | null) {
		open = false;
		onChange(id);
	}
</script>

<input type="hidden" {name} {form} value={value ?? ''} />

<Popover.Root bind:open>
	<Popover.Trigger
		class="inline-flex max-w-[20rem] items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-50 disabled:opacity-50"
		disabled={groups.length === 0}
	>
		<span class="size-3 shrink-0 rounded-full border-2 border-gray-800" style:background={color}
		></span>
		<span class="text-gray-600">{label}</span>
		<span class={['truncate', selectedName ? 'font-medium' : 'text-gray-500']}>
			{selectedName ?? placeholder}
		</span>
		<ChevronDown class="size-4 shrink-0 text-gray-500" />
	</Popover.Trigger>
	<Popover.Content class="z-50 w-80 border border-gray-200 bg-white p-0 shadow-lg" align="start">
		<Command.Root class="bg-white" filter={containsFilter}>
			<Command.Input placeholder="Rechercher un arrêt" />
			<Command.List class="max-h-80 overflow-y-auto">
				<Command.Empty class="py-6 text-center text-sm">Aucun arrêt trouvé.</Command.Empty>
				{#if value !== null}
					<Command.Group>
						<Command.Item value="effacer le choix" onSelect={() => choose(null)}>
							<span class="text-gray-600">Effacer le choix</span>
						</Command.Item>
					</Command.Group>
				{/if}
				{#each groups as group (`${group.line}|${group.direction}`)}
					<Command.Group heading={group.label}>
						{#each group.stops as stop, index (stop.id)}
							<Command.Item
								value={`${group.line} ${group.direction} ${stop.id} ${stop.name}`}
								keywords={[stop.name, group.line]}
								onSelect={() => choose(stop.id)}
							>
								<Check class={value === stop.id ? 'size-4 opacity-100' : 'size-4 opacity-0'} />
								<span class="w-5 text-right text-xs text-gray-400 tabular-nums">{index + 1}</span>
								{stop.name}
							</Command.Item>
						{/each}
					</Command.Group>
				{/each}
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
