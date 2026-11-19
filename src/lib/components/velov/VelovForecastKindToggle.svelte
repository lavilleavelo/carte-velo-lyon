<script lang="ts">
	import {
		VELOV_FORECAST_KINDS,
		VELOV_FORECAST_KIND_INFO,
		type VelovForecastKind,
	} from '$lib/utils/velovForecast';

	let { kind = $bindable('velos') }: { kind?: VelovForecastKind } = $props();
</script>

<div
	class="flex rounded-md border border-gray-200 bg-white p-0.5"
	role="group"
	aria-label="Ce que compte la prévision"
>
	{#each VELOV_FORECAST_KINDS as entry (entry)}
		<button
			type="button"
			title={VELOV_FORECAST_KIND_INFO[entry].title}
			aria-pressed={kind === entry}
			onclick={() => (kind = entry)}
			class="flex-auto rounded px-1 py-0.5 text-[11px] font-medium transition-colors pointer-coarse:py-2 pointer-coarse:text-xs {kind ===
			entry
				? 'bg-brand-navy text-white'
				: 'text-gray-600 hover:bg-gray-100'}"
		>
			{VELOV_FORECAST_KIND_INFO[entry].label}
		</button>
	{/each}
</div>
