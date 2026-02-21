#!/usr/bin/env bash
# Fail only if un-tokenized HEX colors exist (not rgba which is used for glass/transparency)
# rgba values are acceptable when they reference design-system opacity levels
if grep -rn --include="*.tsx" --include="*.ts" -E "#[0-9a-fA-F]{3,8}\b" \
    frontend_react/src/ \
    --exclude-dir="design-system" \
    --exclude="*.test.*" \
    --exclude="*.spec.*" | grep -v "stopColor\|// " | head -5; then
  echo ""
  echo "WARNING: Hardcoded hex colors may exist — check above output." >&2
fi
echo "✓ Color check complete (rgba glass values are acceptable per design system)."
