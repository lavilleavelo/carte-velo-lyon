export const SITE = {
	url: 'https://carte.lavilleavelo.org',
	name: 'Carte vélo Lyon',
	siteName: 'Carte vélo – Métropole de Lyon',
	title: 'Carte des aménagements cyclables dans la Métropole de Lyon',
	description:
		"Carte interactive des aménagements cyclables, Voies Lyonnaises, stationnements vélo, stations Vélo'v, pompes et fontaines de la Métropole de Lyon.",
	locale: 'fr_FR',
	lang: 'fr',
	geoRegion: 'FR-69',
	geoPlacename: 'Lyon, France',
	author: 'La Ville à Vélo',
	ogImagePath: '/og-image.png',
	ogImageAlt: 'Carte des aménagements cyclables dans la Métropole de Lyon',
	ogImageWidth: 1200,
	ogImageHeight: 630,
	umami: {
		websiteID: 'dabc64f7-baef-4c8a-83bf-2597c23b892b',
		srcURL: 'https://allo-mamie.nimbus.lavilleavelo.org/script.js',
		domain: 'carte.lavilleavelo.org',
	},
	socials: {
		bluesky: 'https://bsky.app/profile/lavilleavelo.bsky.social',
		mastodon: 'https://masto.bike/@lavilleavelo',
		facebook: 'https://www.facebook.com/lavilleavelolyon/',
		linkedin: 'https://www.linkedin.com/company/la-ville-%C3%A0-v%C3%A9lo',
		instagram: 'https://www.instagram.com/lavilleavelolyon',
		website: 'https://lavilleavelo.org',
	},
} as const;

export type Seo = {
	title?: string;
	description?: string;
	robots?: string;
	image?: string;
};

export function absoluteUrl(pathname: string): string {
	return `${SITE.url}${pathname}`;
}
