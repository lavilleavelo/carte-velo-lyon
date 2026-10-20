// A0 map built by print/build_map.py (print-map branch): a light version to read on screen,
// a vector one to print.
const version = '2026-10-20';

export const printMaps: {
	kind: 'web' | 'print';
	href: string;
	label: string;
	use: string;
	detail: string;
}[] = [
	{
		kind: 'web',
		href: `https://cyclopolis.lavilleavelo.org/carte-velo-lyon/carte-velo-lyon-A0-web.pdf?v=${version}`,
		label: 'Version web',
		use: 'Pour consulter sur écran',
		detail: 'légère, 10 Mo',
	},
	{
		kind: 'print',
		href: `https://cyclopolis.lavilleavelo.org/carte-velo-lyon/carte-velo-lyon-A0.pdf?v=${version}`,
		label: 'Version impression',
		use: 'Pour imprimer en grand format',
		detail: 'vectorielle, 61 Mo',
	},
];
