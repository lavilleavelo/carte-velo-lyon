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
	'Transports en commun': {
		description: 'Lignes de métro, tramway, tram-bus et bus du réseau TCL.',
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
			{
				label: 'Lignes de bus — data.grandlyon.com',
				url: 'https://data.grandlyon.com/portail/fr/jeux-de-donnees/lignes-bus-reseau-transports-commun-lyonnais/info',
			},
		],
	},
	'Aires de service': {
		description: 'Pompes à vélo en libre-service et bornes fontaine à eau.',
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
	Projets: {
		description:
			'Réseau cible cyclable 2040 (non-officiel, réalisé par des bénévoles de La Ville à Vélo). Tracés des Voies Lyonnaises en travaux ou prévues (Cyclopolis)',
		source: 'La Ville à Vélo / Cyclopolis',
		sourceUrl: 'https://cyclopolis.fr',
	},
};
