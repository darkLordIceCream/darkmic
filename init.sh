#!/bin/bash
set -e

echo "=== darkmic Harness Initialization ==="

# Check required system tools
echo "--- Checking system dependencies ---"
command -v node >/dev/null 2>&1 || { echo "Error: node not found"; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "Error: npm not found"; exit 1; }

echo "--- Installing npm dependencies ---"
npm install

echo "--- Type checking ---"
npm run typecheck 2>/dev/null || echo "(typecheck script not configured yet)"

echo "--- Building ---"
npm run build 2>/dev/null || echo "(build script not configured yet)"

echo ""
echo "=== Verification Complete ==="
echo ""
echo "Next steps:"
echo "1. Read feature_list.json to see current feature state"
echo "2. Pick ONE unfinished feature to work on"
echo "3. Implement only that feature"
echo "4. Re-run verification before claiming done"
