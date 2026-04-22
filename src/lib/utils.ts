import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

const VELOSCORE_BASE_URL = 'https://veloscore.lavilleavelo.org';

function veloscoreSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^Ééèôa-zA-Z0-9-]/g, '-')
		.replace(/-/g, ' ')
		.trim();
}

export function getVeloscoreUrl(communeName: string): string {
	return `${VELOSCORE_BASE_URL}/${encodeURIComponent(veloscoreSlug(communeName))}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
