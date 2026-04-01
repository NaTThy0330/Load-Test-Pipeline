package jobs

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/google/uuid"

	"sylo/internal/k6"
	"sylo/internal/metrics"
	"sylo/internal/models"
	"sylo/internal/storage"
)

const (
	defaultSLOP95Ms          = 500
	defaultSLOP99Ms          = 1000
	defaultSLOErrorRatePct   = 0.1
	defaultSLOSuccessRatePct = 99.9
	defaultVUs               = 100
	defaultRampUpSec         = 300
	defaultDurationSec       = 600
	defaultRampDownSec       = 120
)

func Run(db *storage.DB, jobID string) error {
	if err := db.MarkJobStarted(jobID, storage.NowISO()); err != nil {
		return err
	}

	_ = db.UpdateJobStage(jobID, "load_apis", "Loading APIs for this job")
	jobConfig, err := db.GetJob(jobID)
	if err != nil {
		_ = db.SetJobFailed(jobID, err.Error())
		return err
	}
	cfg := normalizeConfig(jobConfig)
	apis, err := db.ListAPIsByJob(jobID)
	if err != nil {
		_ = db.SetJobFailed(jobID, err.Error())
		return err
	}

	if len(apis) == 0 {
		_ = db.SetJobFailed(jobID, "no APIs to test")
		return fmt.Errorf("no APIs to test")
	}

	_ = db.UpdateJobStage(jobID, "generate_script", "Generating k6 scripts (one per API)")

	type runResult struct {
		result models.Result
		job    models.Job
		err    error
		warn   string
	}

	resultsCh := make(chan runResult, len(apis))
	var wg sync.WaitGroup

	// Full parallel as requested: one k6 run per API
	for idx, api := range apis {
		wg.Add(1)
		go func(i int, api models.API) {
			defer wg.Done()
			stageMsg := fmt.Sprintf("Running k6 for API %d/%d", i+1, len(apis))
			_ = db.UpdateJobStage(jobID, "run_k6", stageMsg)

			outDir := filepath.Join("data", "runs", jobID, api.ID)
			scriptPath, err := k6.WriteScript(outDir, []models.API{api}, cfg)
			if err != nil {
				resultsCh <- runResult{err: err}
				return
			}

			result, err := k6.Run(scriptPath)
			_ = writeRunLogs(outDir, result.Stdout, result.Stderr)
			var warn string
			if err != nil {
				if errors.Is(err, k6.ErrThresholdsExceeded) {
					warn = api.Name
				} else {
					note := fmt.Sprintf("k6 error: %v", err)
					if result.Stderr != "" {
						note = note + "\n" + result.Stderr
					}
					resultsCh <- runResult{err: fmt.Errorf("%s", note)}
					return
				}
			}

			parsed, err := metrics.ParseSummary(result.SummaryPath, []models.API{api}, cfg.ThresholdP95Ms, cfg.ThresholdP99Ms, cfg.ThresholdErrorRatePct, cfg.ThresholdSuccessRatePct, result.JSONPath)
			if err != nil {
				resultsCh <- runResult{err: err}
				return
			}
			if len(parsed.Results) == 0 {
				resultsCh <- runResult{err: fmt.Errorf("no results parsed for api %s", api.Name)}
				return
			}

			res := parsed.Results[0]
			res.ID = uuid.NewString()
			resultsCh <- runResult{result: res, job: parsed.Overall, warn: warn}
		}(idx, api)
	}

	wg.Wait()
	close(resultsCh)

	_ = db.UpdateJobStage(jobID, "parse_metrics", "Aggregating per-API results")

	var results []models.Result
	var totalReq int
	var overallRPS float64
	var overallP95 float64
	var overallP99 float64
	var errorRateSum float64
	var checksSum float64
	var durationSec int
	var anyErr error
	var warnings []string

	for r := range resultsCh {
		if r.err != nil {
			anyErr = r.err
			continue
		}
		if r.warn != "" {
			warnings = append(warnings, r.warn)
		}
		results = append(results, r.result)
		if r.job.TotalRequests > 0 {
			totalReq += r.job.TotalRequests
			overallRPS += r.job.OverallRPS
			errorRateSum += r.job.ErrorRatePct * float64(r.job.TotalRequests)
			checksSum += r.job.ChecksPassPct * float64(r.job.TotalRequests)
		}
		if r.job.OverallP95Ms > overallP95 {
			overallP95 = r.job.OverallP95Ms
		}
		if r.job.OverallP99Ms > overallP99 {
			overallP99 = r.job.OverallP99Ms
		}
		if r.job.DurationSec > durationSec {
			durationSec = r.job.DurationSec
		}
	}

	if anyErr != nil {
		_ = db.SetJobFailed(jobID, anyErr.Error())
		return anyErr
	}

	_ = db.UpdateJobStage(jobID, "save_results", "Saving metrics to database")
	if err := db.CreateResults(results); err != nil {
		_ = db.SetJobFailed(jobID, err.Error())
		return err
	}

	job := models.Job{
		ID:            jobID,
		Status:        "done",
		TestType:      "load",
		FinishedAt:    storage.NowISO(),
		DurationSec:   durationSec,
		TotalRequests: totalReq,
		OverallRPS:    overallRPS,
		OverallP95Ms:  overallP95,
		OverallP99Ms:  overallP99,
		ErrorRatePct:  weighted(errorRateSum, totalReq),
		ChecksPassPct: weighted(checksSum, totalReq),
		SLOPass:       passesSLO(overallP95, overallP99, weighted(errorRateSum, totalReq), cfg.ThresholdP95Ms, cfg.ThresholdP99Ms, cfg.ThresholdErrorRatePct, cfg.ThresholdSuccessRatePct),
		Stage:         "done",
		StageMessage:  "Completed",
	}
	if len(warnings) > 0 {
		job.StageMessage = "Completed with threshold warnings"
	}

	if err := db.UpdateJobMetrics(job); err != nil {
		return err
	}

	notes := "Per-API k6 runs completed."
	if len(warnings) > 0 {
		maxList := 5
		list := warnings
		if len(warnings) > maxList {
			list = warnings[:maxList]
		}
		notes = fmt.Sprintf("Thresholds exceeded for %d API(s): %s", len(warnings), strings.Join(list, ", "))
		if len(warnings) > maxList {
			notes = notes + ", ..."
		}
	}
	summary := models.Summary{
		ID:        jobID + "-summary",
		JobID:     jobID,
		TotalAPIs: len(apis),
		Notes:     notes,
	}
	_ = db.CreateSummary(summary)

	return nil
}

