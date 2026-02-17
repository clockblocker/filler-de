# filler-de Architecture

## Ownership Domains

The plugin is divided into five logical ownership domains. Each domain
groups files by responsibility so that changes within a domain can be
reviewed by the team most familiar with that area.

### 1. plugin-core

Entry point, settings UI, and shared type definitions.

| File | Purpose |
|------|---------|
| `src/main.ts` | Plugin lifecycle (`onload` / `onunload`), command registration |
| `src/settings.ts` | Settings tab, defaults, persistence |
| `src/types.ts` | Shared TypeScript interfaces and type aliases |

### 2. commands

User-facing Obsidian commands that orchestrate the other domains.

| File | Purpose |
|------|---------|
| `src/commands/addBacklinksToCurrentFile.ts` | Add backlinks to current note |
| `src/commands/endgame.ts` | Endgame command logic |
| `src/commands/fillTemplate.ts` | Fill a note template via AI |
| `src/commands/formatSelectionWithNumber.ts` | Format selected text with numbering |
| `src/commands/functions.ts` | Shared command helpers |
| `src/commands/getInfinitiveAndEmoji.ts` | Look up infinitive + emoji |
| `src/commands/insertReplyFromC1Richter.ts` | Insert C1 Richter reply |
| `src/commands/insertReplyFromKeymaker.ts` | Insert Keymaker reply |
| `src/commands/normalizeSelection.ts` | Normalize selected text |
| `src/commands/translateSelection.ts` | Translate selected text |

### 3. ai-api

HTTP client for the external LLM provider.

| File | Purpose |
|------|---------|
| `src/api.ts` | API request construction, response parsing, error handling |

### 4. prompt-engineering

Prompt templates and builders sent to the LLM.

| File | Purpose |
|------|---------|
| `src/prompts/index.ts` | Re-exports / prompt registry |
| `src/prompts/baseDict.ts` | Base dictionary prompt |
| `src/prompts/c1Richter.ts` | C1 Richter prompt |
| `src/prompts/determine-infinitive-and-pick-emoji.ts` | Infinitive + emoji prompt |
| `src/prompts/full-dict-enrtie.ts` | Full dictionary entry prompt |
| `src/prompts/generate-forms.ts` | Word-form generation prompt |
| `src/prompts/keymaker.ts` | Keymaker prompt |
| `src/prompts/morphems.ts` | Morpheme analysis prompt |
| `src/prompts/normalize.ts` | Normalization prompt |
| `src/prompts/translate-de-to-eng.ts` | DE-to-EN translation prompt |
| `src/prompts/valence.ts` | Verb valence prompt |
| `src/prompts/wip_keymaker.ts` | Keymaker (work-in-progress) prompt |

### 5. filesystem

Vault file-system helpers for reading and writing notes.

| File | Purpose |
|------|---------|
| `src/utils.ts` | Path resolution, directory sharding, file creation helpers |
| `src/file.ts` | File read/write operations |

## Dependency Flow

```
plugin-core
    |
    v
 commands
   / \
  v   v
ai-api  filesystem
  |
  v
prompt-engineering
```

`plugin-core` registers commands. Each command may call into `ai-api`
(which uses prompts from `prompt-engineering`) and `filesystem` to read
or write vault files. Domains at the bottom of the graph should never
import from domains above them.
