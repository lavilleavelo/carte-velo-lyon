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

	-- Eco-Counter flows of each counter. practice: 2 for bikes, 13 for e-scooters
	CREATE TABLE IF NOT EXISTS counter_flows (
		id_pdc INTEGER NOT NULL,
		flow_id INTEGER NOT NULL,
		practice INTEGER NOT NULL,
		PRIMARY KEY (id_pdc, flow_id)
	) WITHOUT ROWID;

	-- Daily counts of the e-scooter flows, already included in counter_days.total
	CREATE TABLE IF NOT EXISTS counter_scooter_days (
		id_pdc INTEGER NOT NULL,
		day TEXT NOT NULL,
		total INTEGER NOT NULL,
		PRIMARY KEY (id_pdc, day)
	) WITHOUT ROWID;

	-- end: day classes resume (exclusive)
	CREATE TABLE IF NOT EXISTS school_holidays (
		start TEXT PRIMARY KEY,
		end TEXT NOT NULL,
		name TEXT NOT NULL
	);

	-- Eco-Counter photos of the counters, cached as files (original and WebP thumbnail)
	CREATE TABLE IF NOT EXISTS counter_photos (
		id_pdc INTEGER NOT NULL,
		position INTEGER NOT NULL,
		url TEXT NOT NULL,
		file TEXT NOT NULL,
		thumbnail TEXT,
		PRIMARY KEY (id_pdc, position)
	) WITHOUT ROWID;

	CREATE TABLE IF NOT EXISTS sync_state (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);

	-- Cerema car count points. hourly_from: oldest day with hourly data (backfill cursor)
	CREATE TABLE IF NOT EXISTS car_points (
		id INTEGER PRIMARY KEY,
		hourly_from TEXT,
		synced_at TEXT
	);

	-- total and hourly include the values reconstructed by the Cerema model when the sensor data is
	-- missing or filtered. predicted, hourly_predicted: share of reconstructed values (%)
	CREATE TABLE IF NOT EXISTS car_point_days (
		point_id INTEGER NOT NULL,
		day TEXT NOT NULL,
		total INTEGER NOT NULL,
		predicted REAL,
		hourly TEXT,
		hourly_predicted TEXT,
		PRIMARY KEY (point_id, day)
	) WITHOUT ROWID;
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
