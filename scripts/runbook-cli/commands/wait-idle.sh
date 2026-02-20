#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
	_CMD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
	_CMD_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

source "$_CMD_DIR/../lib.sh"

wait_idle
