export interface VelovStationAvailability {
	number: number;
	name: string;
	address: string;
	commune: string;
	bike_stands: number;
	available_bike_stands: number;
	available_bikes: number;
	availability: string;
	availabilitycode: number;
	status: string;
	main_stands: {
		availabilities: {
			bikes: number;
			stands: number;
			mechanicalBikes: number;
			electricalBikes: number;
		};
		capacity: number;
	};
}

export interface VelovAPIResponse {
	values: VelovStationAvailability[];
}

export const VELOV_API_URL = '/api/grandlyon/velov';

export async function fetchVelovAvailability(): Promise<Map<number, VelovStationAvailability>> {
	try {
		const response = await fetch(VELOV_API_URL);
		if (!response.ok) {
			console.error('Failed to fetch Velov data');
			return new Map();
		}
		const data: VelovAPIResponse = await response.json();
		const availabilityMap = new Map<number, VelovStationAvailability>();
		data.values.forEach((station) => {
			availabilityMap.set(station.number, station);
		});
		return availabilityMap;
	} catch (error) {
		console.error('Error fetching Velov data:', error);
		return new Map();
	}
}
