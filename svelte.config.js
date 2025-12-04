import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),

		prerender: {
			handleHttpError: ({ path, referrer, message }) => {
				console.log(path, referrer, message);
			},
			handleMissingId: 'ignore'
		}
	}
};

export default config;
