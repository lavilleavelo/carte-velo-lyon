<script lang="ts">
	import Accessibility from '@lucide/svelte/icons/accessibility';
	import Clock from '@lucide/svelte/icons/clock';
	import Info from '@lucide/svelte/icons/info';

	let { properties } = $props();

	const isPaid = !!properties.fee;
	const isAccessible = !!properties.wheelchair;
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-2 text-brand-navy">
		<div
			class="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600"
		>
			<span class="text-sm font-bold">WC</span>
		</div>
		<h3 class="text-sm font-bold tracking-wide uppercase">
			{properties.name || 'Toilettes publiques'}
		</h3>
	</div>

	<div class="space-y-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
		{#if properties.operator}
			<div class="text-sm font-medium text-gray-800">
				{properties.operator}
			</div>
		{/if}

		<div class="flex flex-wrap gap-2">
			<span
				class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {isPaid
					? 'bg-amber-100 text-amber-700'
					: 'bg-green-100 text-green-700'}"
			>
				{isPaid ? 'Payant' : 'Gratuit'}
			</span>

			{#if isAccessible}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700"
				>
					<Accessibility size={12} />
					Accessible PMR
				</span>
			{/if}
		</div>

		{#if properties.opening_hours}
			<div class="flex items-start gap-2 text-gray-600">
				<Clock size={16} class="mt-0.5 shrink-0" />
				<span class="text-sm">{properties.opening_hours}</span>
			</div>
		{/if}

		{#if properties.description}
			<div class="flex items-start gap-2 text-gray-600">
				<Info size={16} class="mt-0.5 shrink-0" />
				<span class="text-sm">{properties.description}</span>
			</div>
		{/if}

		<div class="text-xs text-gray-400">Source : OpenStreetMap</div>
	</div>
</div>
