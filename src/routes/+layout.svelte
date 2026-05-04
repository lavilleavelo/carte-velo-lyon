<script lang="ts">
	import '../app.css';
	import { onNavigate } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { UmamiAnalytics } from '@lukulent/svelte-umami';
	import { onMount } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { SITE } from '$lib/config/site';
	let { children }: { children: any } = $props();

	const seoTitle = $derived(page.data.seo?.title ?? SITE.title);
	const seoDescription = $derived(page.data.seo?.description ?? SITE.description);
	const seoRobots = $derived(page.data.seo?.robots ?? 'index, follow');
	const canonical = $derived(`${SITE.url}${page.url.pathname}`);
	const ogImage = $derived(page.data.seo?.image ?? `${SITE.url}${SITE.ogImagePath}`);
	const ogImageAlt = $derived(page.data.seo?.imageAlt ?? SITE.ogImageAlt);

	const showFooter = $derived(page.url.pathname !== '/');

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

	onMount(() => {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js').catch(() => {
				// ignore
			});
		}
	});
</script>

<svelte:head>
	<title>{seoTitle}</title>
	<meta name="description" content={seoDescription} />
	<link rel="canonical" href={canonical} />
	<meta name="robots" content={seoRobots} />

	<meta name="author" content={SITE.author} />
	<meta name="geo.region" content={SITE.geoRegion} />
	<meta name="geo.placename" content={SITE.geoPlacename} />

	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonical} />
	<meta property="og:locale" content={SITE.locale} />
	<meta property="og:site_name" content={SITE.siteName} />
	<meta property="og:title" content={seoTitle} />
	<meta property="og:description" content={seoDescription} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:width" content={String(SITE.ogImageWidth)} />
	<meta property="og:image:height" content={String(SITE.ogImageHeight)} />
	<meta property="og:image:alt" content={ogImageAlt} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={seoTitle} />
	<meta name="twitter:description" content={seoDescription} />
	<meta name="twitter:image" content={ogImage} />

	{@html `<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "WebSite",
			"name": "${SITE.siteName}",
			"alternateName": "${SITE.name}",
			"url": "${SITE.url}",
			"description": "${SITE.description}",
			"publisher": {
				"@type": "Organization",
				"name": "${SITE.author}",
				"url": "${SITE.socials.website}",
				"logo": {
					"@type": "ImageObject",
					"url": "${SITE.url}${SITE.ogImagePath}"
				},
				"sameAs": [
					"${SITE.socials.mastodon}",
					"${SITE.socials.bluesky}",
					"${SITE.socials.linkedin}",
					"${SITE.socials.instagram}",
					"${SITE.socials.facebook}"
				]
			},
			"inLanguage": "fr-FR"
		}
	</script>`}

	<link rel="preconnect" href="https://tiles.openfreemap.org" crossorigin="anonymous" />
	<link rel="preconnect" href="https://openmaptiles.geo.data.gouv.fr" crossorigin="anonymous" />
	<link rel="preconnect" href="https://data.grandlyon.com" crossorigin="anonymous" />
</svelte:head>

<UmamiAnalytics
	websiteID={SITE.umami.websiteID}
	srcURL={SITE.umami.srcURL}
	configuration={{ 'data-domains': SITE.umami.domain }}
/>

<QueryClientProvider client={queryClient}>
	{#if navigating}
		<div class="fixed top-0 right-0 left-0 z-50 h-1">
			<div class="navigation-progress h-full bg-brand-navy shadow-lg"></div>
		</div>
	{/if}

	<div class="flex min-h-screen flex-col">
		<Navbar currentPath={page.url.pathname} compact={page.url.pathname === '/'} />
		<main
			class="mx-auto w-full flex-1 px-4 sm:px-6 lg:px-8 {page.url.pathname === '/accidents' ||
			page.url.pathname === '/velov' ||
			page.url.pathname === '/'
				? 'max-w-none px-0! sm:px-0! lg:px-0!'
				: 'max-w-7xl'}"
		>
			{@render children()}
		</main>
		{#if showFooter}
			<div class="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
				<Footer />
			</div>
		{/if}
	</div>
</QueryClientProvider>
