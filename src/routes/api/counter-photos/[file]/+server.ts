import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import type { RequestHandler } from './$types';
import { getPhotoFile } from '$lib/server/counters/photos';

// File names are derived from the Eco-Counter URL of the photo: they never change
export const GET: RequestHandler = async ({ params }) => {
	const photo = getPhotoFile(params.file);
	if (!photo) {
		error(400, 'Invalid photo name');
	}

	try {
		return new Response(await readFile(photo.path), {
			headers: {
				'Content-Type': photo.contentType,
				'Cache-Control': 'public, max-age=31536000, immutable',
			},
		});
	} catch {
		error(404, 'Photo not found');
	}
};
