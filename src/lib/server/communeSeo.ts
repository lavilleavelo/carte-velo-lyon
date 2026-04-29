const numberFormatter = new Intl.NumberFormat('fr-FR');
const oneDecimalFormatter = new Intl.NumberFormat('fr-FR', {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

function joinFr(items: readonly string[]): string {
	if (items.length <= 1) {
		return items.join('');
	}

	return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

interface BikeSeoArgs {
	name: string;
	osmCyclewaysKm: number | null;
	parkingPlaces: number | null;
	trailingItemsWithData: readonly string[];
	fallbackItemsWithoutData: readonly string[];
	suffix?: string;
}

export function buildBikeMapSeoDescription({
	name,
	osmCyclewaysKm,
	parkingPlaces,
	trailingItemsWithData,
	fallbackItemsWithoutData,
	suffix,
}: BikeSeoArgs): string {
	let items: string[];

	if (osmCyclewaysKm && osmCyclewaysKm > 0) {
		items = [`${oneDecimalFormatter.format(osmCyclewaysKm)} km d'aménagements`];
		if (parkingPlaces && parkingPlaces > 0) {
			items.push(`${numberFormatter.format(parkingPlaces)} places de stationnement`);
		}
		items.push(...trailingItemsWithData);
	} else {
		items = [...fallbackItemsWithoutData];
	}

	const tail = suffix ? ` ${suffix}` : '';
	return `Carte interactive des infrastructures cyclables à ${name} : ${joinFr(items)}${tail}.`;
}
