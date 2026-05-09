<script lang="ts">
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import type { OsmSafetyStats } from '$lib/server/communeOsmStats';

	let {
		communeName,
		stats = null,
	}: {
		communeName?: string;
		stats?: OsmSafetyStats | null;
	} = $props();

	const decimalFormatter = new Intl.NumberFormat('fr-FR', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
	const percentFormatter = new Intl.NumberFormat('fr-FR', {
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	});
</script>

{#if stats && stats.totalKm > 0}
	<section class="space-y-3">
		<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
			<h2 class="text-xl font-bold text-brand-navy">Sécurité du réseau cyclable</h2>
			<span class="text-xs text-gray-500">
				Total réseau&nbsp;: {decimalFormatter.format(stats.totalKm)}&nbsp;km
			</span>
		</div>

		<div class="grid gap-3 sm:grid-cols-2">
			<article class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<div class="flex items-start gap-3">
					<span
						class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-navy/10 text-brand-navy"
					>
						<ShieldCheck class="h-4 w-4" aria-hidden="true" />
					</span>
					<div class="min-w-0 flex-1">
						<h3 class="text-sm font-semibold text-gray-700">
							Aménagements sécurisés (avec voies vertes)
						</h3>
						<div class="mt-1 flex items-baseline gap-1.5">
							<span class="text-3xl font-bold text-brand-navy">
								{decimalFormatter.format(stats.safeKm)}
							</span>
							<span class="text-sm font-medium text-gray-500">km</span>
							<span class="ml-auto text-sm font-semibold text-brand-navy">
								{percentFormatter.format(stats.safePct)}&nbsp;%
							</span>
						</div>
						<p class="mt-1 text-xs text-gray-500">
							Pistes cyclables, voies vertes et vélorues ({decimalFormatter.format(
								stats.voieVerteKm,
							)}&nbsp;km de voies vertes incluses{stats.voieVerteUnstableKm > 0
								? `, dont ${decimalFormatter.format(stats.voieVerteUnstableKm)} km au revêtement non stabilisé`
								: ''}).
						</p>
					</div>
				</div>
			</article>

			<article class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<div class="flex items-start gap-3">
					<span
						class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-navy/10 text-brand-navy"
					>
						<ShieldAlert class="h-4 w-4" aria-hidden="true" />
					</span>
					<div class="min-w-0 flex-1">
						<h3 class="text-sm font-semibold text-gray-700">
							Aménagements sécurisés (hors voies partagées avec piétons)
						</h3>
						<div class="mt-1 flex items-baseline gap-1.5">
							<span class="text-3xl font-bold text-brand-navy">
								{decimalFormatter.format(stats.safeNoVoieVerteKm)}
							</span>
							<span class="text-sm font-medium text-gray-500">km</span>
							<span class="ml-auto text-sm font-semibold text-brand-navy">
								{percentFormatter.format(stats.safeNoVoieVertePct)}&nbsp;%
							</span>
						</div>
						<p class="mt-1 text-xs text-gray-500">
							Pistes cyclables et vélorues uniquement (sans voies vertes ni voies piétonnes ouvertes
							aux vélos).
						</p>
					</div>
				</div>
			</article>
		</div>

		<p class="text-xs text-gray-500">
			Calcul à partir des aménagements OpenStreetMap dans les limites
			{communeName ? `de ${communeName}` : 'de la commune'}. Les voies vertes sont sécurisées mais
			peuvent générer des conflits avec les piétons et sont parfois inutilisables par mauvais temps
			(revêtement non stabilisé). Les voies piétonnes ouvertes aux vélos (trottoirs, chemins) ne
			sont pas comptabilisées : sans aménagement dédié, elles ne constituent pas un aménagement
			cyclable à part entière.
		</p>
	</section>
{/if}
