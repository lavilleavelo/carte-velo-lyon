<script lang="ts">
	import { velovPalettePreference } from '$lib/utils/mapPreferences.svelte';
	import {
		VELOV_CHANCE_LABELS,
		VELOV_CHANCE_LEVELS,
		VELOV_LIVE_LEVELS,
		type VelovForecastKind,
	} from '$lib/utils/velovForecast';

	let { kind, live = false }: { kind: VelovForecastKind; live?: boolean } = $props();

	const items = $derived.by(() => {
		const colors = velovPalettePreference.colors;
		if (kind === 'velos') {
			return [
				{ label: 'mécaniques', color: colors.mech.fill },
				{ label: 'électriques', color: colors.elec.fill },
			];
		}

		if (live) {
			return VELOV_LIVE_LEVELS.map(({ level, label }) => ({
				label: level === 'unlikely' && kind === 'bornes' ? 'aucune' : label,
				color: colors.chance[level],
			}));
		}

		return VELOV_CHANCE_LEVELS.map((level) => ({
			label: VELOV_CHANCE_LABELS[level],
			color: colors.chance[level],
		}));
	});
</script>

<ul class="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-gray-600">
	{#each items as item (item.label)}
		<li class="inline-flex items-center gap-1">
			<span
				class="h-2 w-2 rounded-full ring-1 ring-black/20"
				style:background-color={item.color}
				aria-hidden="true"
			></span>
			{item.label}
		</li>
	{/each}
</ul>
