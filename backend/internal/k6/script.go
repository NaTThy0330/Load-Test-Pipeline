package k6

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"sylo/internal/models"
)

func WriteScript(outDir string, apis []models.API) (string, error) {
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
	b.WriteString("import { check, sleep } from 'k6';\n")
	b.WriteString("import { Counter } from 'k6/metrics';\n\n")
	b.WriteString("export const options = { stages: [\n")
	b.WriteString("  { duration: '30s', target: 10 },\n")
	b.WriteString("  { duration: '2m', target: 10 },\n")
	b.WriteString("  { duration: '30s', target: 0 },\n")
	b.WriteString("] };\n\n")
	b.WriteString("const bytesReceived = new Counter('bytes_received');\n")
	b.WriteString("const failedRequests = new Counter('failed_requests');\n")
	b.WriteString("const checksPassed = new Counter('checks_passed');\n")
	b.WriteString("const checksTotal = new Counter('checks_total');\n\n")
	b.WriteString("const apis = [\n")
	for _, api := range apis {
		method := strings.ToUpper(api.Method)
		if method == "" {
			method = "GET"
		}
		b.WriteString(fmt.Sprintf("  { name: %q, method: %q, url: %q },\n", api.Name, method, api.Name))
	}
	b.WriteString("];\n\n")
	b.WriteString("export default function () {\n")
	b.WriteString("  for (const api of apis) {\n")
	b.WriteString("    const res = http.request(api.method, api.url, null, { tags: { api: api.name } });\n")
	b.WriteString("    const okStatus = res.status >= 200 && res.status < 300;\n")
	b.WriteString("    const hasBody = !!(res.body && res.body.length > 0);\n")
	b.WriteString("    const checkOk = check(res, {\n")
	b.WriteString("      'status is 2xx': () => okStatus,\n")
	b.WriteString("      'body not empty': () => hasBody,\n")
	b.WriteString("    });\n")
	b.WriteString("    failedRequests.add(okStatus ? 0 : 1, { api: api.name });\n")
	b.WriteString("    checksTotal.add(1, { api: api.name });\n")
	b.WriteString("    checksPassed.add(checkOk ? 1 : 0, { api: api.name });\n")
	b.WriteString("    const headerLen = Number(res.headers['Content-Length'] || 0);\n")
	b.WriteString("    const bodyLen = res.body ? res.body.length : 0;\n")
	b.WriteString("    const size = headerLen > 0 ? headerLen : bodyLen;\n")
	b.WriteString("    bytesReceived.add(size, { api: api.name });\n")
	b.WriteString("    sleep(1);\n")
	b.WriteString("  }\n")
	b.WriteString("}\n")

	if err := os.WriteFile(scriptPath, []byte(b.String()), 0o644); err != nil {
		return "", err
	}
	return scriptPath, nil
}
