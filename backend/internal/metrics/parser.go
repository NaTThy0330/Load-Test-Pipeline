package metrics

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"sylo/internal/models"
)

type Summary struct {
	Metrics map[string]map[string]any `json:"metrics"`
	State   *State                    `json:"state"`
}

type State struct {
	TestRunDurationMs float64 `json:"testRunDurationMs"`
	TestRunDuration   string  `json:"testRunDuration"`
}

type Parsed struct {
	Overall models.Job
	Results []models.Result
	Note    string
}

func ParseSummary(path string, apis []models.API, sloP95Ms float64, jsonPath string) (Parsed, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Parsed{}, err
	}
	var summary Summary
	if err := json.Unmarshal(data, &summary); err != nil {
		return Parsed{}, err
	}

	job := models.Job{}
	if summary.State != nil {
		job.DurationSec = int(summary.State.TestRunDurationMs / 1000)
	}

	if m, ok := summary.Metrics["http_reqs"]; ok {
		if v, ok := metricValue(m, "count"); ok {
			job.TotalRequests = int(v)
		}
		if v, ok := metricValue(m, "rate"); ok {
			job.OverallRPS = v
		}
	}
	if m, ok := summary.Metrics["http_req_duration"]; ok {
		if v, ok := metricValue(m, "p(95)"); ok {
			job.OverallP95Ms = v
		}
	}
	if m, ok := summary.Metrics["http_req_failed"]; ok {
		if v, ok := metricValue(m, "rate"); ok {
			job.ErrorRatePct = v * 100
		}
	}
	if m, ok := summary.Metrics["checks"]; ok {
		if v, ok := metricValue(m, "rate"); ok {
			job.ChecksPassPct = v * 100
		}
	}

	job.SLOPass = job.OverallP95Ms > 0 && job.OverallP95Ms <= sloP95Ms && job.ErrorRatePct == 0

	results := make([]models.Result, 0, len(apis))
	missingSubmetrics := 0
	for _, api := range apis {
		res := models.Result{APIID: api.ID, JobID: api.JobID}

		if m := findSubmetric(summary.Metrics, "http_reqs", api.Name); m != nil {
			if v, ok := metricValue(m, "count"); ok {
				res.ReqCount = int(v)
			}
			if v, ok := metricValue(m, "rate"); ok {
				res.RPS = v
			}
		} else {
			missingSubmetrics++
		}
		if m := findSubmetric(summary.Metrics, "http_req_duration", api.Name); m != nil {
			if v, ok := metricValue(m, "avg"); ok {
				res.AvgMs = v
			}
			if v, ok := metricValue(m, "med"); ok {
				res.MedMs = v
			}
			if v, ok := metricValue(m, "min"); ok {
				res.MinMs = v
			}
			if v, ok := metricValue(m, "max"); ok {
				res.MaxMs = v
			}
			if v, ok := metricValue(m, "p(95)"); ok {
				res.P95Ms = v
			}
			if v, ok := metricValue(m, "p(99)"); ok {
				res.P99Ms = v
			}
		}
		if m := findSubmetric(summary.Metrics, "http_req_failed", api.Name); m != nil {
			if v, ok := metricValue(m, "rate"); ok {
				res.ErrorRatePct = v * 100
			}
		}
		if m := findSubmetric(summary.Metrics, "bytes_received", api.Name); m != nil {
			if v, ok := metricValue(m, "rate"); ok {
				res.ThroughputBps = v
			}
		}
		res.SLOPass = res.P95Ms > 0 && res.P95Ms <= sloP95Ms && res.ErrorRatePct == 0

		results = append(results, res)
	}

	note := ""
	if len(apis) == 1 && jsonPath != "" {
		aggResults, durationSec, err := parseK6JSON(jsonPath)
		if err == nil {
			results = buildResultsFromAgg(apis, aggResults, durationSec, sloP95Ms)
			applyOverallFromAgg(&job, aggResults, durationSec)
			if job.DurationSec == 0 && durationSec > 0 {
				job.DurationSec = int(durationSec)
			}
			if job.TotalRequests == 0 {
				for _, r := range results {
					job.TotalRequests += r.ReqCount
				}
			}
			if job.OverallRPS == 0 && durationSec > 0 {
				job.OverallRPS = float64(job.TotalRequests) / durationSec
			}
			note = "Per-API metrics computed from k6 JSON output."
		}
	}

	if missingSubmetrics == len(apis) && len(apis) > 1 && jsonPath != "" {
		aggResults, durationSec, err := parseK6JSON(jsonPath)
		if err == nil {
			results = buildResultsFromAgg(apis, aggResults, durationSec, sloP95Ms)
			applyOverallFromAgg(&job, aggResults, durationSec)
			if job.DurationSec == 0 && durationSec > 0 {
				job.DurationSec = int(durationSec)
			}
			if job.TotalRequests == 0 {
				for _, r := range results {
					job.TotalRequests += r.ReqCount
				}
			}
			if job.OverallRPS == 0 && durationSec > 0 {
				job.OverallRPS = float64(job.TotalRequests) / durationSec
			}
			note = "Per-API metrics computed from k6 JSON output (summary export had no tag submetrics)."
		}
	}

	job.SLOPass = job.OverallP95Ms > 0 && job.OverallP95Ms <= sloP95Ms && job.ErrorRatePct == 0
	return Parsed{Overall: job, Results: results, Note: note}, nil
}

