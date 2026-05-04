<script lang="ts">
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import CommandPalette from './CommandPalette.svelte';
	import CommuneSearch from './CommuneSearch.svelte';

	let { currentPath = '/', compact = false }: { currentPath?: string; compact?: boolean } =
		$props();

	const links: { href: string; label: string; match: (p: string) => boolean }[] = [
		{ href: '/', label: 'Aménagements', match: (p) => p === '/' },
		{ href: '/velov', label: "Vélo'v", match: (p) => p.startsWith('/velov') },
		{ href: '/ville-30', label: 'Ville 30', match: (p) => p.startsWith('/ville-30') },
		{ href: '/accidents', label: 'Accidents', match: (p) => p.startsWith('/accidents') },
	];

	let mobileMenuOpen = $state(false);

	$effect(() => {
		currentPath;
		mobileMenuOpen = false;
	});
</script>

<nav
	class="relative z-40 border-b border-gray-100 bg-white/95 text-brand-navy backdrop-blur-sm"
	style="view-transition-name: navbar;"
>
	<div
		class="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8 {compact
			? 'h-11 md:h-16'
			: 'h-16'}"
	>
		<a
			href="/"
			class="shrink-0 font-bold tracking-tight transition-colors hover:text-brand-teal lg:text-lg {compact
				? 'text-sm md:text-base'
				: 'text-base'}"
			aria-label="Retour à la carte"
		>
			Carte Velo Lyon
		</a>

		<div class="hidden flex-1 items-center gap-1 md:flex">
			{#each links as link (link.href)}
				{@const active = link.match(currentPath)}
				<a
					href={link.href}
					class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:text-brand-teal {active
						? 'bg-gray-100 text-brand-navy'
						: 'text-gray-700'}"
				>
					{link.label}
				</a>
			{/each}
		</div>

		<div class="hidden md:block md:w-64 lg:w-72">
			<CommuneSearch />
		</div>

		<div class="ml-auto md:hidden">
			<button
				type="button"
				onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
				aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
				aria-expanded={mobileMenuOpen}
				aria-controls="mobile-menu"
				class="rounded-md p-2 text-gray-700 transition-colors hover:bg-gray-100 hover:text-brand-navy"
			>
				{#if mobileMenuOpen}
					<X class="h-5 w-5" />
				{:else}
					<Menu class="h-5 w-5" />
				{/if}
			</button>
		</div>

		<CommandPalette showTrigger={false} />
	</div>

	{#if mobileMenuOpen}
		<div
			id="mobile-menu"
			class="border-t border-gray-100 bg-white px-4 pt-3 pb-4 shadow-md md:hidden"
		>
			<CommuneSearch class="mb-3" />
			<ul class="flex flex-col gap-1">
				{#each links as link (link.href)}
					{@const active = link.match(currentPath)}
					<li>
						<a
							href={link.href}
							class="block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-50 hover:text-brand-teal {active
								? 'bg-gray-100 text-brand-navy'
								: 'text-gray-700'}"
						>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</nav>
