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
	var errors []string
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
		trimmedPath := strings.TrimSpace(pathVal)
		hasOtherValues := strings.TrimSpace(getValue(record, idxMethod)) != "" ||
			strings.TrimSpace(getValue(record, idxHeaders)) != "" ||
			strings.TrimSpace(getValue(record, idxQuery)) != "" ||
			strings.TrimSpace(getValue(record, idxAuth)) != "" ||
			strings.TrimSpace(getValue(record, idxBody)) != ""
		if trimmedPath == "" {
			if hasOtherValues {
				errors = append(errors, fmt.Sprintf("line %d: api_path is required", line))
			}
			continue
		}

		method := strings.ToUpper(strings.TrimSpace(getValue(record, idxMethod)))
		if method == "" {
			method = "GET"
		}

		headers := strings.TrimSpace(getValue(record, idxHeaders))
		query := strings.TrimSpace(getValue(record, idxQuery))
		auth := strings.TrimSpace(getValue(record, idxAuth))
		body := strings.TrimSpace(getValue(record, idxBody))

		var lineErrors []string
		if method != "GET" && method != "POST" {
			lineErrors = append(lineErrors, "invalid http method (use GET or POST)")
		}
		if headers != "" && !IsValidJSON(headers) {
			lineErrors = append(lineErrors, "invalid headers json")
		}
		if query != "" && !IsValidJSON(query) {
			lineErrors = append(lineErrors, "invalid query json")
		}
		if body != "" && !IsValidJSON(body) {
			lineErrors = append(lineErrors, "invalid body json")
		}
		if method == "POST" && body == "" {
			lineErrors = append(lineErrors, "body required for POST")
		}
		if len(lineErrors) > 0 {
			errors = append(errors, fmt.Sprintf("line %d: %s", line, strings.Join(lineErrors, "; ")))
			continue
		}

		apis = append(apis, models.API{
			Name:          trimmedPath,
			Method:        method,
			Description:   "",
			Headers:       headers,
			QueryParams:   query,
			Authorization: auth,
			Body:          body,
		})
	}

	if len(errors) > 0 {
		return nil, fmt.Errorf("csv validation errors:\n- %s", strings.Join(errors, "\n- "))
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

func IsValidJSON(value string) bool {
	var v any
	return json.Unmarshal([]byte(value), &v) == nil
}
