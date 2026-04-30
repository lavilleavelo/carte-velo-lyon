<script lang="ts">
	import type { AccidentProps } from './types';
	import type { Feature, Point } from 'geojson';

	let {
		features,
	}: {
		features: Feature<Point, AccidentProps>[];
	} = $props();

	const numFmt = new Intl.NumberFormat('fr-FR');
	const pctFmt = (n: number) => (Number.isFinite(n) ? `${n.toFixed(0)} %` : '–');

	function topCounts(
		arr: Feature<Point, AccidentProps>[],
		key: keyof AccidentProps,
		limit = 3,
	): { label: string; n: number; pct: number }[] {
		const m = new Map<string, number>();
		let total = 0;
		for (const f of arr) {
			const v = f.properties[key];
			if (typeof v !== 'string' || !v) continue;
			m.set(v, (m.get(v) ?? 0) + 1);
			total += 1;
		}
		if (total === 0) return [];
		return [...m.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, limit)
			.map(([label, n]) => ({ label, n, pct: (n / total) * 100 }));
	}

	const stats = $derived.by(() => {
		const total = features.length;
		if (total === 0) {
			return {
				total: 0,
				pctMale: NaN,
				pctFemale: NaN,
				meanAge: null,
				medianAge: null,
				pctIntersection: NaN,
				pctLateral: NaN,
				topManoeuvres: [],
				topChocs: [],
			};
		}

		let male = 0;
		let female = 0;
		let sexKnown = 0;
		let ageKnown = 0;
		let ageSum = 0;
		const ageList: number[] = [];
		let inter = 0;
		let interKnown = 0;
		let lateral = 0;
		let lateralKnown = 0;

		for (const f of features) {
			const p = f.properties;
			if (p.sexe_victime === 'Masculin') {
				male += 1;
				sexKnown += 1;
			} else if (p.sexe_victime === 'Féminin') {
				female += 1;
				sexKnown += 1;
			}
			if (Number.isFinite(p.age) && p.age != null && p.age >= 0) {
				ageKnown += 1;
				ageSum += p.age;
				ageList.push(p.age);
			}
			if (p.intersection) {
				interKnown += 1;
				if (p.at_intersection) inter += 1;
			}
			if (p.collision_shape) {
				lateralKnown += 1;
				if (p.lateral) lateral += 1;
			}
		}

		ageList.sort((a, b) => a - b);
		const median = ageList.length
			? ageList.length % 2
				? ageList[(ageList.length - 1) / 2]
				: (ageList[ageList.length / 2 - 1] + ageList[ageList.length / 2]) / 2
			: null;

		return {
			total,
			pctMale: sexKnown ? (male / sexKnown) * 100 : NaN,
			pctFemale: sexKnown ? (female / sexKnown) * 100 : NaN,
			meanAge: ageKnown ? ageSum / ageKnown : null,
			medianAge: median,
			pctIntersection: interKnown ? (inter / interKnown) * 100 : NaN,
			pctLateral: lateralKnown ? (lateral / lateralKnown) * 100 : NaN,
			topManoeuvres: topCounts(features, 'manoeuvre', 3),
			topChocs: topCounts(features, 'choc', 3),
		};
	});
</script>

{#if stats}
	<div>
		<div class="m-2 flex items-center justify-end">
			<span class="text-[10px] text-gray-400 tabular-nums">
				sur {numFmt.format(stats.total)}
			</span>
		</div>

		<dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
			<div>
				<dt class="text-[10px] tracking-wide text-gray-500 uppercase">Sexe</dt>
				<dd class="mt-0.5 flex items-baseline gap-1.5 tabular-nums">
					<span class="font-semibold text-gray-900">{pctFmt(stats.pctMale)}</span>
					<span class="text-[10px] text-gray-500">M</span>
					<span class="text-gray-300">·</span>
					<span class="font-semibold text-gray-700">{pctFmt(stats.pctFemale)}</span>
					<span class="text-[10px] text-gray-500">F</span>
				</dd>
			</div>

			<div>
				<dt class="text-[10px] tracking-wide text-gray-500 uppercase">Âge</dt>
				<dd class="mt-0.5 tabular-nums">
					{#if stats.meanAge != null}
						<span class="font-semibold text-gray-900">{stats.meanAge.toFixed(0)}</span>
						<span class="text-[10px] text-gray-500">ans en moyenne</span>
					{:else}
						<span class="text-gray-400">–</span>
					{/if}
				</dd>
			</div>

			<div>
				<dt class="text-[10px] tracking-wide text-gray-500 uppercase">À un carrefour</dt>
				<dd class="mt-0.5 tabular-nums">
					<span class="font-semibold text-gray-900">{pctFmt(stats.pctIntersection)}</span>
				</dd>
			</div>

			<div>
				<dt class="text-[10px] tracking-wide text-gray-500 uppercase">Choc latéral</dt>
				<dd class="mt-0.5 tabular-nums">
					<span class="font-semibold text-gray-900">{pctFmt(stats.pctLateral)}</span>
				</dd>
			</div>
		</dl>

		<div class="mt-3">
			<p class="text-[10px] tracking-wide text-gray-500 uppercase">Manœuvres principales</p>
			<ul class="mt-1 space-y-0.5">
				{#if stats.topManoeuvres.length > 0}
					{#each stats.topManoeuvres as m (m.label)}
						<li class="flex items-baseline justify-between gap-2 text-xs">
							<span class="truncate text-gray-700" title={m.label}>{m.label}</span>
							<span class="shrink-0 text-[10px] text-gray-500 tabular-nums">
								{m.pct.toFixed(0)} %
							</span>
						</li>
					{/each}
				{:else}
					<!-- Reserve vertical space so the panel doesn't jump when the
					     filter wipes the dataset (stays at ~3 rows tall). -->
					<li class="text-xs text-gray-400">–</li>
					<li class="text-xs text-gray-300">–</li>
					<li class="text-xs text-gray-300">–</li>
				{/if}
			</ul>
		</div>
	</div>
{/if}
