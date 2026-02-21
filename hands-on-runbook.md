# Textfresser Hands-On Runbook (Obsidian CLI)

Manual sanity checks for how Lemma/Generate commands interact with vault state.
Run against `cli-e2e-test-vault`.

---

## Philosophy

1. **Resettable runs** — recreate source notes before each scenario. No leftover state.
2. **Single eval for selection commands** — open file + select text + fire command in one `eval` to avoid editor focus races.
3. **Gate assertions with `whenIdle()`** — idle tracker covers healing cascades AND background Generate.
4. **Assert via vault files** — `read` + `files` + `search` are ground truth. Command return values are best-effort.
5. **Composable one-liners over long scripts** — the CLI is early-access. Short commands are easier to debug.

---

## 0) Prerequisites

### Obsidian Binary Version

The CLI ships with Obsidian 1.12 (Early Access / Catalyst). The **Obsidian.app binary** must be **v1.11.7+**.

Obsidian's auto-updater only patches the `.asar` runtime — the Electron shell binary stays at whatever version was installed. If the binary is too old, every CLI call hangs with `Loading updated app package` and never returns.

```bash
defaults read /Applications/Obsidian.app/Contents/Info.plist CFBundleShortVersionString
# Must be >= 1.11.7
# If 1.7.x → re-download from obsidian.md/download and replace /Applications/Obsidian.app
```

### Vault & Plugin

- `cli-e2e-test-vault` exists and is open in Obsidian
- Plugin `cbcr-text-eater-de` is enabled
- CLI enabled: Obsidian Settings → General → Command line interface
- Vault path: `/Users/annagorelova/work/obsidian/cli-e2e-test-vault`

---

## 1) Setup

### Shell Variables

```bash
OBS="/Applications/Obsidian.app/Contents/MacOS/Obsidian"
VAULT="cli-e2e-test-vault"
PLUGIN="cbcr-text-eater-de"
SRC="Outside/Textfresser-Lemma-Manual.md"
```

### Or: Source the Helpers

```bash
source scripts/runbook/helpers.sh
# Provides: wait_idle, read_source, reset_source, list_entries, read_entry,
#           nuke_entries, reload_plugin, check_no_nested_wikilinks, check_surface_linked
```

### Preflight (Must All Return Instantly)

```bash
$OBS vault=$VAULT vault info=path
# → /Users/annagorelova/work/obsidian/cli-e2e-test-vault

$OBS vault=$VAULT eval code="'cli works'"
# → => cli works

$OBS vault=$VAULT eval code="(async()=>{const p=app.plugins.plugins['$PLUGIN'];return p?'plugin loaded':'MISSING'})()"
# → => plugin loaded
```

