package api

import (
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"sylo/internal/jobs"
	"sylo/internal/metrics"
	"sylo/internal/models"
	"sylo/internal/parser"
	"sylo/internal/storage"
)

type Server struct {
	db *storage.DB
}

func NewServer(db *storage.DB) *Server {
	return &Server{db: db}
}

type uploadResponse struct {
	Files []string     `json:"files"`
	APIs  []models.API `json:"apis"`
	Count int          `json:"count"`
}

type createJobRequest struct {
	APIs   []models.API      `json:"apis"`
	Config *models.JobConfig `json:"config"`
}

type createJobResponse struct {
	Job  models.Job   `json:"job"`
	APIs []models.API `json:"apis"`
}

type resultsResponse struct {
	Job     models.Job      `json:"job"`
	Summary models.Summary  `json:"summary"`
	APIs    []models.API    `json:"apis"`
	Results []models.Result `json:"results"`
}

type statusResponse struct {
	Job        models.Job `json:"job"`
	Progress   float64    `json:"progress"`
	ETASeconds int        `json:"eta_seconds"`
}

type apiDetailSummary struct {
	DurationSec   int     `json:"duration_sec"`
	TotalRequests int     `json:"total_requests"`
	ChecksPassPct float64 `json:"checks_pass_pct"`
	SLOPass       bool    `json:"slo_pass"`
	P95Ms         float64 `json:"p95_ms"`
	P99Ms         float64 `json:"p99_ms"`
	ErrorRatePct  float64 `json:"error_rate_pct"`
	AvgMs         float64 `json:"avg_ms"`
	MedMs         float64 `json:"med_ms"`
	MinMs         float64 `json:"min_ms"`
	MaxMs         float64 `json:"max_ms"`
	RPS           float64 `json:"rps"`
	ThroughputBps float64 `json:"throughput_bps"`
}

type apiDetailResponse struct {
	Job     models.Job            `json:"job"`
	API     models.API            `json:"api"`
	Result  models.Result         `json:"result"`
	Summary apiDetailSummary      `json:"summary"`
	Series  metrics.TimeSeries    `json:"series"`
	Tables  metrics.SummaryTables `json:"summary_tables"`
}

func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(corsMiddleware)

	r.Post("/api/upload", s.handleUpload)
	r.Post("/api/jobs", s.handleCreateJob)
	r.Post("/api/jobs/{id}/run", s.handleRunJob)
	r.Get("/api/jobs/{id}/status", s.handleJobStatus)
	r.Get("/api/jobs/{id}/results", s.handleJobResults)
	r.Get("/api/jobs/{id}/logs", s.handleJobLogs)
	r.Get("/api/jobs/{id}/apis/{apiId}", s.handleJobAPI)

	return r
}

func (s *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "invalid multipart form")
		return
	}

	files := make([]*multipart.FileHeader, 0)
	for _, headers := range r.MultipartForm.File {
		files = append(files, headers...)
	}
	if len(files) == 0 {
		writeError(w, http.StatusBadRequest, "no files uploaded")
		return
	}

	var saved []string
	var apis []models.API
	seen := map[string]bool{}

	for _, header := range files {
		path, err := saveUpload(header)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		saved = append(saved, path)
		list, err := parser.ExtractAPIsFromFile(path)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		for _, api := range list {
			if seen[api.Name] {
				continue
			}
			seen[api.Name] = true
			apis = append(apis, api)
		}
	}

	writeJSON(w, http.StatusOK, uploadResponse{Files: saved, APIs: apis, Count: len(apis)})
}

func (s *Server) handleCreateJob(w http.ResponseWriter, r *http.Request) {
	var req createJobRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if len(req.APIs) == 0 {
		writeError(w, http.StatusBadRequest, "apis required")
		return
	}
	if err := validateAPIs(req.APIs); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	jobID := uuid.NewString()
	cfg := normalizeJobConfig(req.Config)
	job := models.Job{
		ID:                      jobID,
		CreatedAt:               storage.NowISO(),
		Status:                  "queued",
		TestType:                "load",
		ConfigVUs:               cfg.VUs,
		ConfigRampUpSec:         cfg.RampUpSec,
		ConfigDurationSec:       cfg.DurationSec,
		ConfigRampDownSec:       cfg.RampDownSec,
		ThresholdP95Ms:          cfg.P95Ms,
		ThresholdP99Ms:          cfg.P99Ms,
		ThresholdErrorRatePct:   cfg.ErrorRatePct,
		ThresholdSuccessRatePct: cfg.SuccessRatePct,
	}
	if err := s.db.CreateJob(job); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	apis := make([]models.API, 0, len(req.APIs))
	for _, api := range req.APIs {
		api.ID = uuid.NewString()
		api.JobID = jobID
		api.Method = strings.ToUpper(strings.TrimSpace(api.Method))
		if api.Method == "" {
			api.Method = "GET"
		}
		apis = append(apis, api)
	}

	if err := s.db.CreateAPIs(apis); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	_ = s.db.TouchSummary(jobID, len(apis), "")

	writeJSON(w, http.StatusOK, createJobResponse{Job: job, APIs: apis})
}

