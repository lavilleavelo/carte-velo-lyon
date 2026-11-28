<script lang="ts">
	interface Props {
		label: string;
		value: string;
		reference?: string | null;
		delta?: string | null;
		note?: string | null;
	}

	let { label, value, reference = null, delta = null, note = null }: Props = $props();
</script>

<div class="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
	<div class="text-sm text-gray-600">{label}</div>
	<div class="mt-1 text-2xl font-semibold text-gray-900 tabular-nums md:text-3xl">{value}</div>
	{#if reference !== null}
		<div class="mt-1 text-xs text-gray-600">
			référence : <span class="tabular-nums">{reference}</span>
			{#if delta}
				<span class="ml-1 rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-800 tabular-nums"
					>{delta}</span
				>
			{/if}
		</div>
	{/if}
	{#if note}
		<div class="mt-1 text-xs text-gray-500">{note}</div>
	{/if}
</div>
