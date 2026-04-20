<script lang="ts">
	interface Toggle {
		id: string;
		label: string;
	}

	let { layers = $bindable(), toggles }: { layers: string[]; toggles: Toggle[] } = $props();

	function toggle(id: string, on: boolean) {
		const set = new Set(layers);
		if (on) set.add(id);
		else set.delete(id);
		layers = [...set];
	}
</script>

<div class="rounded-lg bg-white p-4 shadow">
	<h2 class="mb-3 text-sm font-semibold text-brand-navy uppercase">Calques</h2>
	<ul class="flex flex-wrap gap-x-5 gap-y-2">
		{#each toggles as t (t.id)}
			<li>
				<label class="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
					<input
						type="checkbox"
						class="h-4 w-4 accent-brand-navy"
						checked={layers.includes(t.id)}
						onchange={(e) => toggle(t.id, (e.target as HTMLInputElement).checked)}
					/>
					{t.label}
				</label>
			</li>
		{/each}
	</ul>
</div>
