#!/bin/bash
# E2E test runner that isolates test settings from dev settings
# Temporarily removes data.json so tests use default plugin settings

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"
DATA_JSON="$PLUGIN_DIR/data.json"
DATA_JSON_BAK="$PLUGIN_DIR/data.json.e2e-bak"

cleanup() {
    # Restore data.json if backup exists
    if [ -f "$DATA_JSON_BAK" ]; then
        mv "$DATA_JSON_BAK" "$DATA_JSON"
        echo "Restored data.json"
    fi
}

# Set up trap to restore on exit (success or failure)
trap cleanup EXIT

# Backup data.json if it exists
if [ -f "$DATA_JSON" ]; then
    mv "$DATA_JSON" "$DATA_JSON_BAK"
    echo "Backed up data.json"
fi

# Run e2e tests
echo "Running e2e tests with default settings..."
cd "$PLUGIN_DIR"
bun run build && bun x wdio run ./wdio.conf.mts

echo "E2E tests completed"
