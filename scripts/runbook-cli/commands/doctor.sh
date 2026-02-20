#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
	_CMD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
	_CMD_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

source "$_CMD_DIR/../lib.sh"

print_section "Obsidian process"
if pgrep -l -f "Obsidian.app/Contents/MacOS/Obsidian$" >/dev/null 2>&1; then
	pgrep -l -f "Obsidian.app/Contents/MacOS/Obsidian$"
else
	echo "Obsidian process not found."
fi

print_section "CLI and vault"
obsidian version
if ! obsidian vault="$VAULT" vault info=path; then
	echo "Vault is not reachable through CLI. Open vault '$VAULT' in Obsidian."
	exit 1
fi

print_section "Plugin status"
obsidian vault="$VAULT" plugin id="$PLUGIN_ID"
obsidian vault="$VAULT" commands | rg "$PLUGIN_ID" || {
	echo "Plugin commands are not visible to CLI."
	exit 1
}

print_section "IPC smoke test"
obsidian vault="$VAULT" files ext=md | sed -n "1,10p"

print_section "Troubleshooting hints"
echo "If CLI hangs: reopen Obsidian, ensure vault is open, then rerun preflight."
echo "If command output says Executed but files did not change: run scan-empty and inspect source with read-source."
