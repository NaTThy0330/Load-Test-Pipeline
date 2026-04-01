package metrics

import (
	"bufio"
	"encoding/json"
	"os"
	"sort"
	"time"
)

type TimeSeriesPoint struct {
	T string  `json:"t"`
	V float64 `json:"v"`
}

type TimeSeries struct {
	DurationP95 []TimeSeriesPoint `json:"http_req_duration_p95"`
	RequestRate []TimeSeriesPoint `json:"http_reqs"`
	ErrorRate   []TimeSeriesPoint `json:"http_req_failed"`
	VUs         []TimeSeriesPoint `json:"vus"`
	DurationSec int               `json:"duration_sec"`
}

type seriesBucket struct {
	durations []float64
	reqCount  int
	failCount int
	vus       *float64
}

func BuildTimeSeries(path, apiName string) (TimeSeries, error) {
	f, err := os.Open(path)
	if err != nil {
		return TimeSeries{}, err
	}
	defer f.Close()

	buckets := map[int64]*seriesBucket{}
	var minTime time.Time
	var maxTime time.Time

	updateRange := func(ts time.Time) {
		if minTime.IsZero() || ts.Before(minTime) {
			minTime = ts
		}
		if maxTime.IsZero() || ts.After(maxTime) {
			maxTime = ts
		}
	}

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 1024*1024), 10*1024*1024)
	for scanner.Scan() {
		var pt k6Point
		if err := json.Unmarshal(scanner.Bytes(), &pt); err != nil {
			continue
		}
		if pt.Type != "Point" {
			continue
		}
		timeStr, _ := pt.Data["time"].(string)
		if timeStr == "" {
			continue
		}
		ts, err := time.Parse(time.RFC3339Nano, timeStr)
		if err != nil {
			continue
		}
		sec := ts.Unix()

		switch pt.Metric {
		case "vus":
			val, ok := toFloat(pt.Data["value"])
			if !ok {
				continue
			}
			b := buckets[sec]
			if b == nil {
				b = &seriesBucket{}
				buckets[sec] = b
			}
			b.vus = &val
			updateRange(ts)
			continue
		case "http_req_duration", "http_reqs", "http_req_failed":
		default:
			continue
		}

		tags, _ := pt.Data["tags"].(map[string]any)
		apiTag, _ := tags["api"].(string)
		if apiTag == "" || apiTag != apiName {
			continue
		}
		val, ok := toFloat(pt.Data["value"])
		if !ok {
			continue
		}
		b := buckets[sec]
		if b == nil {
			b = &seriesBucket{}
			buckets[sec] = b
		}
		switch pt.Metric {
		case "http_req_duration":
			b.durations = append(b.durations, val)
		case "http_reqs":
			b.reqCount += int(val)
		case "http_req_failed":
			b.failCount += int(val)
		}
		updateRange(ts)
	}
	if err := scanner.Err(); err != nil {
		return TimeSeries{}, err
	}

	if minTime.IsZero() || maxTime.IsZero() {
		return TimeSeries{}, nil
	}

	minSec := minTime.Unix()
	maxSec := maxTime.Unix()
	points := int(maxSec-minSec) + 1
	keys := make([]int64, 0, points)
	for sec := minSec; sec <= maxSec; sec++ {
		keys = append(keys, sec)
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })

	var series TimeSeries
	series.DurationP95 = make([]TimeSeriesPoint, 0, len(keys))
	series.RequestRate = make([]TimeSeriesPoint, 0, len(keys))
	series.ErrorRate = make([]TimeSeriesPoint, 0, len(keys))
	series.VUs = make([]TimeSeriesPoint, 0, len(keys))
	series.DurationSec = points

	var lastVus *float64
	for _, sec := range keys {
		t := time.Unix(sec, 0).Format(time.RFC3339)
		b := buckets[sec]
		if b == nil {
			b = &seriesBucket{}
		}
		if len(b.durations) > 0 {
			p95 := percentileSeries(b.durations, 0.95)
			series.DurationP95 = append(series.DurationP95, TimeSeriesPoint{T: t, V: p95})
		}
		series.RequestRate = append(series.RequestRate, TimeSeriesPoint{T: t, V: float64(b.reqCount)})
		if b.reqCount > 0 {
			series.ErrorRate = append(series.ErrorRate, TimeSeriesPoint{T: t, V: float64(b.failCount) / float64(b.reqCount) * 100})
		} else {
			series.ErrorRate = append(series.ErrorRate, TimeSeriesPoint{T: t, V: 0})
		}
		if b.vus != nil {
			lastVus = b.vus
		}
		if lastVus != nil {
			series.VUs = append(series.VUs, TimeSeriesPoint{T: t, V: *lastVus})
		}
	}

	return series, nil
}

func percentileSeries(values []float64, p float64) float64 {
	if len(values) == 0 {
		return 0
	}
	if p <= 0 {
		return values[0]
	}
	if p >= 1 {
		return values[len(values)-1]
	}
	sort.Float64s(values)
	pos := p * float64(len(values)-1)
	idx := int(pos)
	if idx >= len(values)-1 {
		return values[len(values)-1]
	}
	frac := pos - float64(idx)
	return values[idx] + (values[idx+1]-values[idx])*frac
}
