<script lang="ts">
	let {
		targetNetworkHorizons,
		toggleHorizon,
	}: {
		targetNetworkHorizons: string[];
		toggleHorizon: (value: string) => void;
	} = $props();

	const options = [
		{ id: '2030', label: 'Horizon 2030', color: '#db2777' },
		{ id: '2035', label: 'Horizon 2035', color: '#9333ea' },
		{ id: '2040', label: 'Horizon 2040', color: '#2563eb' },
	];
</script>

<div class="mt-2 ml-6 space-y-3 border-l-2 border-gray-200 pl-3">
	<div>
		<p class="mb-2 text-xs font-semibold text-gray-600">Horizon</p>
		<div class="flex flex-wrap gap-1.5">
			{#each options as option}
				<button
					onclick={() => toggleHorizon(option.id)}
					class="rounded-full border px-2 py-1 text-xs transition-all"
					style="
						background-color: {targetNetworkHorizons.includes(option.id) ? option.color : 'white'};
						color: {targetNetworkHorizons.includes(option.id) ? 'white' : option.color};
						border-color: {option.color};
					"
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>
</div>
