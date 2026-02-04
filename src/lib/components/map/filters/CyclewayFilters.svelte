<script lang="ts">
	type CyclewayFilterOption = {
		id: string;
		label: string;
		color: string;
	};

	type CyclewayFilterOptions = {
		reseau: CyclewayFilterOption[];
		typeamenagement: CyclewayFilterOption[];
		localisation: CyclewayFilterOption[];
	};

	let {
		filterOptions,
		toggleReseau,
		toggleType,
		toggleLocalisation,
		isReseauSelected,
		isTypeSelected,
		isLocalisationSelected,
	}: {
		filterOptions: CyclewayFilterOptions;
		toggleReseau: (value: string) => void;
		toggleType: (value: string) => void;
		toggleLocalisation: (value: string) => void;
		isReseauSelected: (value: string) => boolean;
		isTypeSelected: (value: string) => boolean;
		isLocalisationSelected: (value: string) => boolean;
	} = $props();
</script>

<div class="mt-2 ml-6 space-y-3 border-l-2 border-gray-200 pl-3">
	<div>
		<p class="mb-2 text-xs font-semibold text-gray-600">Réseau</p>
		<div class="flex flex-wrap gap-1.5">
			{#each filterOptions.reseau as option}
				<button
					onclick={() => toggleReseau(option.id)}
					class="rounded-full border px-2 py-1 text-xs transition-all"
					style="
						background-color: {isReseauSelected(option.id) ? option.color : 'white'};
						color: {isReseauSelected(option.id) ? 'white' : option.color};
						border-color: {option.color};
					"
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>

	<div>
		<p class="mb-2 text-xs font-semibold text-gray-600">Type d'aménagement</p>
		<div class="flex flex-wrap gap-1.5">
			{#each filterOptions.typeamenagement as option}
				<button
					onclick={() => toggleType(option.id)}
					class="rounded-full border px-2 py-1 text-xs transition-all"
					style="
						background-color: {isTypeSelected(option.id) ? option.color : 'white'};
						color: {isTypeSelected(option.id) ? 'white' : option.color};
						border-color: {option.color};
					"
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>

	<div>
		<p class="mb-2 text-xs font-semibold text-gray-600">Localisation</p>
		<div class="flex flex-wrap gap-1.5">
			{#each filterOptions.localisation as option}
				<button
					onclick={() => toggleLocalisation(option.id)}
					class="rounded-full border px-2 py-1 text-xs transition-all"
					style="
						background-color: {isLocalisationSelected(option.id) ? option.color : 'white'};
						color: {isLocalisationSelected(option.id) ? 'white' : option.color};
						border-color: {option.color};
					"
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>
</div>
