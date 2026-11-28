import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import { createInflateRaw } from 'node:zlib';

type Entry = { name: string; method: number; compressedSize: number; headerOffset: number };

async function entries(path: string): Promise<Map<string, Entry>> {
	const handle = await open(path, 'r');
	try {
		const { size } = await handle.stat();
		const tailSize = Math.min(size, 65_557);
		const tail = Buffer.alloc(tailSize);
		await handle.read(tail, 0, tailSize, size - tailSize);
		const end = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
		if (end < 0) {
			throw new Error('not a zip archive');
		}
		const count = tail.readUInt16LE(end + 10);
		const directorySize = tail.readUInt32LE(end + 12);
		const directoryOffset = tail.readUInt32LE(end + 16);
		const directory = Buffer.alloc(directorySize);
		await handle.read(directory, 0, directorySize, directoryOffset);
		const result = new Map<string, Entry>();
		let offset = 0;
		for (let index = 0; index < count; index++) {
			const nameLength = directory.readUInt16LE(offset + 28);
			const extraLength = directory.readUInt16LE(offset + 30);
			const commentLength = directory.readUInt16LE(offset + 32);
			const name = directory.toString('utf8', offset + 46, offset + 46 + nameLength);
			result.set(name, {
				name,
				method: directory.readUInt16LE(offset + 10),
				compressedSize: directory.readUInt32LE(offset + 20),
				headerOffset: directory.readUInt32LE(offset + 42),
			});
			offset += 46 + nameLength + extraLength + commentLength;
		}
		return result;
	} finally {
		await handle.close();
	}
}

async function entryStream(path: string, entry: Entry): Promise<Readable> {
	const handle = await open(path, 'r');
	const header = Buffer.alloc(30);
	try {
		await handle.read(header, 0, 30, entry.headerOffset);
	} finally {
		await handle.close();
	}
	const start = entry.headerOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
	const raw = createReadStream(path, { start, end: start + entry.compressedSize - 1 });
	if (entry.method === 0) {
		return raw;
	}
	if (entry.method !== 8) {
		throw new Error(`unsupported zip method ${entry.method} for ${entry.name}`);
	}
	const inflate = createInflateRaw();
	raw.on('error', (error) => inflate.destroy(error));
	return raw.pipe(inflate);
}

function splitCsv(line: string): string[] {
	if (!line.includes('"')) {
		return line.split(',');
	}
	const fields: string[] = [];
	let field = '';
	let quoted = false;
	for (let index = 0; index < line.length; index++) {
		const char = line[index];
		if (quoted) {
			if (char === '"' && line[index + 1] === '"') {
				field += '"';
				index++;
			} else if (char === '"') {
				quoted = false;
			} else {
				field += char;
			}
		} else if (char === '"') {
			quoted = true;
		} else if (char === ',') {
			fields.push(field);
			field = '';
		} else {
			field += char;
		}
	}
	fields.push(field);
	return fields;
}

export async function* readZipEntry(path: string, name: string): AsyncGenerator<Buffer> {
	const entry = (await entries(path)).get(name);
	if (!entry) {
		return;
	}
	for await (const chunk of await entryStream(path, entry)) {
		yield chunk as Buffer;
	}
}

export async function listZip(path: string): Promise<string[]> {
	return [...(await entries(path)).keys()];
}

export async function* readZipCsv(
	path: string,
	name: string,
): AsyncGenerator<Record<string, string>> {
	const entry = (await entries(path)).get(name);
	if (!entry) {
		return;
	}
	const lines = createInterface({ input: await entryStream(path, entry), crlfDelay: Infinity });
	let columns: string[] | null = null;
	for await (const line of lines) {
		if (!line) {
			continue;
		}
		const fields = splitCsv(line);
		if (!columns) {
			columns = fields.map((column) => column.replace(/^﻿/, '').trim());
			continue;
		}
		const row: Record<string, string> = {};
		columns.forEach((column, index) => (row[column] = fields[index] ?? ''));
		yield row;
	}
}
