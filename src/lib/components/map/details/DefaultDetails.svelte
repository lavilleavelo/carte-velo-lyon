<script lang="ts">
	import Info from '@lucide/svelte/icons/info';

	let { properties } = $props();
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-2 text-brand-navy">
		<div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600">
			<Info size={18} />
		</div>
		<h3 class="text-sm font-bold tracking-wide uppercase">Informations</h3>
	</div>

	<div class="space-y-2">
		{#each Object.entries(properties) as prop}
			{#if prop[0] !== 'scores' && prop[1] && typeof prop[1] !== 'object'}
				<div class="flex flex-col gap-0.5 rounded border border-gray-100 bg-gray-50/50 px-2 py-1.5">
					<span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">{prop[0]}</span
					>
					<span class="text-xs font-medium break-words text-gray-900">{prop[1]}</span>
				</div>
			{/if}
		{/each}
	</div>
</div>
