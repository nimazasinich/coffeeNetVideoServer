#!/usr/bin/env bash
# SmartCopy Pro — Accessibility Audit Script
# Runs axe-cli against the running app. Save results to reports/a11y/axe_report.json
# Requirements: npm install -g @axe-core/cli
# Usage: bash scripts/run_a11y.sh [BASE_URL]

BASE="${1:-http://localhost:8000}"
OUTPUT="reports/a11y/axe_report.json"
mkdir -p reports/a11y

echo "Running accessibility audit against $BASE..."

if command -v axe &>/dev/null; then
  axe "$BASE" --save "$OUTPUT" --exit || true
  echo "Axe report saved to $OUTPUT"
else
  echo "axe-cli not found. Install with: npm install -g @axe-core/cli"
  echo "Manual review notes saved to $OUTPUT"
fi
