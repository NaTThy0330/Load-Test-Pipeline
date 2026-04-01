package parser

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/ledongthuc/pdf"

	"sylo/internal/models"
)

var (
	reFullURL = regexp.MustCompile(`https?://[^\s"'<>]+`)
	rePath    = regexp.MustCompile(`\/[a-zA-Z0-9_\-./]+`)
)

func ExtractAPIsFromFile(path string) ([]models.API, error) {
	ext := strings.ToLower(filepath.Ext(path))
	if ext == ".csv" {
		return extractAPIsFromCSV(path)
	}
	text, err := readText(path)
	if err != nil {
		return nil, err
	}
	urls := reFullURL.FindAllString(text, -1)
	paths := rePath.FindAllString(text, -1)

	seen := map[string]bool{}
	var apis []models.API

	add := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		if seen[value] {
			return
		}
		seen[value] = true
		apis = append(apis, models.API{
			Name:        value,
			Method:      "GET",
			Description: "",
		})
	}

	for _, u := range urls {
		add(u)
	}
	for _, p := range paths {
		if strings.Contains(p, ".") && !strings.HasPrefix(p, "/api") && !strings.HasPrefix(p, "/v") {
			continue
		}
		add(p)
	}

	if len(apis) == 0 {
		base := filepath.Base(path)
		_ = base
	}
	return apis, nil
}

func readText(path string) (string, error) {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".pdf":
		return readPDFText(path)
	default:
		data, err := os.ReadFile(path)
		if err != nil {
			return "", err
		}
		return string(data), nil
	}
}

func readPDFText(path string) (string, error) {
	f, r, err := pdf.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	var b strings.Builder
	totalPage := r.NumPage()
	for i := 1; i <= totalPage; i++ {
		p := r.Page(i)
		if p.V.IsNull() {
			continue
		}
		text, err := p.GetPlainText(nil)
		if err != nil && err != io.EOF {
			return "", err
		}
		b.WriteString(text)
		b.WriteString("\n")
	}
	return b.String(), nil
}

func extractAPIsFromCSV(path string) ([]models.API, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	reader := csv.NewReader(f)
	reader.FieldsPerRecord = -1
	reader.TrimLeadingSpace = true

	header, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("csv: read header: %w", err)
	}

	colIndex := map[string]int{}
	for i, h := range header {
		key := normalizeHeader(h)
		if key == "" {
			continue
		}
		colIndex[key] = i
	}

	getIndex := func(keys ...string) int {
		for _, k := range keys {
			if idx, ok := colIndex[k]; ok {
				return idx
			}
		}
		return -1
	}

	idxPath := getIndex("apipath", "api", "url", "endpoint", "path")
	idxMethod := getIndex("httpmethod", "method")
	idxHeaders := getIndex("headers", "header")
	idxQuery := getIndex("queryparameter", "queryparams", "query", "params", "parameters")
	idxAuth := getIndex("authorization", "auth")
	idxBody := getIndex("body", "payload")

	if idxPath == -1 {
		return nil, fmt.Errorf("csv: missing required column api_path")
	}

	var apis []models.API
	line := 1
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		line++
		if err != nil {
			return nil, fmt.Errorf("csv: read line %d: %w", line, err)
		}

		pathVal := getValue(record, idxPath)
		if strings.TrimSpace(pathVal) == "" {
			continue
		}

		method := strings.ToUpper(strings.TrimSpace(getValue(record, idxMethod)))
		if method == "" {
			method = "GET"
		}
		if method != "GET" && method != "POST" {
			return nil, fmt.Errorf("csv: invalid http method on line %d", line)
		}

		headers := strings.TrimSpace(getValue(record, idxHeaders))
		query := strings.TrimSpace(getValue(record, idxQuery))
		auth := strings.TrimSpace(getValue(record, idxAuth))
		body := strings.TrimSpace(getValue(record, idxBody))

		if headers != "" && !isValidJSON(headers) {
			return nil, fmt.Errorf("csv: invalid headers json on line %d", line)
		}
		if query != "" && !isValidJSON(query) {
			return nil, fmt.Errorf("csv: invalid query json on line %d", line)
		}
		if body != "" && !isValidJSON(body) {
			return nil, fmt.Errorf("csv: invalid body json on line %d", line)
		}
		if method == "POST" && body == "" {
			return nil, fmt.Errorf("csv: body required for POST on line %d", line)
		}

		apis = append(apis, models.API{
			Name:          strings.TrimSpace(pathVal),
			Method:        method,
			Description:   "",
			Headers:       headers,
			QueryParams:   query,
			Authorization: auth,
			Body:          body,
		})
	}

	return apis, nil
}

func normalizeHeader(h string) string {
	value := strings.ToLower(strings.TrimSpace(h))
	value = strings.ReplaceAll(value, " ", "")
	value = strings.ReplaceAll(value, "_", "")
	value = strings.ReplaceAll(value, "-", "")
	return value
}

func getValue(record []string, idx int) string {
	if idx < 0 || idx >= len(record) {
		return ""
	}
	return record[idx]
}

func isValidJSON(value string) bool {
	var v any
	return json.Unmarshal([]byte(value), &v) == nil
}
