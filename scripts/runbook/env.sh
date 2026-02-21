#!/usr/bin/env bash
# Shared variables for runbook scripts.
# Source this file:  source scripts/runbook/env.sh

export VAULT="${VAULT:-cli-e2e-test-vault}"
export PLUGIN_ID="${PLUGIN_ID:-cbcr-text-eater-de}"
export SRC="${SRC:-Outside/Textfresser-Lemma-Manual.md}"
export OBSIDIAN_BIN="${OBSIDIAN_BIN:-/Applications/Obsidian.app/Contents/MacOS/Obsidian}"
