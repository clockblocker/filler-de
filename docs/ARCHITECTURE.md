# Architecture — filler-de (TextEater Plugin)

## Overview

TextEater is an Obsidian plugin that generates German-language dictionary entries, conjugation tables, and writing-feedback using LLM APIs. The source code in `src/` is organized into five ownership domains.

## Ownership Domains

### 1. plugin-core

**Files:** `main.ts`, `types.ts`, `settings.ts`

Responsibilities:
- Plugin lifecycle (`onload`, settings persistence)
- Obsidian command registration
- Shared type definitions (`TextEaterSettings`, defaults)
- Settings UI tab

Boundary rules:
- Only domain allowed to call `this.addCommand()` and interact with the Obsidian Plugin API directly.
- Instantiates `ApiService` and `FileService`; passes them to commands.

### 2. commands

**Files:** `commands/*.ts`

Responsibilities:
- Individual editor commands (fill template, translate, normalize, backlink, format, keymaker, C1 Richter)
- Orchestrate calls to **ai-api** and **filesystem** domains
- Receive plugin instance, editor, and file references from **plugin-core**

Boundary rules:
- Must not import from `obsidian` Plugin/PluginSettingTab APIs — only editor/vault types.
- Each command is a single default-exported function.

### 3. ai-api

**Files:** `api.ts`, `prompt.ts`, `prompts/index.ts`

Responsibilities:
- `ApiService` class: manages Google Generative AI client, chat sessions, and content generation
- Prompt registry (`prompts` object) that aggregates all prompt templates
- Legacy prompt file (`prompt.ts`) with inline templates

Boundary rules:
- Sole owner of external HTTP / AI-SDK calls.
- Must not touch the filesystem or Obsidian vault directly (receives `Vault` only for future extensibility).

### 4. filesystem

**Files:** `file.ts`, `utils.ts`

Responsibilities:
- Vault file and folder creation, reading, appending (`ensureFileExists`, `ensureFolderExists`, `appendToExistingFile`)
- Sharded directory structure for word files (`Worter/Ordered/…`)
- Markdown helpers: backlink extraction, selection formatting, markdown cleanup

Boundary rules:
- Operates exclusively through the Obsidian `Vault` API.
- Must not import or call any AI/API code.

### 5. prompt-engineering

**Files:** `prompts/*.ts` (individual template files)

Responsibilities:
- Self-contained prompt template strings for each LLM task (dictionary entry, valence, conjugation, translation, normalization, keymaker, C1 Richter)
- Exported as named constants, aggregated by `prompts/index.ts`

Boundary rules:
- Pure data (string constants); no runtime logic, no imports from other domains.
- Changes here affect LLM output quality but not plugin structure.

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

- **plugin-core** depends on **commands**, **ai-api**, and **filesystem**.
- **commands** depend on **ai-api** and **filesystem** (via plugin instance).
- **ai-api** depends on **prompt-engineering**.
- **filesystem** and **prompt-engineering** are leaf domains with no internal dependencies.
