<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import Printer from '@lucide/svelte/icons/printer';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import * as Dialog from '$lib/components/ui/dialog';
	import { printMaps } from '$lib/config/printMaps';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const icons = { web: Smartphone, print: Printer };
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Carte vélo Lyon en PDF</Dialog.Title>
			<Dialog.Description>
				Le réseau cyclable de Lyon, Villeurbanne et alentours, au format A0.
			</Dialog.Description>
		</Dialog.Header>
		<ul class="flex flex-col gap-2">
			{#each printMaps as map (map.href)}
				{@const Icon = icons[map.kind]}
				<li>
					<a
						href={map.href}
						target="_blank"
						rel="noopener"
						onclick={() => (open = false)}
						class="flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:border-brand-teal hover:bg-gray-50"
					>
						<Icon class="h-6 w-6 shrink-0 text-brand-teal" />
						<span class="flex flex-1 flex-col">
							<span class="text-sm font-semibold text-brand-navy">{map.label}</span>
							<span class="text-xs text-gray-600">{map.use} · {map.detail}</span>
						</span>
						<Download class="h-4 w-4 shrink-0 text-gray-500" />
					</a>
				</li>
			{/each}
		</ul>
	</Dialog.Content>
</Dialog.Root>
