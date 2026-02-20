#!/usr/bin/env bash
# Shell helpers for the hands-on runbook.
# Source this file:  source scripts/runbook/helpers.sh
#
# Provides: wait_idle, read_source, reset_source, list_entries, read_entry, nuke_entries
# For lemma_fire see lemma-fire.ts (requires bun).

# Resolve script directory (works in both bash and zsh)
if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
  _RUNBOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
elif [[ -n "${(%):-%x}" ]]; then
  _RUNBOOK_DIR="$(cd "$(dirname "${(%):-%x}")" && pwd)"
else
  _RUNBOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
fi
source "$_RUNBOOK_DIR/env.sh"

wait_idle() {
  "$OBSIDIAN_BIN" vault="$VAULT" eval \
    code="(async()=>{await app.plugins.plugins['$PLUGIN_ID'].whenIdle();return 'idle'})()"
}

read_source() {
  "$OBSIDIAN_BIN" vault="$VAULT" read path="$SRC"
}

reset_source() {
  "$OBSIDIAN_BIN" vault="$VAULT" eval \
    code="(async()=>{const f=app.vault.getAbstractFileByPath('$SRC');if(f)await app.vault.trash(f,true);return 'ok'})()"
  "$OBSIDIAN_BIN" vault="$VAULT" create path="$SRC" \
    content="Der Mann liest heute ein Buch.\nDie Katze schlaeft dort.\nEr faengt morgen frueh an.\nDas machen wir auf jeden Fall zusammen.\nDer Plan wirkt klar.\nDer Ablauf bleibt deutlich." silent
}

list_entries() {
  "$OBSIDIAN_BIN" vault="$VAULT" files folder="Worter/de" ext=md
}

read_entry() {
  "$OBSIDIAN_BIN" vault="$VAULT" read path="$1"
}

nuke_entries() {
  "$OBSIDIAN_BIN" vault="$VAULT" eval \
    code="(async()=>{const f=app.vault.getAbstractFileByPath('Worter');if(f)await app.vault.trash(f,true);return 'ok'})()"
}

reload_plugin() {
  "$OBSIDIAN_BIN" vault="$VAULT" plugin:reload id="$PLUGIN_ID"
}

check_no_nested_wikilinks() {
  local content
  content=$("$OBSIDIAN_BIN" vault="$VAULT" read path="$SRC" 2>&1)
  if echo "$content" | grep -qE '\[\[[^\]]*\[\['; then
    echo "FAIL: nested wikilinks detected"
    echo "$content" | grep -E '\[\[[^\]]*\[\['
    return 1
  else
    echo "OK: no nested wikilinks"
    return 0
  fi
}

check_surface_linked() {
  local surface="$1"
  local content
  content=$("$OBSIDIAN_BIN" vault="$VAULT" read path="$SRC" 2>&1)
  if echo "$content" | grep -qE "\[\[.*${surface}.*\]\]"; then
    echo "OK: $surface is linked"
    return 0
  else
    echo "FAIL: $surface is NOT linked"
    return 1
  fi
}
