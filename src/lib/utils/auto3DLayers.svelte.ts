import { untrack } from 'svelte';

export const AUTO_3D_LAYER_IDS = ['batiments-3d', 'arbres'] as const;

const PITCH_THRESHOLD = 10;

export function watchPitchForAuto3D(opts: {
	pitch: () => number;
	enabled: () => boolean;
	hasLayer: (id: string) => boolean;
	addLayers: (ids: string[]) => void;
	removeLayers: (ids: string[]) => void;
}) {
	let wasPitched = false;
	let autoApplied: string[] = [];

	$effect(() => {
		const pitched = opts.pitch() >= PITCH_THRESHOLD;
		untrack(() => {
			if (pitched && !wasPitched) {
				wasPitched = true;
				if (!opts.enabled()) {
					return;
				}
				const ids = AUTO_3D_LAYER_IDS.filter((id) => !opts.hasLayer(id));
				if (ids.length > 0) {
					autoApplied = ids;
					opts.addLayers(ids);
				}
			} else if (!pitched && wasPitched) {
				wasPitched = false;
				const toRemove = autoApplied.filter((id) => opts.hasLayer(id));
				autoApplied = [];
				if (toRemove.length > 0) {
					opts.removeLayers(toRemove);
				}
			}
		});
	});
}
