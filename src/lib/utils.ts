import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

export const matchTypeWidth = [
	'match',
	['get', 'typeamenagement'],
	...Object.entries({
		'Piste Cyclable': 3.5,
		'Voie verte': 2.5,
		'Couloir bus vélo élargi': 2,
		'Bande Cyclable': 1,
		'Double sens cyclable': 1,
		'Couloir bus vélo non élargi': 1,
		'Chaussée à voie centrale banalisée (CVCB)': 1,
		'Goulotte ou rampe': 0.5,
	})
		.map(([type, width]) => [type, width])
		.flat(),
	0.5,
] as any;

export const matchTypeColorReseau = [
	'match',
	['get', 'reseau'],
	'Réseau secondaire',
	'#a2a2a2',
	'Réseau de desserte',
	'#5e5e5e',
	'Réseau structurant et super structurant',
	'#484848',
	'#9ca3af',
] as any;
