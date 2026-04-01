package storage

import (
	"database/sql"
	"errors"
	"time"

	"sylo/internal/models"
)

func (db *DB) CreateJob(job models.Job) error {
	_, err := db.Exec(`INSERT INTO jobs (
		id, created_at, started_at, finished_at, status, stage, stage_message, test_type, duration_sec, total_requests, overall_rps, overall_p95_ms, overall_p99_ms, error_rate_pct, checks_pass_pct, slo_pass,
		config_vus, config_ramp_up_sec, config_duration_sec, config_ramp_down_sec, threshold_p95_ms, threshold_p99_ms, threshold_error_rate_pct, threshold_success_rate_pct
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		job.ID, job.CreatedAt, job.StartedAt, job.FinishedAt, job.Status, job.Stage, job.StageMessage, job.TestType, job.DurationSec, job.TotalRequests, job.OverallRPS, job.OverallP95Ms, job.OverallP99Ms, job.ErrorRatePct, job.ChecksPassPct, boolToInt(job.SLOPass),
		job.ConfigVUs, job.ConfigRampUpSec, job.ConfigDurationSec, job.ConfigRampDownSec, job.ThresholdP95Ms, job.ThresholdP99Ms, job.ThresholdErrorRatePct, job.ThresholdSuccessRatePct)
	return err
}

func (db *DB) UpdateJobStatus(id, status string) error {
	_, err := db.Exec(`UPDATE jobs SET status = ? WHERE id = ?`, status, id)
	return err
}

func (db *DB) UpdateJobMetrics(job models.Job) error {
	_, err := db.Exec(`UPDATE jobs SET
		duration_sec = ?,
		total_requests = ?,
		overall_rps = ?,
		overall_p95_ms = ?,
		overall_p99_ms = ?,
		error_rate_pct = ?,
		checks_pass_pct = ?,
		slo_pass = ?,
		finished_at = ?,
		stage = ?,
		stage_message = ?,
		status = ?
	WHERE id = ?`,
		job.DurationSec, job.TotalRequests, job.OverallRPS, job.OverallP95Ms, job.OverallP99Ms, job.ErrorRatePct, job.ChecksPassPct, boolToInt(job.SLOPass), job.FinishedAt, job.Stage, job.StageMessage, job.Status, job.ID)
	return err
}

func (db *DB) MarkJobStarted(id string, startedAt string) error {
	_, err := db.Exec(`UPDATE jobs SET status = ?, started_at = ?, stage = ?, stage_message = ? WHERE id = ?`, "running", startedAt, "start", "Job started", id)
	return err
}

func (db *DB) UpdateJobStage(id, stage, message string) error {
	_, err := db.Exec(`UPDATE jobs SET stage = ?, stage_message = ? WHERE id = ?`, stage, message, id)
	return err
}

func (db *DB) CreateAPIs(apis []models.API) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()
	stmt, err := tx.Prepare(`INSERT INTO apis (id, job_id, name, method, description, headers, query_params, authorization, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, api := range apis {
		if _, err = stmt.Exec(api.ID, api.JobID, api.Name, api.Method, api.Description, api.Headers, api.QueryParams, api.Authorization, api.Body); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (db *DB) CreateResults(results []models.Result) error {
	if len(results) == 0 {
		return nil
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()
	stmt, err := tx.Prepare(`INSERT INTO results (
		id, job_id, api_id, req_count, rps, avg_ms, med_ms, p95_ms, p99_ms, min_ms, max_ms, error_rate_pct, throughput_bps, slo_pass
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, r := range results {
		if _, err = stmt.Exec(r.ID, r.JobID, r.APIID, r.ReqCount, r.RPS, r.AvgMs, r.MedMs, r.P95Ms, r.P99Ms, r.MinMs, r.MaxMs, r.ErrorRatePct, r.ThroughputBps, boolToInt(r.SLOPass)); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (db *DB) CreateSummary(summary models.Summary) error {
	_, err := db.Exec(`INSERT INTO summary (id, job_id, total_apis, notes) VALUES (?, ?, ?, ?)`,
		summary.ID, summary.JobID, summary.TotalAPIs, summary.Notes)
	return err
}

func (db *DB) GetJob(id string) (models.Job, error) {
	row := db.QueryRow(`SELECT id, created_at, started_at, finished_at, status, stage, stage_message, test_type, duration_sec, total_requests, overall_rps, overall_p95_ms, overall_p99_ms, error_rate_pct, checks_pass_pct, slo_pass,
		config_vus, config_ramp_up_sec, config_duration_sec, config_ramp_down_sec, threshold_p95_ms, threshold_p99_ms, threshold_error_rate_pct, threshold_success_rate_pct
		FROM jobs WHERE id = ?`, id)
	var job models.Job
	var sloPassInt int
	if err := row.Scan(&job.ID, &job.CreatedAt, &job.StartedAt, &job.FinishedAt, &job.Status, &job.Stage, &job.StageMessage, &job.TestType, &job.DurationSec, &job.TotalRequests, &job.OverallRPS, &job.OverallP95Ms, &job.OverallP99Ms, &job.ErrorRatePct, &job.ChecksPassPct, &sloPassInt,
		&job.ConfigVUs, &job.ConfigRampUpSec, &job.ConfigDurationSec, &job.ConfigRampDownSec, &job.ThresholdP95Ms, &job.ThresholdP99Ms, &job.ThresholdErrorRatePct, &job.ThresholdSuccessRatePct); err != nil {
		return models.Job{}, err
	}
	job.SLOPass = sloPassInt == 1
	return job, nil
}

func (db *DB) ListAPIsByJob(jobID string) ([]models.API, error) {
	rows, err := db.Query(`SELECT id, job_id, name, method, description, headers, query_params, authorization, body FROM apis WHERE job_id = ?`, jobID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apis []models.API
	for rows.Next() {
		var api models.API
		if err := rows.Scan(&api.ID, &api.JobID, &api.Name, &api.Method, &api.Description, &api.Headers, &api.QueryParams, &api.Authorization, &api.Body); err != nil {
			return nil, err
		}
		apis = append(apis, api)
	}
	return apis, rows.Err()
}

func (db *DB) ListResultsByJob(jobID string) ([]models.Result, error) {
	rows, err := db.Query(`SELECT id, job_id, api_id, req_count, rps, avg_ms, med_ms, p95_ms, p99_ms, min_ms, max_ms, error_rate_pct, throughput_bps, slo_pass FROM results WHERE job_id = ?`, jobID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.Result
	for rows.Next() {
		var r models.Result
		var sloPassInt int
		if err := rows.Scan(&r.ID, &r.JobID, &r.APIID, &r.ReqCount, &r.RPS, &r.AvgMs, &r.MedMs, &r.P95Ms, &r.P99Ms, &r.MinMs, &r.MaxMs, &r.ErrorRatePct, &r.ThroughputBps, &sloPassInt); err != nil {
			return nil, err
		}
		r.SLOPass = sloPassInt == 1
		results = append(results, r)
	}
	return results, rows.Err()
}

func (db *DB) GetSummary(jobID string) (models.Summary, error) {
	row := db.QueryRow(`SELECT id, job_id, total_apis, notes FROM summary WHERE job_id = ?`, jobID)
	var summary models.Summary
	if err := row.Scan(&summary.ID, &summary.JobID, &summary.TotalAPIs, &summary.Notes); err != nil {
		return models.Summary{}, err
	}
	return summary, nil
}

func (db *DB) SetJobFailed(id string, errMsg string) error {
	_, err := db.Exec(`UPDATE jobs SET status = ?, finished_at = ?, stage = ?, stage_message = ? WHERE id = ?`, "failed", NowISO(), "failed", errMsg, id)
	if err != nil {
		return err
	}
	if errMsg != "" {
		_, _ = db.Exec(`INSERT OR REPLACE INTO summary (id, job_id, total_apis, notes) VALUES (?, ?, ?, ?)`,
			id+"-summary", id, 0, errMsg)
	}
	return nil
}

func (db *DB) TouchSummary(jobID string, totalAPIs int, notes string) error {
	_, err := db.Exec(`INSERT OR REPLACE INTO summary (id, job_id, total_apis, notes) VALUES (?, ?, ?, ?)`,
		jobID+"-summary", jobID, totalAPIs, notes)
	return err
}

func NowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

func IsNotFound(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}
