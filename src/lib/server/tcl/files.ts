import { env } from '$env/dynamic/private';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { constants as zlibConstants, createGunzip } from 'node:zlib';

export function tclDataDir(): string {
	return env.TCL_DATA_DIR || '.data/tcl';
}

export async function* readRecords(path: string): AsyncGenerator<Record<string, unknown>> {
	const input = createReadStream(path);
	const gunzip = createGunzip({ finishFlush: zlibConstants.Z_SYNC_FLUSH });
	input.on('error', (error) => gunzip.destroy(error));
	const lines = createInterface({ input: input.pipe(gunzip), crlfDelay: Infinity });
	gunzip.on('error', () => lines.close());
	for await (const line of lines) {
		if (line.trim()) {
			try {
				yield JSON.parse(line) as Record<string, unknown>;
			} catch {
				continue;
			}
		}
	}
}