func normalizeConfig(job models.Job) models.Job {
	if job.ConfigVUs <= 0 {
		job.ConfigVUs = defaultVUs
	}
	if job.ConfigRampUpSec <= 0 {
		job.ConfigRampUpSec = defaultRampUpSec
	}
	if job.ConfigDurationSec <= 0 {
		job.ConfigDurationSec = defaultDurationSec
	}
	if job.ConfigRampDownSec <= 0 {
		job.ConfigRampDownSec = defaultRampDownSec
	}
	if job.ThresholdP95Ms <= 0 {
		job.ThresholdP95Ms = defaultSLOP95Ms
	}
	if job.ThresholdP99Ms <= 0 {
		job.ThresholdP99Ms = defaultSLOP99Ms
	}
	if job.ThresholdErrorRatePct < 0 {
		job.ThresholdErrorRatePct = defaultSLOErrorRatePct
	}
	if job.ThresholdSuccessRatePct <= 0 {
		job.ThresholdSuccessRatePct = defaultSLOSuccessRatePct
	}
	return job
}

func passesSLO(p95, p99, errorRatePct, maxP95, maxP99, maxErrorRatePct, minSuccessRatePct float64) bool {
	if p95 <= 0 || p99 <= 0 {
		return false
	}
	if p95 > maxP95 || p99 > maxP99 {
		return false
	}
	if errorRatePct > maxErrorRatePct {
		return false
	}
	successRate := 100 - errorRatePct
	return successRate >= minSuccessRatePct
}

func weighted(sum float64, total int) float64 {
	if total == 0 {
		return 0
	}
	return sum / float64(total)
}

func writeRunLogs(outDir, stdout, stderr string) error {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}
	if stdout != "" {
		_ = os.WriteFile(filepath.Join(outDir, "k6_stdout.log"), []byte(stdout), 0o644)
	}
	if stderr != "" {
		_ = os.WriteFile(filepath.Join(outDir, "k6_stderr.log"), []byte(stderr), 0o644)
	}
	return nil
}
