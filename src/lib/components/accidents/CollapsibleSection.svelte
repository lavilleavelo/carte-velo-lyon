<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import type { Snippet } from 'svelte';

	let {
		title,
		collapsed = $bindable(false),
		active = false,
		headerActions,
		collapsedSummary,
		children,
		divider = true,
	}: {
		title: string;
		collapsed?: boolean;
		active?: boolean;
		headerActions?: Snippet;
		collapsedSummary?: Snippet;
		children?: Snippet;
		divider?: boolean;
	} = $props();
</script>

<div class:border-t={divider} class:border-gray-100={divider} class:pt-3={divider}>
	<div class="mb-2 flex items-center justify-between gap-2">
		<button
			type="button"
			onclick={() => (collapsed = !collapsed)}
			class="-ml-0.5 flex flex-1 items-center gap-1 rounded p-0.5 text-left transition-colors hover:bg-gray-50"
			aria-expanded={!collapsed}
			title={collapsed ? `Afficher ${title.toLowerCase()}` : `Masquer ${title.toLowerCase()}`}
		>
			<ChevronDown
				size={12}
				class="shrink-0 text-gray-400 transition-transform {collapsed
					? '-rotate-90'
					: 'rotate-0'}"
			/>
			<h2 class="text-xs font-medium text-gray-600 uppercase">{title}</h2>
			{#if active}
				<span
					class="ml-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-navy"
					title="Filtre actif"
					aria-label="Filtre actif"
				></span>
			{/if}
		</button>
		{#if collapsed && collapsedSummary}
			{@render collapsedSummary()}
		{:else if !collapsed && headerActions}
			{@render headerActions()}
		{/if}
	</div>
	{#if !collapsed}
		{@render children?.()}
	{/if}
</div>
