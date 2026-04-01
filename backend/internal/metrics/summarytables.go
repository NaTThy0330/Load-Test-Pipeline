package metrics

import (
	"encoding/json"
	"os"
	"sort"
	"strings"
)

type TrendRow struct {
	Metric string   `json:"metric"`
	Avg    *float64 `json:"avg,omitempty"`
	Max    *float64 `json:"max,omitempty"`
	Med    *float64 `json:"med,omitempty"`
	Min    *float64 `json:"min,omitempty"`
	P90    *float64 `json:"p90,omitempty"`
	P95    *float64 `json:"p95,omitempty"`
	P99    *float64 `json:"p99,omitempty"`
}

type CounterRow struct {
	Metric string  `json:"metric"`
	Count  float64 `json:"count"`
	Rate   float64 `json:"rate"`
}

type RateRow struct {
	Metric string  `json:"metric"`
	Rate   float64 `json:"rate"`
}

type GaugeRow struct {
	Metric string  `json:"metric"`
	Value  float64 `json:"value"`
}

type SummaryTables struct {
	Trends   []TrendRow   `json:"trends"`
	Counters []CounterRow `json:"counters"`
	Rates    []RateRow    `json:"rates"`
	Gauges   []GaugeRow   `json:"gauges"`
}

type summaryExport struct {
	Metrics map[string]map[string]any `json:"metrics"`
}

func BuildSummaryTables(path string) (SummaryTables, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return SummaryTables{}, err
	}
	var summary summaryExport
	if err := json.Unmarshal(data, &summary); err != nil {
		return SummaryTables{}, err
	}

	keys := make([]string, 0, len(summary.Metrics))
	for k := range summary.Metrics {
		if strings.Contains(k, "{") {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)

	out := SummaryTables{}
	for _, key := range keys {
		m := summary.Metrics[key]
		if len(m) == 0 {
			continue
		}
		if isTrendMetric(m) {
			out.Trends = append(out.Trends, TrendRow{
				Metric: key,
				Avg:    getFloatPtr(m, "avg"),
				Max:    getFloatPtr(m, "max"),
				Med:    getFloatPtr(m, "med"),
				Min:    getFloatPtr(m, "min"),
				P90:    getFloatPtr(m, "p(90)"),
				P95:    getFloatPtr(m, "p(95)"),
				P99:    getFloatPtr(m, "p(99)"),
			})
			continue
		}
		if hasKeys(m, "count", "rate") {
			count, _ := toFloat(m["count"])
			rate, _ := toFloat(m["rate"])
			out.Counters = append(out.Counters, CounterRow{
				Metric: key,
				Count:  count,
				Rate:   rate,
			})
			continue
		}
		if hasKeys(m, "value", "min") || hasKeys(m, "value", "max") {
			value, _ := toFloat(m["value"])
			out.Gauges = append(out.Gauges, GaugeRow{
				Metric: key,
				Value:  value,
			})
			continue
		}
		if hasKeys(m, "value") {
			value, _ := toFloat(m["value"])
			out.Rates = append(out.Rates, RateRow{
				Metric: key,
				Rate:   value,
			})
			continue
		}
	}

	return out, nil
}

func isTrendMetric(m map[string]any) bool {
	return hasKeys(m, "avg") || hasKeys(m, "med") || hasKeys(m, "min") ||
		hasKeys(m, "max") || hasKeys(m, "p(90)") || hasKeys(m, "p(95)") || hasKeys(m, "p(99)")
}

func hasKeys(m map[string]any, keys ...string) bool {
	for _, key := range keys {
		if _, ok := m[key]; !ok {
			return false
		}
	}
	return true
}

func getFloatPtr(m map[string]any, key string) *float64 {
	if v, ok := m[key]; ok {
		if f, ok := toFloat(v); ok {
			return &f
		}
	}
	return nil
}
