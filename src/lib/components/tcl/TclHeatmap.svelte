<script lang="ts">
	type Quantiles = { n: number; median: number | null; p90: number | null };

	interface Props {
		rows: { day: string; hours: (Quantiles | null)[] }[];
		metric: 'median' | 'p90';
		bins: { min: number; color: string; label: string }[];
		neutralColor: string;
		dividerDay: string;
		formatDay: (day: string) => string;
		formatValue: (minutes: number) => string;
	}

	let { rows, metric, bins, neutralColor, dividerDay, formatDay, formatValue }: Props = $props();

	let hovered = $state<{ day: string; hour: number; value: Quantiles } | null>(null);

	const hours = $derived(
		[...Array.from({ length: 19 }, (_, index) => index + 5), 0, 1, 2, 3, 4].filter(
			(hour) => hour >= 5 || rows.some((row) => (row.hours[hour]?.n ?? 0) > 0),
		),
	);

	function color(value: Quantiles | null): string {
		const minutes = value?.[metric];
		if (minutes === null || minutes === undefined) {
			return 'transparent';
		}
		let result = neutralColor;
		for (const bin of bins) {
			if (minutes >= bin.min) {
				result = bin.color;
			}
		}
		return result;
	}
</script>

{#if rows.every((row) => row.hours.every((value) => (value?.n ?? 0) === 0))}
	<p class="p-6 text-sm text-gray-500">Aucune donnée pour l'instant.</p>
{:else}
	<div class="overflow-x-auto">
		<div
			class="grid gap-[2px] text-[11px]"
			style:grid-template-columns="minmax(7rem, auto) repeat({hours.length}, minmax(1.1rem, 1fr))"
			role="grid"
		>
			<div></div>
			{#each hours as hour (hour)}
				<div class="text-center text-gray-500 tabular-nums">{hour}</div>
			{/each}
			{#each rows as row (row.day)}
				<div
					class={[
						'pr-2 whitespace-nowrap text-gray-700',
						row.day === dividerDay && 'border-t-2 border-gray-500 pt-0.5 font-semibold',
					]}
				>
					{formatDay(row.day)}
				</div>
				{#each hours as hour (hour)}
					{@const value = row.hours[hour]}
					<div
						class={[
							'h-5 rounded-[2px]',
							value ? 'cursor-crosshair' : 'bg-gray-50',
							hovered?.day === row.day && hovered?.hour === hour && 'ring-2 ring-gray-900',
						]}
						style:background={value ? color(value) : undefined}
						role="gridcell"
						tabindex="-1"
						aria-label={value
							? `${formatDay(row.day)}, ${hour} h : ${formatValue(value[metric] ?? 0)}`
							: undefined}
						onmouseenter={() => (hovered = value ? { day: row.day, hour, value } : null)}
						onmouseleave={() => (hovered = null)}
					></div>
				{/each}
			{/each}
		</div>
	</div>
	<p class="mt-2 min-h-5 text-xs text-gray-700">
		{#if hovered}
			<span class="font-medium"
				>{formatDay(hovered.day)}, de {hovered.hour} h à {hovered.hour + 1} h</span
			>
			: retard médian {formatValue(hovered.value.median ?? 0)}, 1 véhicule sur 10 au-delà de
			{formatValue(hovered.value.p90 ?? 0)} ({hovered.value.n.toLocaleString('fr-FR')} positions)
		{:else}
			Survolez une case pour voir le détail de l’heure.
		{/if}
	</p>
{/if}
