# 000 One Noun Only (CLI Runbook)

Goal: copy one source page into the CLI test vault, select one noun (`Manne`), run `Lemma`, and verify output.

## Hard Stop Rules

- Run `Lemma` only on plain text, never on already linked text.
- If the token is already inside `[[...]]`, reset the note first.
- Run `Lemma` once per token in a fresh source file state.
- If you see nested links like `[[[[...]]]]`, stop and reset source before continuing.
- If you see numbered sense targets (`1_...`, `2_...`, `3_...`) in a run that should be clean, stop and clean prior matching entries in `Worter/` before retry.

Quick pre-check before each run:

```bash
"$OBSIDIAN" vault="$VAULT" read path="$HEALED_PATH" | rg -n "\\[\\[\\[\\[|\\[\\[Manne\\]\\]|Manne" | head -20
```

Expected before first run: plain `Manne` (not `[[Manne]]`, not `[[[[Manne]]]]`).

## 0) Variables

```bash
OBSIDIAN="/Applications/Obsidian.app/Contents/MacOS/Obsidian"
VAULT="cli-e2e-test-vault"
SOURCE="/Users/annagorelova/work/Textfresser_vault/Library/Text/Märchen/Aschenputtel/Aschenputtel_Page_000 ;; Aschenputtel ;; Märchen ;; Text.md"
RAW_DEST="/Users/annagorelova/work/obsidian/cli-e2e-test-vault/Library/Text/Märchen/Aschenputtel/Aschenputtel_Page_000 ;; Aschenputtel ;; Märchen ;; Text.md"
HEALED_PATH="Library/Text/Märchen/Aschenputtel/Aschenputtel_Page_000 ;; Aschenputtel ;; Märchen ;; Text-Aschenputtel-Märchen-Text.md"
```

## 1) Copy content into test vault

```bash
mkdir -p "/Users/annagorelova/work/obsidian/cli-e2e-test-vault/Library/Text/Märchen/Aschenputtel"
cat "$SOURCE" > "$RAW_DEST"
```

## 2) Ensure vault is reachable via Obsidian CLI

```bash
"$OBSIDIAN" vault="$VAULT" files | head -20
```

## 3) Confirm final path after healing

The plugin may heal the copied filename immediately.

```bash
"$OBSIDIAN" vault="$VAULT" files folder="Library" ext=md | rg "Aschenputtel|Märchen|Text"
```

Use `HEALED_PATH` for command execution.

## 4) Open file, select `Manne`, invoke `Lemma` (CLI only)

```bash
CODE="(async()=>{const file=app.vault.getAbstractFileByPath('$HEALED_PATH');if(!file)throw new Error('file not found');const leaf=app.workspace.getMostRecentLeaf()??app.workspace.getLeaf(true);await leaf.openFile(file,{active:true});const view=leaf.view;if(view&&typeof view.getMode==='function'&&typeof view.setMode==='function'&&view.getMode()!=='source'){await view.setMode('source')}const editor=(view&&'editor' in view&&view.editor)?view.editor:app.workspace.activeEditor?.editor;if(!editor)throw new Error('no editor');const content=editor.getValue();const idx=content.indexOf('Manne');if(idx===-1)throw new Error('Manne not found');const toPos=(offset)=>{const s=content.slice(0,offset).split('\\n');return {line:s.length-1,ch:s[s.length-1].length}};editor.setSelection(toPos(idx),toPos(idx+5));if(typeof editor.focus==='function'){editor.focus()}const ok=app.commands.executeCommandById('cbcr-text-eater-de:lemma');if(!ok)throw new Error('command failed');return 'ok';})()"
"$OBSIDIAN" vault="$VAULT" eval "code=$CODE"
```

## 5) Wait for plugin idle

```bash
"$OBSIDIAN" vault="$VAULT" eval "code=(async()=>{await app.plugins.plugins['cbcr-text-eater-de'].whenIdle();return 'idle'})()"
```

## 6) Verify source rewrite + dictionary output

Check rewritten source line:

```bash
"$OBSIDIAN" vault="$VAULT" read path="$HEALED_PATH" | rg -n "\\[\\[.*Manne|Manne" | head -5
```

Check created entry files:

```bash
"$OBSIDIAN" vault="$VAULT" files folder="Worter" ext=md | rg -n "Manne|Mann"
```
