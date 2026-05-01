<script lang="ts">
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';

	let { label = 'id', value }: { label?: string; value: string | number | null | undefined } =
		$props();

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		if (value === null || value === undefined) return;
		try {
			await navigator.clipboard.writeText(String(value));
			copied = true;
			clearTimeout(timer);
			timer = setTimeout(() => (copied = false), 1500);
		} catch {
			// ignore
		}
	}
</script>

{#if value !== null && value !== undefined && value !== ''}
	<button
		type="button"
		onclick={copy}
		title="Copier l'identifiant"
		class="inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] tracking-tight text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
	>
		<span>{label}: {value}</span>
		{#if copied}
			<Check size={10} class="text-green-500" />
		{:else}
			<Copy size={10} class="opacity-50" />
		{/if}
	</button>
{/if}
