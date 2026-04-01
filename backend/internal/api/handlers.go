package api

import (
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"sylo/internal/jobs"
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
	APIs []models.API `json:"apis"`
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

func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(corsMiddleware)

	r.Post("/api/upload", s.handleUpload)
	r.Post("/api/jobs", s.handleCreateJob)
	r.Post("/api/jobs/{id}/run", s.handleRunJob)
	r.Get("/api/jobs/{id}/status", s.handleJobStatus)
	r.Get("/api/jobs/{id}/results", s.handleJobResults)
	r.Get("/api/jobs/{id}/logs", s.handleJobLogs)

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

	jobID := uuid.NewString()
	job := models.Job{
		ID:        jobID,
		CreatedAt: storage.NowISO(),
		Status:    "queued",
		TestType:  "load",
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

func (s *Server) handleJobLogs(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "id")
	stdout, _ := os.ReadFile(filepath.Join("data", "runs", jobID, "k6_stdout.log"))
	stderr, _ := os.ReadFile(filepath.Join("data", "runs", jobID, "k6_stderr.log"))
	writeJSON(w, http.StatusOK, map[string]string{
		"stdout": string(stdout),
		"stderr": string(stderr),
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
	expected := 3 * time.Minute
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
