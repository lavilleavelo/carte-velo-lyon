import communesIndex from '$lib/data/communes/_index.json';
import { SITE } from '$lib/config/site';
import { getAllFiches } from '$lib/content/fiches';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = async () => {
	const lastmod = new Date().toISOString().split('T')[0];

	const staticPages = [
		{ path: '', priority: '1.0' },
		{ path: '/communes', priority: '0.9' },
		{ path: '/communes/lyon', priority: '0.9' },
		{ path: '/ville-30', priority: '0.8' },
		{ path: '/accidents', priority: '0.7' },
		{ path: '/velov', priority: '0.7' },
		{ path: '/compteurs', priority: '0.7' },
		{ path: '/a-propos', priority: '0.6' },
		{ path: '/mentions-legales', priority: '0.3' },
	];

	const communePages = communesIndex.map((c) => ({
		path: `/communes/${c.slug}`,
		priority: '0.8',
	}));

	const fichePages = getAllFiches().map((f) => ({
		path: `/fiches/${f.slug}`,
		priority: '0.7',
	}));

	const allPages = [...staticPages, ...communePages, ...fichePages];

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
	.map(
		(page) => `  <url>
    <loc>${SITE.url}${page.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${page.priority}</priority>
  </url>`,
	)
	.join('\n')}
</urlset>`;

	return new Response(sitemap, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'max-age=3600',
		},
	});
};
