<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		id: string;
		title: string;
		intro?: Snippet;
		explain?: Snippet;
		explainTitle?: string;
		children: Snippet;
	}

	let {
		id,
		title,
		intro,
		explain,
		explainTitle = 'Comment lire ces chiffres',
		children,
	}: Props = $props();
</script>

<section {id} class="mb-14 scroll-mt-40">
	<h2 class="text-xl font-bold text-gray-900 md:text-2xl">{title}</h2>
	{#if intro}
		<div class="mt-2 max-w-3xl text-[15px] leading-relaxed text-gray-700">
			{@render intro()}
		</div>
	{/if}
	<div class="mt-5">
		{@render children()}
	</div>
	{#if explain}
		<details class="group mt-4 max-w-3xl rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
			<summary
				class="cursor-pointer list-none text-sm font-medium text-gray-800 group-open:mb-2 marker:hidden"
			>
				<span class="mr-1 inline-block transition-transform group-open:rotate-90">›</span>
				{explainTitle}
			</summary>
			<div class="space-y-2 text-sm leading-relaxed text-gray-700">
				{@render explain()}
			</div>
		</details>
	{/if}
</section>
