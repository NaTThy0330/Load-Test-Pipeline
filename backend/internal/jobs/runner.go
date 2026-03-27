package jobs

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/google/uuid"

	"sylo/internal/k6"
	"sylo/internal/metrics"
	"sylo/internal/models"
	"sylo/internal/storage"
)

const defaultSLOP95Ms = 500

func Run(db *storage.DB, jobID string) error {
	if err := db.MarkJobStarted(jobID, storage.NowISO()); err != nil {
		return err
	}

	_ = db.UpdateJobStage(jobID, "load_apis", "Loading APIs for this job")
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
			scriptPath, err := k6.WriteScript(outDir, []models.API{api})
			if err != nil {
				resultsCh <- runResult{err: err}
				return
			}

			result, err := k6.Run(scriptPath)
			if err != nil {
				note := fmt.Sprintf("k6 error: %v", err)
				if result.Stderr != "" {
					note = note + "\n" + result.Stderr
				}
				_ = writeRunLogs(outDir, result.Stdout, result.Stderr)
				resultsCh <- runResult{err: fmt.Errorf("%s", note)}
				return
			}
			_ = writeRunLogs(outDir, result.Stdout, result.Stderr)

			parsed, err := metrics.ParseSummary(result.SummaryPath, []models.API{api}, defaultSLOP95Ms, result.JSONPath)
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
			resultsCh <- runResult{result: res, job: parsed.Overall}
		}(idx, api)
	}

	wg.Wait()
	close(resultsCh)

	_ = db.UpdateJobStage(jobID, "parse_metrics", "Aggregating per-API results")

	var results []models.Result
	var totalReq int
	var overallRPS float64
	var overallP95 float64
	var errorRateSum float64
	var checksSum float64
	var durationSec int
	var anyErr error

	for r := range resultsCh {
		if r.err != nil {
			anyErr = r.err
			continue
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
		ErrorRatePct:  weighted(errorRateSum, totalReq),
		ChecksPassPct: weighted(checksSum, totalReq),
		SLOPass:       overallP95 > 0 && overallP95 <= defaultSLOP95Ms && weighted(errorRateSum, totalReq) == 0,
		Stage:         "done",
		StageMessage:  "Completed",
	}

	if err := db.UpdateJobMetrics(job); err != nil {
		return err
	}

	summary := models.Summary{
		ID:        jobID + "-summary",
		JobID:     jobID,
		TotalAPIs: len(apis),
		Notes:     "Per-API k6 runs completed.",
	}
	_ = db.CreateSummary(summary)

	return nil
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
