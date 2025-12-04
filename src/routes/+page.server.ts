// @ts-expect-error
import type { PageServerLoad, EntryGenerator } from './$types';

export const load: PageServerLoad = async () => {
	return {};
};
