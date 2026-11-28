import type { PageServerLoad } from './$types';
import { grenetteLines } from '$lib/server/tcl/collector';
import { lineColors } from '$lib/server/tcl/gtfs';
import { liveVehicles } from '$lib/server/tcl/live';
import { replayIndex } from '$lib/server/tcl/replay';
import { lineGroups, parseSelection } from '$lib/server/tcl/report';

export const prerender = false;

export const load: PageServerLoad = async ({ setHeaders, url }) => {
	setHeaders({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
	const grenette = grenetteLines();
	const requested = url.searchParams.getAll('ligne');
	const selection = requested.length === 0 ? null : parseSelection(requested, grenette);
	return {
		colors: await lineColors(),
		replay: await replayIndex(),
		groups: lineGroups(),
		grenette,
		lines: selection?.lines ?? null,
		label: selection?.label ?? 'Tout le réseau',
		live: liveVehicles(),
		seo: {
			title: 'Carte des bus et trams TCL en direct',
			description:
				'Positions des bus et trams TCL en direct et rejeu des journées passées, à partir des données temps réel du Grand Lyon.',
			robots: 'noindex, nofollow',
		},
	};
};