func validateAPIs(apis []models.API) error {
	var errors []string
	for i, api := range apis {
		label := strings.TrimSpace(api.Name)
		if label == "" {
			label = fmt.Sprintf("API #%d", i+1)
		}
		method := strings.ToUpper(strings.TrimSpace(api.Method))
		if method == "" {
			method = "GET"
		}
		if method != "GET" && method != "POST" {
			errors = append(errors, fmt.Sprintf("%s: method must be GET or POST", label))
		}
		if strings.TrimSpace(api.Headers) != "" && !parser.IsValidJSON(api.Headers) {
			errors = append(errors, fmt.Sprintf("%s: headers must be valid JSON", label))
		}
		if strings.TrimSpace(api.QueryParams) != "" && !parser.IsValidJSON(api.QueryParams) {
			errors = append(errors, fmt.Sprintf("%s: query must be valid JSON", label))
		}
		if strings.TrimSpace(api.Body) != "" && !parser.IsValidJSON(api.Body) {
			errors = append(errors, fmt.Sprintf("%s: body must be valid JSON", label))
		}
		if method == "POST" && strings.TrimSpace(api.Body) == "" {
			errors = append(errors, fmt.Sprintf("%s: body required for POST", label))
		}
	}
	if len(errors) > 0 {
		return fmt.Errorf("api validation errors:\n- %s", strings.Join(errors, "\n- "))
	}
	return nil
}

func normalizeJobConfig(cfg *models.JobConfig) models.JobConfig {
	defaults := models.JobConfig{
		VUs:            100,
		RampUpSec:      300,
		DurationSec:    600,
		RampDownSec:    120,
		P95Ms:          500,
		P99Ms:          1000,
		ErrorRatePct:   0.1,
		SuccessRatePct: 99.9,
	}
	if cfg == nil {
		return defaults
	}
	out := defaults
	if cfg.VUs > 0 {
		out.VUs = cfg.VUs
	}
	if cfg.RampUpSec > 0 {
		out.RampUpSec = cfg.RampUpSec
	}
	if cfg.DurationSec > 0 {
		out.DurationSec = cfg.DurationSec
	}
	if cfg.RampDownSec > 0 {
		out.RampDownSec = cfg.RampDownSec
	}
	if cfg.P95Ms > 0 {
		out.P95Ms = cfg.P95Ms
	}
	if cfg.P99Ms > 0 {
		out.P99Ms = cfg.P99Ms
	}
	if cfg.ErrorRatePct >= 0 {
		out.ErrorRatePct = cfg.ErrorRatePct
	}
	if cfg.SuccessRatePct > 0 {
		out.SuccessRatePct = cfg.SuccessRatePct
	}
	return out
}

func (s *Server) handleRunJob(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "id")
	if jobID == "" {
		writeError(w, http.StatusBadRequest, "job id required")
		return
	}

	go func() {
		_ = jobs.Run(s.db, jobID)
	}()

	writeJSON(w, http.StatusAccepted, map[string]string{"status": "started"})
}

