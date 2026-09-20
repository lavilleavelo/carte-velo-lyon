<script lang="ts">
	import { CustomLayer } from 'svelte-maplibre-gl';
	import * as maplibregl from 'maplibre-gl';
	import type * as ThreeNS from 'three';

	let {
		isLayerVisible,
		map,
	}: {
		isLayerVisible: (id: string) => boolean;
		map?: maplibregl.Map;
	} = $props();

	const active = $derived(isLayerVisible('arbres'));

	const MIN_ZOOM = 15;
	const TILE_Z = 15;
	const MAX_TILES_PER_MOVE = 12;
	const MAX_TREES = 40000;

	const CONIFERS = new Set([
		'Pinus',
		'Abies',
		'Picea',
		'Cedrus',
		'Cupressus',
		'Cupressocyparis',
		'Sequoia',
		'Sequoiadendron',
		'Taxus',
		'Thuja',
		'Chamaecyparis',
		'Metasequoia',
		'Larix',
		'Juniperus',
		'Calocedrus',
		'Cryptomeria',
		'Tsuga',
		'Pseudotsuga',
		'Araucaria',
	]);

	interface Tree {
		gid: number;
		lng: number;
		lat: number;
		/** hauteur totale (m) */
		h: number;
		/** base de la couronne = hauteur du fût (m) */
		base: number;
		/** rayon de la couronne (m) */
		r: number;
		conifer: boolean;
	}

	let trees = new Map<number, Tree>(); // par gid
	let fetchedTiles = new Set<string>();
	let inflight = false;
	let queued = false;

	let THREE = $state.raw<typeof ThreeNS | null>(null);
	$effect(() => {
		if (active && !THREE) {
			void import('three').then((m) => (THREE = m));
		}
	});

	function tileAt(lng: number, lat: number, z: number): [number, number] {
		const n = 2 ** z;
		const x = Math.floor(((lng + 180) / 360) * n);
		const la = (lat * Math.PI) / 180;
		const y = Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n);
		return [x, y];
	}
	function tileBbox(x: number, y: number, z: number): [number, number, number, number] {
		const n = 2 ** z;
		const lon = (t: number) => (t / n) * 360 - 180;
		const lat = (t: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * t) / n))) * 180) / Math.PI;
		return [lon(x), lat(y + 1), lon(x + 1), lat(y)]; // W,S,E,N
	}

	const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

	async function fetchTile(key: string): Promise<void> {
		const [x, y] = key.split('/').map(Number);
		const [w, s, e, n] = tileBbox(x, y, TILE_Z);
		const res = await fetch(`/api/grandlyon/arbres?bbox=${w},${s},${e},${n}`);
		if (!res.ok) {
			throw new Error(`arbres ${res.status}`);
		}
		const fc = (await res.json()) as {
			features: {
				geometry: { type: string; coordinates: [number, number] };
				properties: Record<string, number | string | null>;
			}[];
		};
		for (const f of fc.features) {
			if (f.geometry?.type !== 'Point') {
				continue;
			}
			const p = f.properties;
			const gid = Number(p.gid);
			if (!gid || trees.has(gid)) {
				continue;
			}

			const h = clamp(Number(p.hauteurtotale_m) || 8, 3, 20);
			const fut = Number(p.hauteurfut_m) || h * 0.3;
			const base = clamp(fut, 1, h - 1.5);
			const r = clamp((Number(p.rayoncouronne_m) || 2) * 0.85, 1, 4);
			const conifer = CONIFERS.has(String(p.genre ?? ''));
			const [lng, lat] = f.geometry.coordinates;
			trees.set(gid, { gid, lng, lat, h, base, r, conifer });
		}
	}

	async function refresh(): Promise<void> {
		const m = map;
		if (!m || !active || m.getZoom() < MIN_ZOOM) {
			return;
		}
		if (inflight) {
			queued = true;
			return;
		}

		const b = m.getBounds();
		const [x0, y0] = tileAt(b.getWest(), b.getNorth(), TILE_Z);
		const [x1, y1] = tileAt(b.getEast(), b.getSouth(), TILE_Z);
		const c = m.getCenter();
		const [cx, cy] = tileAt(c.lng, c.lat, TILE_Z);

		const todo: { key: string; d: number }[] = [];
		for (let x = x0; x <= x1; x++) {
			for (let y = y0; y <= y1; y++) {
				const key = `${x}/${y}`;
				if (!fetchedTiles.has(key)) {
					todo.push({ key, d: (x - cx) ** 2 + (y - cy) ** 2 });
				}
			}
		}
		if (!todo.length) {
			return;
		}

		todo.sort((a, b2) => a.d - b2.d);
		const batch = todo.slice(0, MAX_TILES_PER_MOVE).map((t) => t.key);

		if (trees.size > MAX_TREES) {
			trees = new Map();
			fetchedTiles = new Set();
		}

		inflight = true;
		try {
			await Promise.all(
				batch.map(async (key) => {
					fetchedTiles.add(key);
					try {
						await fetchTile(key);
					} catch {
						fetchedTiles.delete(key);
					}
				}),
			);
			rebuildInstances();
		} finally {
			inflight = false;
			if (queued) {
				queued = false;
				void refresh();
			}
		}
	}

	$effect(() => {
		const m = map;
		if (!m || !active) {
			return;
		}
		const handler = () => void refresh();
		m.on('moveend', handler);
		void refresh();
		return () => m.off('moveend', handler);
	});

	// mètres relatifs à ORIGIN, x est, y haut, z sud
	const ORIGIN: [number, number] = [4.85, 45.76]; // centre de Lyon

	let camera: ThreeNS.Camera | undefined;
	let scene: ThreeNS.Scene | undefined;
	let renderer: ThreeNS.WebGLRenderer | undefined;
	let treeGroup: ThreeNS.Group | undefined;
	let rootMatrix: ThreeNS.Matrix4 | undefined;
	let layerMap: maplibregl.Map | undefined;

	function sceneXZ(lng: number, lat: number): [number, number] {
		const o = maplibregl.MercatorCoordinate.fromLngLat({ lng: ORIGIN[0], lat: ORIGIN[1] }, 0);
		const s = o.meterInMercatorCoordinateUnits();
		const mc = maplibregl.MercatorCoordinate.fromLngLat({ lng, lat }, 0);
		return [(mc.x - o.x) / s, (mc.y - o.y) / s];
	}

	function rebuildInstances(): void {
		const T = THREE;
		if (!T || !scene || !treeGroup) {
			return;
		}

		for (const child of [...treeGroup.children]) {
			treeGroup.remove(child);
			const mesh = child as ThreeNS.InstancedMesh;
			mesh.geometry?.dispose();
			(mesh.material as ThreeNS.Material)?.dispose();
		}

		const list = [...trees.values()];
		const deciduous = list.filter((t) => !t.conifer);
		const conifers = list.filter((t) => t.conifer);

		const mat = new T.Matrix4();
		const pos = new T.Vector3();
		const quat = new T.Quaternion();
		const scl = new T.Vector3();
		const color = new T.Color();
		const yAxis = new T.Vector3(0, 1, 0);

		// troncs
		const trunkGeo = new T.CylinderGeometry(0.22, 0.32, 1, 6);
		const trunkMat = new T.MeshLambertMaterial({ color: 0x7a5a3a });
		const trunks = new T.InstancedMesh(trunkGeo, trunkMat, list.length);
		list.forEach((t, i) => {
			const [x, z] = sceneXZ(t.lng, t.lat);
			const th = t.base + 0.6; // pénètre dans la couronne pour ne laisser aucun trou
			pos.set(x, th / 2, z);
			quat.setFromAxisAngle(yAxis, (t.gid % 16) * (Math.PI / 8));
			scl.set(1, th, 1);
			trunks.setMatrixAt(i, mat.compose(pos, quat, scl));
		});

		// feuillus
		const crownGeo = new T.IcosahedronGeometry(1, 1);
		const crownMat = new T.MeshLambertMaterial({ flatShading: true });
		const crowns = new T.InstancedMesh(crownGeo, crownMat, deciduous.length);
		deciduous.forEach((t, i) => {
			const [x, z] = sceneXZ(t.lng, t.lat);
			const ch = t.h - t.base;
			pos.set(x, t.base + ch / 2, z);
			quat.setFromAxisAngle(yAxis, (t.gid % 16) * (Math.PI / 8));
			scl.set(t.r, ch / 2, t.r * (0.9 + (t.gid % 5) * 0.05)); // légèrement irrégulier
			crowns.setMatrixAt(i, mat.compose(pos, quat, scl));
			// teinte et luminosité variées par arbre
			color.setHSL(0.26 + (t.gid % 7) * 0.008, 0.42, 0.3 + (t.gid % 5) * 0.02);
			crowns.setColorAt(i, color);
		});

		// conifères
		const coneGeo = new T.ConeGeometry(1, 1, 7);
		const coneMat = new T.MeshLambertMaterial({ flatShading: true });
		const cones = new T.InstancedMesh(coneGeo, coneMat, conifers.length);
		conifers.forEach((t, i) => {
			const [x, z] = sceneXZ(t.lng, t.lat);
			const ch = t.h - t.base;
			pos.set(x, t.base + ch / 2, z);
			quat.setFromAxisAngle(yAxis, (t.gid % 16) * (Math.PI / 8));
			scl.set(t.r * 0.85, ch, t.r * 0.85);
			cones.setMatrixAt(i, mat.compose(pos, quat, scl));
			color.setHSL(0.31 + (t.gid % 5) * 0.006, 0.38, 0.2 + (t.gid % 4) * 0.015);
			cones.setColorAt(i, color);
		});

		treeGroup.add(trunks, crowns, cones);
		layerMap?.triggerRepaint();
	}

	function makeImplementation(
		T: typeof ThreeNS,
	): Omit<maplibregl.CustomLayerInterface, 'id' | 'type'> {
		return {
			renderingMode: '3d',
			onAdd(m, gl) {
				layerMap = m;
				camera = new T.Camera();
				scene = new T.Scene();
				treeGroup = new T.Group();
				scene.add(treeGroup);

				const sun = new T.DirectionalLight(0xffffff, 2.2);
				sun.position.set(120, 260, -180);
				scene.add(sun);
				scene.add(new T.HemisphereLight(0xdfeafa, 0x9a8f78, 1.1));

				const o = maplibregl.MercatorCoordinate.fromLngLat({ lng: ORIGIN[0], lat: ORIGIN[1] }, 0);
				const s = o.meterInMercatorCoordinateUnits();
				rootMatrix = new T.Matrix4()
					.makeTranslation(o.x, o.y, o.z)
					.scale(new T.Vector3(s, -s, s))
					.multiply(new T.Matrix4().makeRotationX(Math.PI / 2));

				renderer = new T.WebGLRenderer({
					canvas: m.getCanvas(),
					context: gl,
					antialias: true,
				});
				renderer.autoClear = false;

				rebuildInstances();
			},
			render(_gl, args) {
				if (!renderer || !scene || !camera || !treeGroup || !rootMatrix || !THREE) {
					return;
				}
				const m = layerMap;
				if (!m) {
					return;
				}

				// fait grandir les arbres quand l'utilisateur franchit MIN_ZOOM (évite le pop-in)
				const k = clamp((m.getZoom() - MIN_ZOOM) / 0.8, 0, 1);
				if (k <= 0) {
					return;
				}
				treeGroup.scale.y = k;
				treeGroup.updateMatrixWorld();

				// maplibre v5 passe des données de projection ; l'ancienne signature
				// passait la matrice brute
				const raw =
					(args as { defaultProjectionData?: { mainMatrix: number[] } })?.defaultProjectionData
						?.mainMatrix ?? (args as unknown as number[]);
				camera.projectionMatrix = new THREE.Matrix4().fromArray(raw).multiply(rootMatrix);
				renderer.resetState();
				renderer.render(scene, camera);
			},
			onRemove() {
				for (const child of treeGroup?.children ?? []) {
					const mesh = child as ThreeNS.InstancedMesh;
					mesh.geometry?.dispose();
					(mesh.material as ThreeNS.Material)?.dispose();
				}
				renderer?.dispose();
				renderer = undefined;
				scene = undefined;
				camera = undefined;
				treeGroup = undefined;
				layerMap = undefined;
			},
		};
	}
</script>

{#if active && THREE}
	<CustomLayer id="arbres-3d" implementation={makeImplementation(THREE)} />
{/if}
