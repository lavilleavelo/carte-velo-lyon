import type { PageServerLoad } from './$types';
import { buildTclReport } from '$lib/server/tcl/report';

export const prerender = false;

export const load: PageServerLoad = async ({ setHeaders, url }) => {
	setHeaders({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
	const report = await buildTclReport(url.searchParams);
	return {
		report,
		seo: {
			title: `Suivi des retards TCL : ${report.selection.label}`,
			description:
				'Retards des bus et trams TCL mesurés à partir des données temps réel, et effet de la réouverture de la rue Grenette aux voitures.',
			robots: 'noindex, nofollow',
		},
	};
};
