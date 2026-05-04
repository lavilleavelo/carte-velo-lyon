export interface LayerInfoLink {
	label: string;
	url: string;
}

export interface LayerInfoEntry {
	description: string;
	source: string;
	sourceUrl?: string;
	links?: LayerInfoLink[];
	logos?: { src: string; alt: string; url?: string }[];
}

export const layerInfo: Record<string, LayerInfoEntry> = {
	'Infrastructures Cyclables': {
		description:
			'Aménagements cyclables de la Métropole de Lyon (pistes, bandes, voies vertes, etc.).',
		source: 'Métropole de Lyon (data.grandlyon.com)',
		sourceUrl:
			'https://data.grandlyon.com/portail/fr/jeux-de-donnees/amenagements-cyclables-metropole-lyon/info',
		links: [
			{
				label: 'Aménagements cyclables — data.grandlyon.com',
				url: 'https://data.grandlyon.com/portail/fr/jeux-de-donnees/amenagements-cyclables-metropole-lyon/info',
			},
		],
	},
	Stationnements: {
		description:
			'Stationnements vélo : arceaux, arceaux couverts, box sécurisés, vélostations et parkings en ouvrage.',
		source: 'Métropole de Lyon (data.grandlyon.com)',
		sourceUrl:
			'https://data.grandlyon.com/portail/fr/jeux-de-donnees/stationnements-velo-metropole-lyon/info',
		links: [
			{
				label: 'Stationnements vélo — data.grandlyon.com',
				url: 'https://data.grandlyon.com/portail/fr/jeux-de-donnees/stationnements-velo-metropole-lyon/info',
			},
		],
	},
	Vélov: {
		description: "Stations Vélo'v avec disponibilité en temps réel.",
		source: 'Métropole de Lyon / JCDecaux',
		sourceUrl: 'https://data.grandlyon.com',
		links: [
			{
				label: "Stations Vélo'v — data.grandlyon.com",
				url: 'https://data.grandlyon.com/portail/fr/jeux-de-donnees/stations-velo-v-metropole-lyon/info',
			},
		],
	},
	'Voies Lyonnaises': {
		description:
			'Tracés des Voies Lyonnaises réalisées et en projet. Tracés réalisés par des bénévoles de la Ville à Vélo. Source : Cyclopolis.',
		source: 'La Ville à Vélo / Cyclopolis',
		sourceUrl: 'https://github.com/lavilleavelo/cyclopolis',
	},
	Itinéraires: {
		description:
			"Itinéraires cyclables (EuroVelo, véloroutes, voies vertes, boucles locales) qui passent par la Métropole de Lyon ou s'y connectent.",
		source: 'Sources disponibles sur chaque fiche',
		sourceUrl: '/itineraires',
		links: [],
	},
	'Infrastructures Cyclables (OSM)': {
		description:
			'Aménagements cyclables issus d’OpenStreetMap (highway=cycleway, cycleway:lane/track, bicycle_road, etc.). © les contributeurs OpenStreetMap, licence ODbL.',
		source: 'OpenStreetMap contributors (Overpass API)',
		sourceUrl: 'https://overpass-turbo.eu/',
		links: [],
	},
	'Voies Lyonnaises (OSM)': {
		description:
			'Voies Lyonnaises telles que cartographiées dans OpenStreetMap (tag cycle_network). © les contributeurs OpenStreetMap. Les données sont disponibles sous la licence ODbL.',
		source: 'OpenStreetMap contributors (Overpass API)',
		sourceUrl: 'https://cyclopolis.fr/blog/voies-lyonnaises-open-street-map',
		links: [
			{
				label: 'Article Cyclopolis : VL et OpenStreetMap',
				url: 'https://cyclopolis.fr/blog/voies-lyonnaises-open-street-map',
			},
			{
				label: 'Voir la requête dans Overpass Turbo',
				url: 'https://overpass-turbo.eu/?Q=[out%3Ajson][timeout%3A25]%3B%0A(%0A%09nwr[%22cycle_network%22%20%3D%20%22Les%20Voies%20Lyonnaises%22]({{bbox}})%3B%0A)%3B%0Aout%20geom%3B%0A&C=45.765487%3B4.888231%3B12&R=',
			},
		],
	},
	'Métro / Tram': {
		description: 'Lignes de métro, tramway et tram-bus du réseau TCL.',
		source: 'Sytral / Métropole de Lyon',
		sourceUrl: 'https://data.grandlyon.com',
		links: [
			{
				label: 'Lignes de métro — data.grandlyon.com',
				url: 'https://data.grandlyon.com/portail/fr/jeux-de-donnees/lignes-metro-reseau-transports-commun-lyonnais/info',
			},
			{
				label: 'Lignes de tramway — data.grandlyon.com',
				url: 'https://data.grandlyon.com/portail/fr/jeux-de-donnees/lignes-tramway-reseau-transports-commun-lyonnais/info',
			},
		],
	},
	Bus: {
		description: 'Lignes de tram-bus (BHNS) et bus du réseau TCL.',
		source: 'Sytral / Métropole de Lyon',
		sourceUrl: 'https://data.grandlyon.com',
		links: [
			{
				label: 'Lignes de bus — data.grandlyon.com',
				url: 'https://data.grandlyon.com/portail/fr/jeux-de-donnees/lignes-bus-reseau-transports-commun-lyonnais/info',
			},
		],
	},
	'Aires de service': {
		description: 'Pompes à vélo en libre-service, bornes fontaine à eau et toilettes publiques.',
		source: 'Métropole de Lyon (data.grandlyon.com)',
		sourceUrl: 'https://data.grandlyon.com',
		links: [
			{
				label: "Stations Vélo'v et pompes — data.grandlyon.com",
				url: 'https://data.grandlyon.com/portail/fr/jeux-de-donnees/stations-velo-v-et-pompes-a-velo-metropole-lyon/info',
			},
			{
				label: 'Bornes fontaine à eau — data.grandlyon.com',
				url: 'https://data.grandlyon.com/portail/fr/jeux-de-donnees/bornes-fontaine-a-eau-metropole-lyon/info',
			},
			{
				label: 'Toilettes publiques — OpenStreetMap',
				url: 'https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dtoilets',
			},
		],
	},
	Communes: {
		description: 'Limites administratives des communes de la Métropole de Lyon.',
		source: 'Métropole de Lyon (data.grandlyon.com)',
		sourceUrl: 'https://data.grandlyon.com',
		links: [
			{
				label: 'Communes — data.grandlyon.com',
				url: 'https://data.grandlyon.com/portail/fr/jeux-de-donnees/communes-metropole-lyon/info',
			},
		],
	},
	Compteurs: {
		description: 'Compteurs de passages vélo et voiture avec historique mensuel.',
		source: 'La Ville à Vélo / Cyclopolis',
		sourceUrl: 'https://cyclopolis.fr/compteurs',
		links: [
			{
				label: 'Compteurs vélo — data.eco-counter.com',
				url: 'https://data.eco-counter.com/ParcPublic/?id=3902#',
			},
			{
				label: 'Compteurs voiture — avatar.cerema.fr',
				url: 'https://avatar.cerema.fr',
			},
		],
		logos: [
			{
				src: 'https://cyclopolis.lavilleavelo.org/avatar_cerema.png',
				alt: 'CEREMA Avatar',
				url: 'https://avatar.cerema.fr',
			},
		],
	},
	Local: {
		description:
			"Les commerces et services autour du vélo : véloécoles, ateliers d'autoréparation, revendeurs, loueurs, taxivélos, cafés vélo et artisans.",
		source: 'OpenStreetMap contributors (Overpass API)',
		sourceUrl: 'https://wiki.openstreetmap.org/wiki/FR:Tag:shop%3Dbicycle',
		links: [
			{
				label: 'Magasins de vélo — OpenStreetMap Wiki',
				url: 'https://wiki.openstreetmap.org/wiki/FR:Tag:shop%3Dbicycle',
			},
			{
				label: 'Stations de réparation — OpenStreetMap Wiki',
				url: 'https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dbicycle_repair_station',
			},
		],
	},
	'Confort & Repos': {
		description: 'Bancs, tables de pique-nique et abris le long des itinéraires cyclables.',
		source: 'OpenStreetMap contributors (Overpass API)',
		sourceUrl: 'https://wiki.openstreetmap.org/wiki/FR:Tag:amenity%3Dbench',
	},
	'Santé & Sécurité': {
		description: 'Pharmacies, défibrillateurs et douches accessibles au public.',
		source: 'OpenStreetMap contributors (Overpass API)',
		sourceUrl: 'https://wiki.openstreetmap.org/wiki/FR:Tag:amenity%3Dpharmacy',
		links: [
			{
				label: 'Pharmacies — OpenStreetMap Wiki',
				url: 'https://wiki.openstreetmap.org/wiki/FR:Tag:amenity%3Dpharmacy',
			},
			{
				label: 'Défibrillateurs — OpenStreetMap Wiki',
				url: 'https://wiki.openstreetmap.org/wiki/FR:Tag:emergency%3Ddefibrillator',
			},
		],
	},
	'Établissements scolaires': {
		description: 'Écoles maternelles, élémentaires, collèges et lycées de la Métropole de Lyon.',
		source: 'OpenStreetMap contributors (Overpass API)',
		sourceUrl: 'https://wiki.openstreetmap.org/wiki/FR:Tag:amenity%3Dschool',
		links: [
			{
				label: 'Écoles — OpenStreetMap Wiki',
				url: 'https://wiki.openstreetmap.org/wiki/FR:Tag:amenity%3Dschool',
			},
		],
	},
	Projets: {
		description:
			'Réseau cible cyclable 2040 (non-officiel, réalisé par des bénévoles de La Ville à Vélo). Tracés des Voies Lyonnaises en travaux ou prévues (Cyclopolis)',
		source: 'La Ville à Vélo / Cyclopolis',
		sourceUrl: 'https://cyclopolis.fr',
	},
};
