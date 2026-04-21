<script lang="ts">
	import CommandPalette from './CommandPalette.svelte';

	let { currentPath = '/' }: { currentPath?: string } = $props();

	const links: { href: string; label: string; match: (p: string) => boolean }[] = [
		{ href: '/', label: 'Carte', match: (p) => p === '/' },
		{
			href: '/communes',
			label: 'Communes',
			match: (p) => p === '/communes' || p.startsWith('/communes/'),
		},
		{ href: '/a-propos', label: 'À propos', match: (p) => p.startsWith('/a-propos') },
	];
</script>

<nav class="border-b border-gray-100 bg-white/95 text-brand-navy backdrop-blur-sm">
	<div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
		<a
			href="/"
			class="flex items-center gap-3 text-lg font-bold tracking-tight transition-colors hover:text-brand-teal"
			aria-label="Retour à la carte"
		>
			Carte Velo Lyon
		</a>

		<div class="flex items-center gap-1 md:gap-4">
			<div class="hidden items-center gap-1 md:flex">
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
			<CommandPalette />
		</div>
	</div>
</nav>
