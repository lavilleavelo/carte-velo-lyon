export interface CyclableFeature {
	properties: {
		nom?: string;
		commune1?: string;
		insee1?: string;
		commune2?: string | null;
		insee2?: string | null;
		reseau?: string;
		financementac?: string;
		typeamenagement?: string;
		typeamenagement2?: string | null;
		positionnement?: string;
		senscirculation?: string;
		environnement?: string;
		localisation?: string;
		typologiepiste?: string;
		revetementpiste?: string;
		domanialite?: string;
		reglementation?: string;
		zonecirculationapaisee?: string | null;
		anneelivraison?: number;
		longueur?: number;
		observation?: string | null;
		validite?: string;
		gid?: number;
	};
}