func (s *Server) handleJobStatus(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "id")
	job, err := s.db.GetJob(jobID)
	if err != nil {
		if storage.IsNotFound(err) {
			writeError(w, http.StatusNotFound, "job not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	progress, eta := estimateProgress(job)
	writeJSON(w, http.StatusOK, statusResponse{Job: job, Progress: progress, ETASeconds: eta})
}

func (s *Server) handleJobResults(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "id")
	job, err := s.db.GetJob(jobID)
	if err != nil {
		if storage.IsNotFound(err) {
			writeError(w, http.StatusNotFound, "job not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	apis, err := s.db.ListAPIsByJob(jobID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	results, err := s.db.ListResultsByJob(jobID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	summary, err := s.db.GetSummary(jobID)
	if err != nil {
		if storage.IsNotFound(err) {
			summary = models.Summary{ID: jobID + "-summary", JobID: jobID, TotalAPIs: len(apis), Notes: ""}
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	writeJSON(w, http.StatusOK, resultsResponse{Job: job, Summary: summary, APIs: apis, Results: results})
}

func (s *Server) handleJobAPI(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "id")
	apiID := chi.URLParam(r, "apiId")
	if jobID == "" || apiID == "" {
		writeError(w, http.StatusBadRequest, "job id and api id required")
		return
	}

	job, err := s.db.GetJob(jobID)
	if err != nil {
		if storage.IsNotFound(err) {
			writeError(w, http.StatusNotFound, "job not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	apis, err := s.db.ListAPIsByJob(jobID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var api models.API
	found := false
	for _, item := range apis {
		if item.ID == apiID {
			api = item
			found = true
			break
		}
	}
	if !found {
		writeError(w, http.StatusNotFound, "api not found")
		return
	}

	results, err := s.db.ListResultsByJob(jobID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var result models.Result
	for _, item := range results {
		if item.APIID == apiID {
			result = item
			break
		}
	}

	series := metrics.TimeSeries{}
	tables := metrics.SummaryTables{}
	runDir := filepath.Join("data", "runs", jobID, api.ID)
	jsonPath := filepath.Join(runDir, "k6_out.json")
	if _, err := os.Stat(jsonPath); err == nil {
		if sData, err := metrics.BuildTimeSeries(jsonPath, api.Name); err == nil {
			series = sData
		}
	}
	summaryPath := filepath.Join(runDir, "summary.json")
	if _, err := os.Stat(summaryPath); err == nil {
		if tData, err := metrics.BuildSummaryTables(summaryPath); err == nil {
			tables = tData
		}
	}

	summary := apiDetailSummary{
		DurationSec:   job.DurationSec,
		TotalRequests: result.ReqCount,
		ChecksPassPct: job.ChecksPassPct,
		SLOPass:       result.SLOPass,
		P95Ms:         result.P95Ms,
		P99Ms:         result.P99Ms,
		ErrorRatePct:  result.ErrorRatePct,
		AvgMs:         result.AvgMs,
		MedMs:         result.MedMs,
		MinMs:         result.MinMs,
		MaxMs:         result.MaxMs,
		RPS:           result.RPS,
		ThroughputBps: result.ThroughputBps,
	}
	if summary.DurationSec == 0 && series.DurationSec > 0 {
		summary.DurationSec = series.DurationSec
	}

	writeJSON(w, http.StatusOK, apiDetailResponse{
		Job:     job,
		API:     api,
		Result:  result,
		Summary: summary,
		Series:  series,
		Tables:  tables,
	})
}

func (s *Server) handleJobLogs(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "id")
	baseDir := filepath.Join("data", "runs", jobID)
	var stdoutParts []string
	var stderrParts []string
	_ = filepath.WalkDir(baseDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		name := d.Name()
		if name != "k6_stdout.log" && name != "k6_stderr.log" {
			return nil
		}
		data, readErr := os.ReadFile(path)
		if readErr != nil || len(data) == 0 {
			return nil
		}
		apiID := filepath.Base(filepath.Dir(path))
		chunk := fmt.Sprintf("== %s ==\n%s", apiID, strings.TrimSpace(string(data)))
		if name == "k6_stdout.log" {
			stdoutParts = append(stdoutParts, chunk)
		} else {
			stderrParts = append(stderrParts, chunk)
		}
		return nil
	})
	writeJSON(w, http.StatusOK, map[string]string{
		"stdout": strings.Join(stdoutParts, "\n\n"),
		"stderr": strings.Join(stderrParts, "\n\n"),
	})
}

func saveUpload(header *multipart.FileHeader) (string, error) {
	file, err := header.Open()
	if err != nil {
		return "", err
	}
	defer file.Close()

	id := uuid.NewString()
	name := filepath.Base(header.Filename)
	path := filepath.Join("data", "uploads", fmt.Sprintf("%s_%s", id, name))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return "", err
	}
	out, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		return "", err
	}
	return path, nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func estimateProgress(job models.Job) (float64, int) {
	if job.Status != "running" {
		return 0, 0
	}
	if job.StartedAt == "" {
		return 0, 0
	}
	started, err := time.Parse(time.RFC3339, job.StartedAt)
	if err != nil {
		return 0, 0
	}
	elapsed := time.Since(started)
	expected := time.Duration(totalExpectedSeconds(job)) * time.Second
	progress := float64(elapsed) / float64(expected)
	if progress > 1 {
		progress = 1
	}
	eta := int((expected - elapsed).Seconds())
	if eta < 0 {
		eta = 0
	}
	return progress, eta
}

func totalExpectedSeconds(job models.Job) int {
	rampUp := job.ConfigRampUpSec
	duration := job.ConfigDurationSec
	rampDown := job.ConfigRampDownSec
	if rampUp <= 0 {
		rampUp = 300
	}
	if duration <= 0 {
		duration = 600
	}
	if rampDown <= 0 {
		rampDown = 120
	}
	total := rampUp + duration + rampDown
	if total <= 0 {
		return 180
	}
	return total
}