If any command hangs → see [Troubleshooting](#troubleshooting).

---

## 2) Inline Helpers

For copy-paste use without sourcing scripts:

```bash
wait_idle() {
  $OBS vault=$VAULT eval \
    code="(async()=>{await app.plugins.plugins['$PLUGIN'].whenIdle();return 'idle'})()"
}

reset_source() {
  $OBS vault=$VAULT eval \
    code="(async()=>{const f=app.vault.getAbstractFileByPath('$SRC');if(f)await app.vault.trash(f,true);return 'ok'})()"
  $OBS vault=$VAULT create path="$SRC" \
    content="Der Mann liest heute ein Buch.\nDie Katze schlaeft dort.\nDer Plan wirkt klar.\nDer Ablauf bleibt deutlich." silent
}

read_source() {
  $OBS vault=$VAULT read path="$SRC"
}

check_nested() {
  read_source | grep -E '\[\[[^\]]*\[\[' && echo "FAIL: nested wikilinks" || echo "OK: no nesting"
}

check_entries() {
  $OBS vault=$VAULT files folder="Worter/de" ext=md
}

lemma_state() {
  $OBS vault=$VAULT eval \
    code="(async()=>{const p=app.plugins.plugins['$PLUGIN'];const lr=p.textfresser.getState().latestLemmaResult;return lr?JSON.stringify({lemma:lr.lemma,pos:lr.posLikeKind,unit:lr.linguisticUnit}):JSON.stringify(null)})()"
}
```

### `lemma_fire` — The Recommended Way

Use the Bun script to avoid shell escaping issues (especially for umlauts, `!`, `$`):

```bash
bun scripts/runbook/lemma-fire.ts Mann
bun scripts/runbook/lemma-fire.ts Katze
bun scripts/runbook/lemma-fire.ts klar
```

The script uses `Bun.spawn` (no shell) → no zsh mangling. It tries `textfresser.executeCommand()` first, falls back to `app.commands.executeCommandById()`, waits for idle, and polls for the wikilink.

**Fallback** — inline eval for simple ASCII surfaces:

```bash
lemma_fire() {
  local surface="$1"
  $OBS vault=$VAULT eval code="(async()=>{
    const file=app.vault.getAbstractFileByPath('$SRC');
    if(!file) throw new Error('not found: $SRC');
    const leaf=app.workspace.getMostRecentLeaf()??app.workspace.getLeaf(true);
    await leaf.openFile(file,{active:true});
    const view=leaf.view;
    if(view?.getMode?.()!=='source') await view.setMode('source');
    const editor=view?.editor??app.workspace.activeEditor?.editor;
    if(!editor) throw new Error('no editor');
    const content=editor.getValue();
    const idx=content.indexOf('$surface');
    if(idx===-1) throw new Error('surface not found: $surface');
    const toPos=(o)=>{const ls=content.slice(0,o).split('\n');return{line:ls.length-1,ch:ls[ls.length-1].length}};
    editor.setSelection(toPos(idx),toPos(idx+'$surface'.length));
    editor.focus?.();
    app.commands.executeCommandById('$PLUGIN:lemma');
    return 'ok';
  })()"
}
```

---

## 3) Scenarios

### A: Idempotence on Same Surface

Two Lemma runs on the same token must not create `[[...[[...]]...]]`.

```bash
reset_source

bun scripts/runbook/lemma-fire.ts Mann
wait_idle
bun scripts/runbook/lemma-fire.ts Mann
wait_idle

read_source
check_nested
lemma_state
check_entries
```

**Expected**: `Mann` linked once (as `[[Mann]]` or `[[something|Mann]]`). No nested wikilinks. A dictionary entry may appear in `Worter/de/` if Gemini API key is configured.

### B: Back-to-Back on Different Tokens

Tests pending-generate queue behavior.

```bash
reset_source

bun scripts/runbook/lemma-fire.ts klar
bun scripts/runbook/lemma-fire.ts deutlich
wait_idle

read_source
check_nested
check_entries
```

**Expected**: both `klar` and `deutlich` are wikilinked. No nesting.

### C: Burst on 4 Tokens

```bash
reset_source

for w in Mann Katze klar deutlich; do
  bun scripts/runbook/lemma-fire.ts "$w"
done
wait_idle

read_source
check_nested
check_entries
```

**Expected**: all 4 linked. Background Generate runs for the last pending Lemma (earlier ones get superseded).

### D: Re-Encounter (Existing Entry)

Lemma on an already-known word should append an attestation, not re-create the entry.

```bash
# First, create an entry via scenario A
reset_source
bun scripts/runbook/lemma-fire.ts Mann
wait_idle

# Now fire on "Mann" in a different source
SRC2="Outside/Textfresser-Re-Encounter.md"
$OBS vault=$VAULT create path="$SRC2" content="Der alte Mann ging spazieren." silent

SRC="$SRC2" bun scripts/runbook/lemma-fire.ts Mann
wait_idle

$OBS vault=$VAULT read path="$SRC2"
# → "Mann" should link to the SAME entry (not a new one)

# Clean up
$OBS vault=$VAULT delete path="$SRC2"
SRC="Outside/Textfresser-Lemma-Manual.md"  # restore
```

### E: Inspect Generated Entry

After any scenario that creates dictionary entries:

```bash
check_entries

# Read a specific entry (adjust path)
$OBS vault=$VAULT read path="Worter/de/Mann.md"

# Check frontmatter
$OBS vault=$VAULT property:read name=noteKind path="Worter/de/Mann.md"
# → DictEntry
```

**Expected**: entry has `noteKind: DictEntry`, contains sections (Header, Morphem, Inflection, Translation, Attestation).

### F: Librarian Healing Sanity

Not Textfresser-specific — validates the healing pipeline after vault mutations.

```bash
# Create a file in Library → should get suffix-healed
$OBS vault=$VAULT eval code="(async()=>{await app.vault.createFolder('Library/TestSection');await app.vault.create('Library/TestSection/MyNote.md','# Test');return 'ok'})()"
wait_idle

$OBS vault=$VAULT files folder="Library/TestSection" ext=md
# Expected: __-TestSection.md (codex) + MyNote-TestSection.md (suffix-healed)

# Clean up
$OBS vault=$VAULT eval code="(async()=>{const f=app.vault.getAbstractFileByPath('Library/TestSection');if(f)await app.vault.trash(f,true);return 'ok'})()"
wait_idle
```

---

## CLI Quick Reference

### File Operations

| Command | Syntax |
|---------|--------|
| List files | `$OBS vault=$VAULT files [folder="X"] [ext=md]` |
| Read file | `$OBS vault=$VAULT read path="X.md"` |
| Create file | `$OBS vault=$VAULT create path="X.md" content="..." [overwrite] [silent]` |
| Append | `$OBS vault=$VAULT append path="X.md" content="..."` |
| Delete file | `$OBS vault=$VAULT delete path="X.md"` |
| Search | `$OBS vault=$VAULT search query="text"` |

### Plugin & Vault

| Command | Syntax |
|---------|--------|
| Vault path | `$OBS vault=$VAULT vault info=path` |
| Reload plugin | `$OBS vault=$VAULT plugin:reload id=$PLUGIN` |
| List commands | `$OBS vault=$VAULT commands` |
| Tags | `$OBS vault=$VAULT tags` |
| Read property | `$OBS vault=$VAULT property:read name=KEY path="file.md"` |
| Set property | `$OBS vault=$VAULT property:set name=KEY value=VAL path="file.md"` |

### Eval

```bash
$OBS vault=$VAULT eval code="<expression>"
```

- Output prefixed with `=> `. Errors prefixed with `Error:`.
- Access to `app.*` (Obsidian API) and `app.plugins.plugins['cbcr-text-eater-de']`.
- For async: wrap in `(async()=>{...})()`.

### Eval Recipes

```bash
# Create folder (CLI create doesn't handle folders)
$OBS vault=$VAULT eval code="(async()=>{await app.vault.createFolder('Library/New');return 'ok'})()"

# Delete folder (CLI delete only handles files)
$OBS vault=$VAULT eval code="(async()=>{const f=app.vault.getAbstractFileByPath('Library/Old');if(f)await app.vault.trash(f,true);return 'ok'})()"

# Rename/move (uses fileManager for proper event emission)
$OBS vault=$VAULT eval code="(async()=>{const f=app.vault.getAbstractFileByPath('A.md');await app.fileManager.renameFile(f,'B.md');return 'ok'})()"

# Check file exists (CLI read returns exit 0 even for missing files)
$OBS vault=$VAULT eval code="app.vault.getAbstractFileByPath('path.md')?'yes':'no'"

# Wait for plugin idle
$OBS vault=$VAULT eval code="(async()=>{await app.plugins.plugins['$PLUGIN'].whenIdle();return 'idle'})()"

# Read Lemma state
$OBS vault=$VAULT eval code="(async()=>{const p=app.plugins.plugins['$PLUGIN'];const lr=p.textfresser.getState().latestLemmaResult;return JSON.stringify(lr)})()"

# List loaded plugins
$OBS vault=$VAULT eval code="Object.keys(app.plugins.plugins).join(', ')"
```

---

## Gotchas

### CLI Always Returns Exit 0
Even on errors. Parse stdout for `Error:` prefix instead of checking `$?`.

### `create` with Paths
Use `path=` for files in subdirectories. `name=` only works for root-level files (no `/` allowed).

### Shell Escaping Eats Special Characters
zsh mangles `!`, `$`, and unicode inside double quotes. For eval code with umlauts or special chars, use `Bun.spawn` array args (no shell) — that's what `lemma-fire.ts` and the automated tests do.

### Folder Operations Need `eval`
CLI `create`/`delete` only handle files. Folders require `app.vault.createFolder()` / `app.vault.trash()` via eval.

### CLI Output Noise
Occasional lines like `Loaded updated app package ...` or `Checking for updates`. The test infra strips them; for manual use, just ignore.

### `help` Opens TUI
`$OBS help` without a vault opens an interactive terminal UI. Not scriptable.

### `version` Returns Nothing
`$OBS version` and `$OBS vault=$VAULT version` both return empty output as of 1.12.2.

---

## Troubleshooting

### CLI Hangs Forever

**Most likely**: Obsidian.app binary is too old. Check:
```bash
defaults read /Applications/Obsidian.app/Contents/Info.plist CFBundleShortVersionString
```
Must be `>= 1.11.7`. If `1.7.x`:
1. Quit Obsidian
2. Download latest from [obsidian.md/download](https://obsidian.md/download) (or `obsidianmd/obsidian-releases` on GitHub)
3. Replace `/Applications/Obsidian.app`
4. Relaunch

**Second cause**: zombie CLI processes holding the IPC socket:
```bash
ps aux | grep -i "[O]bsidian" | grep -v Helper | grep -v Cursor
# Kill any stale CLI processes (NOT the main Obsidian GUI)
kill <stale-pids>
```

### Vault Not Found

```bash
cat ~/Library/Application\ Support/obsidian/obsidian.json
# Look for cli-e2e-test-vault with "open": true
```

If not open:
```bash
open "obsidian://open?vault=cli-e2e-test-vault"
sleep 3
```

### Plugin Not Loaded

```bash
$OBS vault=$VAULT eval code="Object.keys(app.plugins.plugins).join(', ')"
```

If missing: check `community-plugins.json` and that `main.js` + `manifest.json` exist in the plugin dir.

### Deploy Fresh Build

```bash
bun run build
cp main.js /Users/annagorelova/work/obsidian/cli-e2e-test-vault/.obsidian/plugins/cbcr-text-eater-de/main.js
cp manifest.json /Users/annagorelova/work/obsidian/cli-e2e-test-vault/.obsidian/plugins/cbcr-text-eater-de/manifest.json
$OBS vault=$VAULT plugin:reload id=$PLUGIN
```

---

## Full Reset

```bash
# Trash source files
$OBS vault=$VAULT eval code="(async()=>{for(const p of['Outside/Textfresser-Lemma-Manual.md','Outside/Textfresser-Re-Encounter.md']){const f=app.vault.getAbstractFileByPath(p);if(f)await app.vault.trash(f,true)}return 'ok'})()"

# Trash dictionary entries
$OBS vault=$VAULT eval code="(async()=>{const f=app.vault.getAbstractFileByPath('Worter');if(f)await app.vault.trash(f,true);return 'ok'})()"

wait_idle
```

---

## Known Pain Points (2026-02-20)

1. Zero-byte dictionary notes can be created and linked when background Generate fails silently.
2. `whenIdle()` resolves when async work finishes, but doesn't guarantee the entry is non-empty.
3. Shell eval with umlauts is fragile — always use `lemma-fire.ts` for non-ASCII surfaces.
4. `command id=...` returning `Executed` is not proof of success — check vault state.
