<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.ico';
	import { onNavigate } from '$app/navigation';
	import { navigating } from '$app/state';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	let { children }: { children: any } = $props();

	const queryClient = new QueryClient();

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (navigation.from?.route.id === navigation.to?.route.id) return;

		return new Promise((resolve) => {
			document.startViewTransition!(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Carte des aménagements cyclables dans la Métropole de Lyon</title>
</svelte:head>

<QueryClientProvider client={queryClient}>
	{#if navigating}
		<div class="fixed top-0 right-0 left-0 z-50 h-1">
			<div class="navigation-progress h-full bg-brand-navy shadow-lg"></div>
		</div>
	{/if}

	<div class="flex min-h-screen flex-col">
		<main class="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
			{@render children()}
		</main>
	</div>
</QueryClientProvider>
