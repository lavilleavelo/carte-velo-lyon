<script lang="ts">
	import type { CommuneStats } from '$lib/server/communeStats';
	import type { OsmSafetyStats } from '$lib/server/communeOsmStats';
	import type { Ville30Stats } from '$lib/utils/speedLimits';

	let {
		communeName,
		stats = null,
		ville30Stats = null,
		osmSafetyStats = null,
	}: {
		communeName: string;
		stats?: CommuneStats | null;
		ville30Stats?: Ville30Stats | null;
		osmSafetyStats?: OsmSafetyStats | null;
	} = $props();

	const decimal = new Intl.NumberFormat('fr-FR', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
	const whole = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

	const ville30Pct = $derived(ville30Stats?.eligibleUnder30KmPercentage ?? null);
	const parkingPlaces = $derived(stats?.parkingPlaces ?? null);
</script>

{#if osmSafetyStats && osmSafetyStats.totalKm > 0}
	<p class="text-sm leading-relaxed text-gray-700">
		À <span class="font-semibold text-brand-navy">{communeName}</span>{#if ville30Pct !== null}, <span
				class="font-semibold">{whole.format(ville30Pct)}&nbsp;%</span
			>
			des rues sont limitées à 30&nbsp;km/h ou moins{/if}. Le réseau cyclable totalise
		<span class="font-semibold">{decimal.format(osmSafetyStats.totalKm)}&nbsp;km</span>
		d'aménagements, dont
		<span class="font-semibold">{decimal.format(osmSafetyStats.safeKm)}&nbsp;km sécurisés</span>
		({whole.format(osmSafetyStats.safePct)}&nbsp;%){#if parkingPlaces && parkingPlaces > 0}, avec
			<span class="font-semibold">{whole.format(parkingPlaces)} places</span>
			de stationnement vélo{/if}.
	</p>
{/if}
