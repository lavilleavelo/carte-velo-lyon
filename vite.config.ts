import { readFile } from 'node:fs/promises';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, transformWithEsbuild, type Plugin } from 'vite';

const THREAD_QUERY = '?thread';

function threadSource(): Plugin {
	return {
		name: 'thread-source',
		enforce: 'pre',
		async load(id) {
			if (!id.endsWith(THREAD_QUERY)) {
				return null;
			}

			const file = id.slice(0, -THREAD_QUERY.length);
			const { code } = await transformWithEsbuild(await readFile(file, 'utf8'), file, {
				sourcemap: false,
			});
			if (/\b(?:from|import)\s*\(?\s*["'](?!node:)/.test(code)) {
				this.error(`${file} runs in a thread and may only import node: modules`);
			}

			return `export default ${JSON.stringify(code)};`;
		},
	};
}

export default defineConfig({
	plugins: [threadSource(), tailwindcss(), sveltekit()],
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
