import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DB_PATH = process.env.COUNTERS_DB_PATH ?? '.data/counters.sqlite';

const SCHEMA = `
	CREATE TABLE IF NOT EXISTS counters (
		id_pdc INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		flow_ids TEXT NOT NULL,
		lat REAL,
		lon REAL,
		synced_at TEXT
	);

	-- day: local date (Europe/Paris), hourly: JSON array of 24 local hours (null when the hour
	-- does not exist, i.e. 2am on the spring DST day), NULL when hourly data is not available
	CREATE TABLE IF NOT EXISTS counter_days (
		id_pdc INTEGER NOT NULL,
		day TEXT NOT NULL,
		total INTEGER NOT NULL,
		hourly TEXT,
		PRIMARY KEY (id_pdc, day)
	) WITHOUT ROWID;

	-- end: day classes resume (exclusive)
	CREATE TABLE IF NOT EXISTS school_holidays (
		start TEXT PRIMARY KEY,
		end TEXT NOT NULL,
		name TEXT NOT NULL
	);
`;

let db: DatabaseSync | null = null;

export function getCountersDb(): DatabaseSync {
	if (!db) {
		mkdirSync(dirname(DB_PATH), { recursive: true });
		db = new DatabaseSync(DB_PATH);
		db.exec(SCHEMA);
	}
	return db;
}

export function transaction(database: DatabaseSync, fn: () => void): void {
	database.exec('BEGIN');
	try {
		fn();
		database.exec('COMMIT');
	} catch (error) {
		database.exec('ROLLBACK');
		throw error;
	}
}
