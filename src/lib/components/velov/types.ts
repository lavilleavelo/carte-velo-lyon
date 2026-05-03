export type Station = {
	idstation: number;
	nom: string;
	commune: string;
	adresse: string;
	lng: number;
	lat: number;
	capacity: number;
	bikes: number;
	mech: number;
	elec: number;
	stands: number;
	status: 'OPEN' | 'CLOSED' | string;
};

export type StationStatusFilter = 'all' | 'open' | 'closed';
export type StationSortKey = 'bikes' | 'elec' | 'mech' | 'stands' | 'capacity' | 'name';
