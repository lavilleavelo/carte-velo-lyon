export type CyclewayFilterOption = {
	id: string;
	label: string;
	color: string;
};

export type CyclewayFilterOptions = {
	reseau: CyclewayFilterOption[];
	typeamenagement: CyclewayFilterOption[];
	localisation: CyclewayFilterOption[];
};

export const cyclewayFilterOptions: CyclewayFilterOptions = {
	reseau: [
		{ id: 'Réseau structurant et super structurant', label: 'Structurant', color: '#484848' },
		{ id: 'Réseau secondaire', label: 'Secondaire', color: '#a2a2a2' },
		{ id: 'Réseau de desserte', label: 'Desserte', color: '#5e5e5e' },
	],
	typeamenagement: [
		{ id: 'Piste Cyclable', label: 'Piste Cyclable', color: '#22c55e' },
		{ id: 'Voie verte', label: 'Voie verte', color: '#16a34a' },
		{ id: 'Bande Cyclable', label: 'Bande Cyclable', color: '#84cc16' },
		{ id: 'Couloir bus vélo élargi', label: 'Couloir bus vélo élargi', color: '#eab308' },
		{
			id: 'Couloir bus vélo non élargi',
			label: 'Couloir bus vélo non élargi',
			color: '#f59e0b',
		},
		{ id: 'Double sens cyclable', label: 'Double sens cyclable', color: '#06b6d4' },
		{ id: 'Goulotte ou rampe', label: 'Goulotte ou rampe', color: '#ec4899' },
	],
	localisation: [
		{ id: 'Sur chaussée', label: 'Sur chaussée', color: '#64748b' },
		{ id: 'Sur trottoir', label: 'Sur trottoir', color: '#94a3b8' },
		{ id: 'Sans objet', label: 'Sans objet', color: '#cbd5e1' },
	],
};
