import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		port: process.env.PORT ? Number(process.env.PORT) : undefined,
	},
	build: {
		sourcemap: true,
	},
	optimizeDeps: {
		exclude: ['svelte-maplibre-gl'],
		include: ['maplibre-gl'],
	},
	ssr: {
		noExternal: ['layerchart'],
	},
});
