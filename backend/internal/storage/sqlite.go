package storage

import (
	"database/sql"
	"fmt"
	"os"

	_ "modernc.org/sqlite"
)

type DB struct {
	*sql.DB
}

func Open(path string) (*DB, error) {
	if err := os.MkdirAll(dir(path), 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	if err := migrate(db); err != nil {
		return nil, err
	}
	return &DB{DB: db}, nil
}

func dir(path string) string {
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == '/' {
			if i == 0 {
				return "/"
			}
			return path[:i]
		}
	}
	return "."
}

func migrate(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS jobs (
			id TEXT PRIMARY KEY,
			created_at TEXT NOT NULL,
			started_at TEXT,
			finished_at TEXT,
			status TEXT NOT NULL,
			stage TEXT,
			stage_message TEXT,
			test_type TEXT NOT NULL,
			duration_sec INTEGER,
			total_requests INTEGER,
			overall_rps REAL,
			overall_p95_ms REAL,
			error_rate_pct REAL,
			checks_pass_pct REAL,
			slo_pass INTEGER
		);`,
		`CREATE TABLE IF NOT EXISTS apis (
			id TEXT PRIMARY KEY,
			job_id TEXT NOT NULL,
			name TEXT NOT NULL,
			method TEXT,
			description TEXT,
			headers TEXT,
			query_params TEXT,
			authorization TEXT,
			body TEXT,
			FOREIGN KEY(job_id) REFERENCES jobs(id)
		);`,
		`CREATE TABLE IF NOT EXISTS results (
			id TEXT PRIMARY KEY,
			job_id TEXT NOT NULL,
			api_id TEXT NOT NULL,
			req_count INTEGER,
			rps REAL,
			avg_ms REAL,
			med_ms REAL,
			p95_ms REAL,
			p99_ms REAL,
			min_ms REAL,
			max_ms REAL,
			error_rate_pct REAL,
			throughput_bps REAL,
			slo_pass INTEGER,
			FOREIGN KEY(job_id) REFERENCES jobs(id),
			FOREIGN KEY(api_id) REFERENCES apis(id)
		);`,
		`CREATE TABLE IF NOT EXISTS summary (
			id TEXT PRIMARY KEY,
			job_id TEXT NOT NULL,
			total_apis INTEGER,
			notes TEXT,
			FOREIGN KEY(job_id) REFERENCES jobs(id)
		);`,
	}

	for i, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("migrate step %d: %w", i+1, err)
		}
	}
	if err := ensureColumn(db, "jobs", "started_at", "TEXT"); err != nil {
		return err
	}
	if err := ensureColumn(db, "jobs", "finished_at", "TEXT"); err != nil {
		return err
	}
	if err := ensureColumn(db, "jobs", "stage", "TEXT"); err != nil {
		return err
	}
	if err := ensureColumn(db, "jobs", "stage_message", "TEXT"); err != nil {
		return err
	}
	if err := ensureColumn(db, "apis", "headers", "TEXT"); err != nil {
		return err
	}
	if err := ensureColumn(db, "apis", "query_params", "TEXT"); err != nil {
		return err
	}
	if err := ensureColumn(db, "apis", "authorization", "TEXT"); err != nil {
		return err
	}
	if err := ensureColumn(db, "apis", "body", "TEXT"); err != nil {
		return err
	}
	return nil
}

func ensureColumn(db *sql.DB, table, column, columnType string) error {
	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s);", table))
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return err
		}
		if name == column {
			return nil
		}
	}
	if _, err := db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, columnType)); err != nil {
		return err
	}
	return nil
}