func applyOverallFromAgg(job *models.Job, aggs map[string]*agg, durationSec float64) {
	var totalReq int
	var failed int
	var checksPass int
	var checksTotal int
	for _, a := range aggs {
		totalReq += a.count
		failed += a.failedCount
		checksPass += a.checksPass
		checksTotal += a.checksTotal
	}
	if totalReq > 0 {
		job.TotalRequests = totalReq
		job.ErrorRatePct = float64(failed) / float64(totalReq) * 100
	}
	if durationSec > 0 && totalReq > 0 {
		job.OverallRPS = float64(totalReq) / durationSec
	}
	if checksTotal > 0 {
		job.ChecksPassPct = float64(checksPass) / float64(checksTotal) * 100
	}
}

func findSubmetric(metrics map[string]map[string]any, metricName, api string) map[string]any {
	metric, ok := metrics[metricName]
	if !ok {
		return nil
	}
	submetrics, ok := metric["submetrics"].(map[string]any)
	if !ok {
		return nil
	}
	for key, subAny := range submetrics {
		sub, ok := subAny.(map[string]any)
		if !ok {
			continue
		}
		if !strings.Contains(key, "api:") {
			continue
		}
		apiTag := parseAPITag(key)
		if apiTag == api {
			return sub
		}
	}
	return nil
}

func parseAPITag(key string) string {
	start := strings.Index(key, "{")
	end := strings.LastIndex(key, "}")
	if start == -1 || end == -1 || end <= start {
		return ""
	}
	inside := key[start+1 : end]
	parts := strings.Split(inside, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "api:") {
			return strings.TrimPrefix(part, "api:")
		}
	}
	return ""
}

func DebugSummary(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var summary Summary
	if err := json.Unmarshal(data, &summary); err != nil {
		return err
	}
	return fmt.Errorf("summary keys: %v", keys(summary.Metrics))
}

func keys(m map[string]map[string]any) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

func metricValue(m map[string]any, key string) (float64, bool) {
	if values, ok := m["values"].(map[string]any); ok {
		if v, ok := values[key]; ok {
			return toFloat(v)
		}
	}
	if v, ok := m[key]; ok {
		return toFloat(v)
	}
	return 0, false
}

