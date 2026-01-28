export interface ManualParkingConfig {
	type: 'arceaux' | 'arceaux-couverts' | 'box' | 'lpa-court' | 'longue-duree' | 'velostation' | 'velov';
	capacite?: number;
	nom?: string;
    gestionnaire?: string;
    url?: string;
}


export const manualParkingData: Record<string, ManualParkingConfig> = {};

