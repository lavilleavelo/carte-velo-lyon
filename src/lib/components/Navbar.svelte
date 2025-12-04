<script lang="ts">
	let { currentPath = '/', communes = [] } = $props<{ currentPath?: string; communes?: any[] }>();
</script>

<nav class="text-brand-navy shadow-lg">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 items-center justify-between">
			<div class="flex items-center">
				<a
					href="/"
					class="flex items-center gap-3 text-xl font-bold transition-colors hover:text-brand-teal"
				>
					Carte Velo Lyon
				</a>
			</div>
			<div class="flex items-center gap-6">
				<div class="hidden items-center gap-6 md:flex">
					<a
						href="/carte"
						class="text-sm font-medium transition-colors hover:text-brand-teal {currentPath === '/'
							? 'pb-1 text-brand-navy'
							: 'text-brand-navy'}"
					>
						carte
					</a>
				</div>
			</div>
		</div>
	</div>
</nav>