func toFloat(v any) (float64, bool) {
	switch t := v.(type) {
	case float64:
		return t, true
	case int:
		return float64(t), true
	case int64:
		return float64(t), true
	case json.Number:
		f, err := t.Float64()
		return f, err == nil
	default:
		return 0, false
	}
}

type agg struct {
	count       int
	sum         float64
	min         float64
	max         float64
	values      []float64
	failedCount int
	bytesRecv   float64
	checksPass  int
	checksTotal int
}

type k6Point struct {
	Type   string         `json:"type"`
	Metric string         `json:"metric"`
	Data   map[string]any `json:"data"`
}

func parseK6JSON(path string) (map[string]*agg, float64, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, 0, err
	}
	defer f.Close()

	aggs := map[string]*agg{}
	var start, end time.Time

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Bytes()
		var pt k6Point
		if err := json.Unmarshal(line, &pt); err != nil {
			continue
		}
		if pt.Type != "Point" {
			continue
		}
		tags, _ := pt.Data["tags"].(map[string]any)
		apiTag, _ := tags["api"].(string)
		if apiTag == "" {
			continue
		}
		val, ok := toFloat(pt.Data["value"])
		if !ok {
			continue
		}
		timeStr, _ := pt.Data["time"].(string)
		if timeStr != "" {
			ts, err := time.Parse(time.RFC3339Nano, timeStr)
			if err == nil {
				if start.IsZero() || ts.Before(start) {
					start = ts
				}
				if end.IsZero() || ts.After(end) {
					end = ts
				}
			}
		}

		a := aggs[apiTag]
		if a == nil {
			a = &agg{min: val, max: val}
			aggs[apiTag] = a
		}

		switch pt.Metric {
		case "http_req_duration":
			a.count++
			a.sum += val
			if val < a.min {
				a.min = val
			}
			if val > a.max {
				a.max = val
			}
			a.values = append(a.values, val)
		case "failed_requests":
			a.failedCount += int(val)
		case "bytes_received":
			a.bytesRecv += val
		case "checks_passed":
			a.checksPass += int(val)
		case "checks_total":
			a.checksTotal += int(val)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, 0, err
	}

	durationSec := 0.0
	if !start.IsZero() && !end.IsZero() {
		durationSec = end.Sub(start).Seconds()
		if durationSec < 1 {
			durationSec = 1
		}
	}
	return aggs, durationSec, nil
}

func buildResultsFromAgg(apis []models.API, aggs map[string]*agg, durationSec float64, sloP95Ms float64) []models.Result {
	results := make([]models.Result, 0, len(apis))
	for _, api := range apis {
		a := aggs[api.Name]
		res := models.Result{APIID: api.ID, JobID: api.JobID}
		if a == nil || a.count == 0 {
			results = append(results, res)
			continue
		}
		res.ReqCount = a.count
		if durationSec > 0 {
			res.RPS = float64(a.count) / durationSec
			res.ThroughputBps = a.bytesRecv / durationSec
		}
		res.AvgMs = a.sum / float64(a.count)
		res.MinMs = a.min
		res.MaxMs = a.max
		sort.Float64s(a.values)
		res.MedMs = percentile(a.values, 0.5)
		res.P95Ms = percentile(a.values, 0.95)
		res.P99Ms = percentile(a.values, 0.99)
		res.ErrorRatePct = float64(a.failedCount) / float64(a.count) * 100
		res.SLOPass = res.P95Ms > 0 && res.P95Ms <= sloP95Ms && res.ErrorRatePct == 0
		results = append(results, res)
	}
	return results
}

func percentile(values []float64, p float64) float64 {
	if len(values) == 0 {
		return 0
	}
	if p <= 0 {
		return values[0]
	}
	if p >= 1 {
		return values[len(values)-1]
	}
	pos := p * float64(len(values)-1)
	idx := int(pos)
	if idx >= len(values)-1 {
		return values[len(values)-1]
	}
	frac := pos - float64(idx)
	return values[idx] + (values[idx+1]-values[idx])*frac
}
