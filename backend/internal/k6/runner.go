package k6

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

var ErrThresholdsExceeded = errors.New("k6 thresholds exceeded")

type Result struct {
	SummaryPath string
	JSONPath    string
	Stdout      string
	Stderr      string
}

func Run(scriptPath string) (Result, error) {
	absScript, err := filepath.Abs(scriptPath)
	if err != nil {
		return Result{}, err
	}
	outDir := filepath.Dir(absScript)
	summaryPath := filepath.Join(outDir, "summary.json")
	jsonOutPath := filepath.Join(outDir, "k6_out.json")

	cmd := exec.Command("k6", "run", "--summary-export", summaryPath, "--out", "json="+jsonOutPath, absScript)
	cmd.Dir = outDir
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			if exitErr.ExitCode() == 99 {
				if _, statErr := os.Stat(summaryPath); statErr != nil {
					return Result{SummaryPath: summaryPath, JSONPath: jsonOutPath, Stdout: stdout.String(), Stderr: stderr.String()},
						fmt.Errorf("summary.json not found: %w", statErr)
				}
				return Result{SummaryPath: summaryPath, JSONPath: jsonOutPath, Stdout: stdout.String(), Stderr: stderr.String()},
					fmt.Errorf("%w: exit status %d", ErrThresholdsExceeded, exitErr.ExitCode())
			}
		}
		return Result{SummaryPath: summaryPath, JSONPath: jsonOutPath, Stdout: stdout.String(), Stderr: stderr.String()},
			fmt.Errorf("k6 run failed: %w", err)
	}
	if _, err := os.Stat(summaryPath); err != nil {
		return Result{SummaryPath: summaryPath, JSONPath: jsonOutPath, Stdout: stdout.String(), Stderr: stderr.String()},
			fmt.Errorf("summary.json not found: %w", err)
	}

	return Result{SummaryPath: summaryPath, JSONPath: jsonOutPath, Stdout: stdout.String(), Stderr: stderr.String()}, nil
}
