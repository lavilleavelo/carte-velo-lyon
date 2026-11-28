<script lang="ts">
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { containsFilter } from './search';
	import { tick } from 'svelte';

	interface Props {
		groups: { label: string; lines: string[] }[];
		grenette: string[];
		selected: string[] | null;
	}

	let { groups, grenette, selected }: Props = $props();

	let open = $state(false);
	let editing = $state(false);
	let draft = $state<string[] | null>(null);
	let anchor = $state<HTMLSpanElement | null>(null);

	const current = $derived(editing ? draft : selected);

	function sameLines(a: string[] | null, b: string[] | null): boolean {
		if (a === null || b === null) {
			return a === b;
		}
		return a.length === b.length && a.every((line) => b.includes(line));
	}

	const summary = $derived.by(() => {
		if (current === null) {
			return 'Tout le réseau';
		}
		if (sameLines(current, grenette)) {
			return `Rue Grenette (${grenette.join(', ')})`;
		}
		if (current.length === 0) {
			return 'Aucune ligne';
		}
		return current.length <= 4
			? current.join(', ')
			: `${current.slice(0, 3).join(', ')} et ${current.length - 3} autres`;
	});

	function toggle(line: string) {
		const base = draft ?? [];
		draft = base.includes(line) ? base.filter((item) => item !== line) : [...base, line];
	}

	async function apply() {
		open = false;
		if (!sameLines(draft, selected) && (draft === null || draft.length > 0)) {
			await tick();
			anchor?.closest('form')?.requestSubmit();
		}
		editing = false;
	}

	function onOpenChange(value: boolean) {
		if (value) {
			draft = selected === null ? null : [...selected];
			editing = true;
		} else {
			apply();
		}
	}

	function checkClass(checked: boolean): string {
		return checked ? 'size-4 opacity-100' : 'size-4 opacity-0';
	}
</script>

<span bind:this={anchor} class="contents">
	{#if current === null}
		<input type="hidden" name="ligne" value="reseau" />
	{:else}
		{#each current as line (line)}
			<input type="hidden" name="ligne" value={line} />
		{/each}
	{/if}
</span>

<Popover.Root bind:open {onOpenChange}>
	<Popover.Trigger
		class="inline-flex max-w-[22rem] items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-50"
	>
		<span class="text-gray-600">Lignes</span>
		<span class="truncate font-medium">{summary}</span>
		<ChevronDown class="size-4 shrink-0 text-gray-500" />
	</Popover.Trigger>
	<Popover.Content class="z-50 w-72 border border-gray-200 bg-white p-0 shadow-lg" align="start">
		<Command.Root class="bg-white" filter={containsFilter}>
			<Command.Input placeholder="Rechercher une ligne (C13, T1, 86…)" />
			<Command.List class="max-h-80 overflow-y-auto">
				<Command.Empty class="py-6 text-center text-sm">Aucune ligne trouvée.</Command.Empty>
				<Command.Group heading="Raccourcis">
					<Command.Item value="raccourci rue grenette" onSelect={() => (draft = [...grenette])}>
						<Check class={checkClass(sameLines(draft, grenette))} />
						Rue Grenette ({grenette.join(', ')})
					</Command.Item>
					<Command.Item value="raccourci tout le reseau" onSelect={() => (draft = null)}>
						<Check class={checkClass(draft === null)} />
						Tout le réseau
					</Command.Item>
				</Command.Group>
				{#each groups as group (group.label)}
					<Command.Group heading={group.label}>
						{#each group.lines as line (line)}
							<Command.Item value={`ligne ${line}`} onSelect={() => toggle(line)}>
								<Check class={checkClass(draft?.includes(line) ?? false)} />
								{line}
							</Command.Item>
						{/each}
					</Command.Group>
				{/each}
			</Command.List>
		</Command.Root>
		<div class="flex items-center justify-between gap-2 border-t border-gray-200 p-2">
			<button
				type="button"
				class="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
				onclick={() => (draft = [])}
			>
				Tout décocher
			</button>
			<button
				type="button"
				class="rounded-md bg-brand-navy px-3 py-1 text-sm text-white disabled:opacity-50"
				disabled={draft !== null && draft.length === 0}
				onclick={apply}
			>
				Afficher
			</button>
		</div>
	</Popover.Content>
</Popover.Root>
