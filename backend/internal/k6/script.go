package k6

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"sylo/internal/models"
)

func WriteScript(outDir string, apis []models.API, job models.Job) (string, error) {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return "", err
	}
	absDir, err := filepath.Abs(outDir)
	if err != nil {
		return "", err
	}
	scriptPath := filepath.Join(absDir, "test.js")

	var b strings.Builder
	b.WriteString("import http from 'k6/http';\n")
	b.WriteString("import { check, sleep } from 'k6';\n\n")
	b.WriteString("export const options = {\n")
	b.WriteString("  stages: [\n")
	b.WriteString(fmt.Sprintf("    { duration: '%ds', target: %d },\n", job.ConfigRampUpSec, job.ConfigVUs))
	b.WriteString(fmt.Sprintf("    { duration: '%ds', target: %d },\n", job.ConfigDurationSec, job.ConfigVUs))
	b.WriteString(fmt.Sprintf("    { duration: '%ds', target: 0 },\n", job.ConfigRampDownSec))
	b.WriteString("  ],\n")
	b.WriteString("  thresholds: {\n")
	b.WriteString(fmt.Sprintf("    http_req_duration: ['p(95)<%s', 'p(99)<%s'],\n", formatFloat(job.ThresholdP95Ms), formatFloat(job.ThresholdP99Ms)))
	b.WriteString(fmt.Sprintf("    http_req_failed: ['rate<%s'],\n", formatFloat(job.ThresholdErrorRatePct/100)))
	b.WriteString("  },\n")
	b.WriteString("};\n\n")
	b.WriteString("const apis = [\n")
	for _, api := range apis {
		method := strings.ToUpper(api.Method)
		if method == "" {
			method = "GET"
		}
		b.WriteString("  {\n")
		b.WriteString(fmt.Sprintf("    name: %s,\n", jsString(api.Name)))
		b.WriteString(fmt.Sprintf("    method: %s,\n", jsString(method)))
		b.WriteString(fmt.Sprintf("    url: %s,\n", jsString(api.Name)))
		b.WriteString(fmt.Sprintf("    headers: %s,\n", jsString(api.Headers)))
		b.WriteString(fmt.Sprintf("    query: %s,\n", jsString(api.QueryParams)))
		b.WriteString(fmt.Sprintf("    authorization: %s,\n", jsString(api.Authorization)))
		b.WriteString(fmt.Sprintf("    body: %s,\n", jsString(api.Body)))
		b.WriteString("  },\n")
	}
	b.WriteString("];\n\n")
	b.WriteString("function buildHeaders(api) {\n")
	b.WriteString("  let headers = {};\n")
	b.WriteString("  if (api.headers) {\n")
	b.WriteString("    try { headers = JSON.parse(api.headers); } catch (e) { headers = {}; }\n")
	b.WriteString("  }\n")
	b.WriteString("  if (api.authorization) {\n")
	b.WriteString("    headers['Authorization'] = api.authorization;\n")
	b.WriteString("  }\n")
	b.WriteString("  return headers;\n")
	b.WriteString("}\n\n")
	b.WriteString("function buildQueryString(api) {\n")
	b.WriteString("  if (!api.query) return '';\n")
	b.WriteString("  let params = {};\n")
	b.WriteString("  try { params = JSON.parse(api.query); } catch (e) { return ''; }\n")
	b.WriteString("  const parts = [];\n")
	b.WriteString("  for (const key in params) {\n")
	b.WriteString("    const val = params[key];\n")
	b.WriteString("    if (Array.isArray(val)) {\n")
	b.WriteString("      for (const v of val) {\n")
	b.WriteString("        if (v === null || v === undefined) continue;\n")
	b.WriteString("        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));\n")
	b.WriteString("      }\n")
	b.WriteString("    } else if (val !== null && val !== undefined) {\n")
	b.WriteString("      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(val)));\n")
	b.WriteString("    }\n")
	b.WriteString("  }\n")
	b.WriteString("  if (parts.length === 0) return '';\n")
	b.WriteString("  const qs = parts.join('&');\n")
	b.WriteString("  return api.url.includes('?') ? '&' + qs : '?' + qs;\n")
	b.WriteString("}\n\n")
	b.WriteString("export default function () {\n")
	b.WriteString("  for (const api of apis) {\n")
	b.WriteString("    const headers = buildHeaders(api);\n")
	b.WriteString("    const url = api.url + buildQueryString(api);\n")
	b.WriteString("    const body = api.method === 'POST' ? (api.body || null) : null;\n")
	b.WriteString("    const res = http.request(api.method, url, body, { headers, tags: { api: api.name } });\n")
	b.WriteString("    check(res, {\n")
	b.WriteString("      'status is 2xx': (r) => r.status >= 200 && r.status < 300,\n")
	b.WriteString("      'body not empty': (r) => r.body && r.body.length > 0,\n")
	b.WriteString("    });\n")
	b.WriteString("    sleep(1);\n")
	b.WriteString("  }\n")
	b.WriteString("}\n")

	if err := os.WriteFile(scriptPath, []byte(b.String()), 0o644); err != nil {
		return "", err
	}
	return scriptPath, nil
}

func jsString(value string) string {
	if value == "" {
		return "''"
	}
	return strconv.Quote(value)
}

func formatFloat(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}
