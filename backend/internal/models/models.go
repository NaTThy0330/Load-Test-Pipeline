package models

type API struct {
	ID          string `json:"id"`
	JobID       string `json:"job_id"`
	Name        string `json:"name"`
	Method      string `json:"method"`
	Description string `json:"description"`
}

type Job struct {
	ID            string  `json:"id"`
	CreatedAt     string  `json:"created_at"`
	StartedAt     string  `json:"started_at"`
	FinishedAt    string  `json:"finished_at"`
	Status        string  `json:"status"`
	Stage         string  `json:"stage"`
	StageMessage  string  `json:"stage_message"`
	TestType      string  `json:"test_type"`
	DurationSec   int     `json:"duration_sec"`
	TotalRequests int     `json:"total_requests"`
	OverallRPS    float64 `json:"overall_rps"`
	OverallP95Ms  float64 `json:"overall_p95_ms"`
	ErrorRatePct  float64 `json:"error_rate_pct"`
	ChecksPassPct float64 `json:"checks_pass_pct"`
	SLOPass       bool    `json:"slo_pass"`
}

type Result struct {
	ID            string  `json:"id"`
	JobID         string  `json:"job_id"`
	APIID         string  `json:"api_id"`
	ReqCount      int     `json:"req_count"`
	RPS           float64 `json:"rps"`
	AvgMs         float64 `json:"avg_ms"`
	MedMs         float64 `json:"med_ms"`
	P95Ms         float64 `json:"p95_ms"`
	P99Ms         float64 `json:"p99_ms"`
	MinMs         float64 `json:"min_ms"`
	MaxMs         float64 `json:"max_ms"`
	ErrorRatePct  float64 `json:"error_rate_pct"`
	ThroughputBps float64 `json:"throughput_bps"`
	SLOPass       bool    `json:"slo_pass"`
}

type Summary struct {
	ID        string `json:"id"`
	JobID     string `json:"job_id"`
	TotalAPIs int    `json:"total_apis"`
	Notes     string `json:"notes"`
}
