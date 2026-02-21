#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
	_CMD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
	_CMD_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

source "$_CMD_DIR/../lib.sh"

path="${1:-}"
if [[ -z "$path" ]]; then
	echo "Usage: textfresser-runbook check-entry <vault-path-to-entry.md>"
	exit 1
fi

check_entry_nonempty "$path"
