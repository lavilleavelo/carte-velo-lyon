import { env } from '$env/dynamic/private';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
	PRAGMA journal_mode = WAL;

	CREATE TABLE IF NOT EXISTS days (
		day TEXT PRIMARY KEY,
		version INTEGER NOT NULL,
		computed_at TEXT NOT NULL,
		complete INTEGER NOT NULL,
		vm_records INTEGER NOT NULL,
		vm_max_gap_s INTEGER,
		vm_bytes INTEGER NOT NULL,
		et_bytes INTEGER NOT NULL,
		sx_bytes INTEGER NOT NULL,
		stops_bytes INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS crossings (
		day TEXT NOT NULL,
		line TEXT NOT NULL,
		direction TEXT NOT NULL,
		entered_at INTEGER NOT NULL,
		hour INTEGER NOT NULL,
		seconds INTEGER NOT NULL
	);
	CREATE INDEX IF NOT EXISTS crossings_line_day ON crossings (line, day);
	CREATE INDEX IF NOT EXISTS crossings_day ON crossings (day);

	CREATE TABLE IF NOT EXISTS delays (
		line TEXT NOT NULL,
		direction TEXT NOT NULL,
		day TEXT NOT NULL,
		hour INTEGER NOT NULL,
		count INTEGER NOT NULL,
		total_s INTEGER NOT NULL,
		histogram TEXT NOT NULL,
		PRIMARY KEY (line, direction, day, hour)
	) WITHOUT ROWID;
	CREATE INDEX IF NOT EXISTS delays_day ON delays (day);

	CREATE TABLE IF NOT EXISTS cells (
		line TEXT NOT NULL,
		direction TEXT NOT NULL,
		day TEXT NOT NULL,
		lat_index INTEGER NOT NULL,
		lon_index INTEGER NOT NULL,
		journeys INTEGER NOT NULL,
		lost_s INTEGER NOT NULL,
		bus_s INTEGER NOT NULL,
		PRIMARY KEY (line, direction, day, lat_index, lon_index)
	) WITHOUT ROWID;
	CREATE INDEX IF NOT EXISTS cells_day ON cells (day);

	CREATE TABLE IF NOT EXISTS stops (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		lat REAL NOT NULL,
		lon REAL NOT NULL,
		lines TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS passages (
		day TEXT NOT NULL,
		line TEXT NOT NULL,
		direction TEXT NOT NULL,
		journey TEXT NOT NULL,
		stop_id INTEGER NOT NULL,
		stop_order INTEGER NOT NULL,
		aimed INTEGER NOT NULL,
		actual INTEGER NOT NULL
	);
	CREATE INDEX IF NOT EXISTS passages_stop_day ON passages (stop_id, day);
	CREATE INDEX IF NOT EXISTS passages_day ON passages (day);
	CREATE INDEX IF NOT EXISTS passages_line ON passages (line, direction);
	CREATE INDEX IF NOT EXISTS passages_journey ON passages (day, journey);

	CREATE TABLE IF NOT EXISTS gtfs_meta (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS gtfs_versions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		imported_at TEXT NOT NULL,
		content_hash TEXT NOT NULL,
		feed_version TEXT,
		valid_from TEXT,
		valid_to TEXT,
		trips INTEGER NOT NULL,
		lines INTEGER NOT NULL,
		changes TEXT,
		recomputed_from TEXT,
		recomputed_to TEXT,
		archive TEXT
	);

	CREATE TABLE IF NOT EXISTS gtfs_trips (
		id INTEGER PRIMARY KEY,
		trip_id TEXT NOT NULL UNIQUE,
		line TEXT NOT NULL,
		direction TEXT NOT NULL,
		service_id TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS gtfs_stop_times (
		trip INTEGER NOT NULL,
		seq INTEGER NOT NULL,
		stop_id INTEGER NOT NULL,
		arrival INTEGER NOT NULL,
		PRIMARY KEY (trip, seq)
	) WITHOUT ROWID;
	CREATE INDEX IF NOT EXISTS gtfs_stop_times_stop ON gtfs_stop_times (stop_id, arrival);

	CREATE TABLE IF NOT EXISTS gtfs_stops (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		lat REAL NOT NULL,
		lon REAL NOT NULL
	);

	CREATE TABLE IF NOT EXISTS gtfs_calendar (
		service_id TEXT PRIMARY KEY,
		days TEXT NOT NULL,
		start_date TEXT NOT NULL,
		end_date TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS gtfs_calendar_dates (
		service_id TEXT NOT NULL,
		date TEXT NOT NULL,
		type INTEGER NOT NULL,
		PRIMARY KEY (service_id, date)
	) WITHOUT ROWID;
	CREATE INDEX IF NOT EXISTS gtfs_calendar_dates_date ON gtfs_calendar_dates (date);

	CREATE TABLE IF NOT EXISTS routes (
		line TEXT PRIMARY KEY,
		fetched_at INTEGER NOT NULL,
		features TEXT NOT NULL
	);
`;

let db: DatabaseSync | null = null;

export function getTclDb(): DatabaseSync {
	if (!db) {
		const dir = env.TCL_DATA_DIR || '.data/tcl';
		mkdirSync(dir, { recursive: true });
		db = new DatabaseSync(join(dir, 'tcl.sqlite'));
		for (const table of ['delays', 'cells']) {
			const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
			if (columns.length > 0 && !columns.some((column) => column.name === 'direction')) {
				db.exec(`DROP TABLE ${table}`);
			}
		}
		db.exec(SCHEMA);
	}
	return db;
}
