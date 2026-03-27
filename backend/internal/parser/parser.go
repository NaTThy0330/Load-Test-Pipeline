package parser

import (
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
