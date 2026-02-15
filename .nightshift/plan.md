# Guide Improver Plan

## Scope
Fix stale references, contradictions, and gaps in CLAUDE.md (the primary project guide) and AGENTS.md (its exact duplicate). Keep changes minimal and high-confidence — only fix things verified against the codebase.

## Changes

### 1. CLAUDE.md + AGENTS.md — Fix logging contradiction
Lines 203-205 say "Stringify objects" with `JSON.stringify(obj)` example.
Lines 347-360 say "No manual stringify" and mark `JSON.stringify` as BAD.
The actual logger (`src/utils/logger.ts`) auto-stringifies objects internally.
**Fix**: Remove the "Stringify objects" line from the earlier Logging section (line 205) and keep only the correct TypeScript Patterns logging section.

### 2. CLAUDE.md + AGENTS.md — Remove stale `librarian-pieces.md` reference
Line 75 references `librarian-pieces.md - Refactoring details` but this file does not exist.
**Fix**: Remove that line from the Documentation list.

### 3. CLAUDE.md + AGENTS.md — Add missing `linguistics-and-prompt-smith-architecture.md` to doc list
This file exists in `src/documentaion/` but is not listed in the Documentation section.
**Fix**: Add it to the documentation list.

### 4. CLAUDE.md + AGENTS.md — Fix typo in `librarian-architrecture.md`
Line 74 says `librarian-architrecture.md` (typo: "architrecture"). The actual file is `librarian-architecture.md`.
**Fix**: Correct to `librarian-architecture.md`.

### 5. CLAUDE.md + AGENTS.md — Add missing stateless helpers
The Stateless Helpers list is missing: `dict-note/`, `morpheme-formatter.ts`, `multi-span.ts`, `offset-mapper.ts`, `retry.ts`.
**Fix**: Add them to the list with brief descriptions.

### 6. CLAUDE.md + AGENTS.md — Update Textfresser commander file count
Line 49 says "~17 files" but Textfresser has grown significantly.
**Fix**: Update to current approximate count.

### 7. Fix logger.ts misleading docstring
Line 6 says "No object logging - stringify important parts only" but the implementation auto-stringifies objects.
**Fix**: Update docstring to reflect actual behavior.

## Files to modify
- `CLAUDE.md`
- `AGENTS.md` (keep in sync — identical copy)
- `src/utils/logger.ts` (docstring only)
