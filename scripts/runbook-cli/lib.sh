#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
	_RUNBOOK_CLI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
	_RUNBOOK_CLI_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

export VAULT="${VAULT:-cli-e2e-test-vault}"
export PLUGIN_ID="${PLUGIN_ID:-cbcr-text-eater-de}"
export SRC="${SRC:-textfresser/0_Synthetic_Test_To_Check_Morhp.md}"

source "$_RUNBOOK_CLI_DIR/../runbook/helpers.sh"

LEMMA_FIRE_SCRIPT="$_RUNBOOK_CLI_DIR/../runbook/lemma-fire.ts"

print_section() {
	printf "\n== %s ==\n" "$1"
}

require_command() {
	local cmd="$1"
	if ! command -v "$cmd" >/dev/null 2>&1; then
		echo "Missing required command: $cmd"
		return 1
	fi
}

run_lemma() {
	local surface="$1"
	bun "$LEMMA_FIRE_SCRIPT" "$surface"
}

run_lemma_on_src() {
	local src_path="$1"
	local surface="$2"
	SRC="$src_path" bun "$LEMMA_FIRE_SCRIPT" "$surface"
}

run_preflight_checks() {
	local version_output

	require_command obsidian
	require_command bun
	require_command rg

	print_section "Version"
	version_output="$(obsidian version 2>/dev/null || true)"
	if [[ -z "$version_output" ]]; then
		version_output="$(obsidian vault="$VAULT" version 2>/dev/null || true)"
	fi
	if [[ -n "$version_output" ]]; then
		echo "$version_output"
	else
		echo "(version output empty)"
	fi

	print_section "Vault"
	obsidian vault="$VAULT" vault info=path

	print_section "Plugin"
	obsidian vault="$VAULT" plugin id="$PLUGIN_ID"
	obsidian vault="$VAULT" commands | rg "$PLUGIN_ID"
}

check_entry_nonempty() {
	local path="$1"
	local out words
	out="$(obsidian vault="$VAULT" wordcount path="$path" </dev/null 2>&1 || true)"

	if [[ "$out" == Error:* ]]; then
		echo "MISSING $path"
		return 2
	fi

	words="$(printf "%s\n" "$out" | rg "^words:" | tr -cd '0-9')"
	if [[ -z "$words" ]]; then
		echo "UNKNOWN $path ($out)"
		return 3
	fi

	if (( words > 0 )); then
		echo "OK $path ($words words)"
		return 0
	fi

	echo "EMPTY $path"
	return 1
}

collect_linked_entries() {
	obsidian vault="$VAULT" links path="$SRC" | rg "^Worter/de/" | sort -u || true
}
