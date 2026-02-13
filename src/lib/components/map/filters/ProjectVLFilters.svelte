<script lang="ts">
	type ProjectVLSubLayer = {
		id: string;
		label: string;
		statuses: readonly string[];
		customStyle: {
			color: string;
			dashArray: readonly number[];
		};
	};

	let {
		subLayers,
		selectedStatuses,
		toggleStatus,
	}: {
		subLayers: readonly ProjectVLSubLayer[];
		selectedStatuses: string[];
		toggleStatus: (id: string) => void;
	} = $props();

	function getStrokeDashArray(dashArray: readonly number[]) {
		if (dashArray.length === 0) return 'none';
		return dashArray.join(' ');
	}
</script>

<div class="mt-4 flex flex-col gap-2">
	<div class="text-sm font-semibold text-gray-700">Statut du projet</div>
	{#each subLayers as layer}
		<button
			class="flex items-center gap-3 rounded-md px-2 py-1 hover:bg-gray-50"
			onclick={() => toggleStatus(layer.id)}
		>
			<div class="relative flex h-4 w-12 items-center justify-center">
				<div
					class="absolute h-[5px] w-full rounded-full bg-white opacity-80 shadow-sm ring-1 ring-black/5"
				></div>
				<svg
					width="100%"
					height="4"
					class="absolute z-10"
					viewBox="0 0 48 4"
					preserveAspectRatio="none"
				>
					<line
						x1="0"
						y1="2"
						x2="48"
						y2="2"
						stroke={layer.customStyle.color}
						stroke-width="3"
						stroke-dasharray={getStrokeDashArray(layer.customStyle.dashArray)}
					/>
				</svg>
			</div>

			<span
				class="text-sm {selectedStatuses.includes(layer.id)
					? 'font-medium text-gray-900'
					: 'text-gray-500'}"
			>
				{layer.label}
			</span>

			<input
				type="checkbox"
				checked={selectedStatuses.includes(layer.id)}
				class="ml-auto h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
			/>
		</button>
	{/each}
</div>
