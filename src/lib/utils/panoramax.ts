export async function searchPanoramaxPhoto(coordinates: [number, number]): Promise<{
	sequence: string;
	picture: string;
	linkSelf: string;
	thumbPicture: string;
	sdPicture: string;
	hdPicture: string;
	datetime: string | null;
	coordinates: [number, number];
} | null> {
	const [lon, lat] = coordinates;
	const offset = 0.0004; // approximately 50-60 meters
	const bbox = [lon - offset, lat - offset, lon + offset, lat + offset].join(',');

	const response = await fetch(`https://api.panoramax.xyz/api/search?limit=10&bbox=${bbox}`);

	if (!response.ok) {
		throw new Error('Erreur lors de la recherche de photo Panoramax');
	}

	const data = await response.json();

	if (data.features && data.features.length > 0) {
		const equirectangular = data.features.find(
			(f: any) => f.properties?.['pers:interior_orientation']?.field_of_view === 360,
		);
		const feature = equirectangular || data.features[0];

		return {
			datetime: feature.properties.datetimetz ?? feature.properties.datetime ?? null,
			thumbPicture: feature.assets.thumb.href,
			sdPicture: feature.assets.sd.href,
			hdPicture: feature.assets.hd.href,
			linkSelf: feature.assets.thumb.href,
			sequence: feature.collection,
			picture: feature.id,
			coordinates: feature.geometry.coordinates,
		};
	}

	throw new Error('Pas de photo Panoramax trouvée à cet endroit');
}
