# Textfresser — Codebase Improvement Ideas

Prioritized by impact-to-effort ratio. Each idea includes affected files, estimated scope, and rationale.

---

## 1. Unit Test Coverage Expansion

**Impact**: High | **Effort**: High | **Priority**: 1

The largest gap: 11/14 Librarian submodules and 4/5 Obsidian manager submodules have zero unit tests. Overlay-manager has no coverage at all.

**Untested Librarian modules** (by risk):
- `commands/` — split-in-blocks, split-to-pages
- `vault-action-queue/` — action queue logic
- `section-healing/` — section repair logic
- `codecs/` — split-path codecs (96 `as` casts suggest fragile type boundaries)
- `wikilink-alias/` — alias resolution
- `paths/`, `errors/`, `librarian-init/`

**Untested Manager modules**:
- `behavior-manager/` — checkbox, clipboard, select-all, wikilink handlers
- `command-executor/` — command dispatch
- `user-event-interceptor/` — 8 event codecs
- `workspace-navigation-event-interceptor/`
- `overlay-manager/` — all toolbar/overlay UI logic

**Recommended approach**: Start with pure-logic modules (codecs, vault-action-queue, section-healing) that have no Obsidian runtime dependencies and can be tested with simple unit tests.

---

## 2. Error Type Consolidation

**Impact**: Medium | **Effort**: Low | **Priority**: 2

Two independent `CommandError` types exist:
- `src/commanders/textfresser/errors.ts` — TextfresserCommandError
- `src/commanders/librarian/errors.ts` — LibrarianCommandError

Both follow similar patterns but share no base type. A shared `BaseCommandError` with commander-specific extensions would improve error handling consistency and enable unified error reporting.

---

## 3. Codec Factory Extraction

**Impact**: Medium | **Effort**: Medium | **Priority**: 3

12 codec files across the codebase, with 8 clustered in `src/managers/obsidian/user-event-interceptor/events/`. Each codec file reimplements similar encode/decode patterns.

**Key files**:
- `events/click/action-element/codec.ts`
- `events/click/checkbox/codec.ts`
- `events/click/checkbox-frontmatter/codec.ts`
- `events/click/wikilink-click/codec.ts`
- `events/clipboard/codec.ts`
- `events/select-all/codec.ts`
- `events/selection-changed/codec.ts`
- `events/wikilink/codec.ts`

A `createEventCodec<TPayload>()` factory would reduce boilerplate while preserving type safety per payload kind.

---

## 4. `literals.ts` Domain-Based Splitting

**Impact**: Medium | **Effort**: Low | **Priority**: 4

`src/types/literals.ts` is 760 lines — a flat file of string constants spanning linguistics, UI, commands, and infrastructure domains.

**Suggested split**:
- `types/literals/linguistic.ts` — POS tags, morpheme types, grammatical constants
- `types/literals/ui.ts` — CSS classes, display strings
- `types/literals/commands.ts` — command names, action types
- `types/literals/index.ts` — re-exports for backward compat

---

## 5. `generate-sections.ts` Decomposition

**Impact**: Medium | **Effort**: Medium | **Priority**: 5

`src/commanders/textfresser/commands/generate/steps/generate-sections.ts` is 716 lines. It handles section generation for all POS types and linguistic units in a single file.

**Suggested decomposition**:
- Extract per-section-kind generators (one file per DictSectionKind)
- Keep `generate-sections.ts` as orchestrator (~100 lines)
- Each section generator receives typed context and returns formatted section content

---

## 6. `splitPath` As-Cast Reduction

**Impact**: Medium | **Effort**: High | **Priority**: 6

96 `as` casts involving `SplitPath` types across the codebase, concentrated in:
- `src/commanders/librarian/codecs/split-path-with-separated-suffix/`
- `src/commanders/librarian/codecs/locator/internal/`
- `src/commanders/librarian/codecs/library-path/`

**Root cause**: Generic `SplitPath<SK>` variants lose type narrowing through codec transformations.

**Suggested approach**: Enforce pathfinder-based construction (which already returns narrowed types) and use discriminated unions + overloads to propagate narrowing through codec chains. Per CLAUDE.md's "Prefer Overloads Over `as` Casts" pattern.

---

## 7. Placeholder Command Cleanup in `main.ts`

**Impact**: Low | **Effort**: Low | **Priority**: 7

`src/main.ts` (765 lines) has 2 placeholder commands that are permanently disabled:
- `"fill-template"` (line ~346) — `editorCheckCallback: () => { return false; }`
- `"duplicate-selection"` (line ~354) — `editorCheckCallback: () => { return false; }`

Additionally, 2 more commands appear to be TODO stubs:
- `"check-ru-de-translation"` (line ~395)
- `"check-schriben"` (line ~404)

Remove or gate behind a dev-mode flag to reduce dead code in the plugin entry point.

---

## 8. Healer Method Overloads to Eliminate `as any`

**Impact**: Low | **Effort**: Low | **Priority**: 8

2 `as any` casts in healer code:
- `src/commanders/librarian/healer/healer.ts` — `makeNodeSegmentId(node as any)`
- `src/commanders/librarian/healer/healing-computers/leaf-move-healing.ts` — `makeNodeSegmentId(node as any)`

Both indicate a type mismatch between tree node types and `makeNodeSegmentId`'s signature. Adding overloads to `makeNodeSegmentId` (or widening its input type with a union) would eliminate these unsafe casts.

---

## 9. Prompt-Smith Generated Artifact Management

**Impact**: Low | **Effort**: Medium | **Priority**: 9

`src/prompt-smith/codegen/` generates prompt registry files. Currently the generated output (`src/prompt-smith/index.ts`) is committed alongside source code with no clear separation between hand-written and generated artifacts.

**Suggestion**: Add a `// @generated` header to generated files and document the regeneration workflow in the prompt-smith architecture doc, so contributors know not to hand-edit generated files and how to re-run codegen.

---

## 10. Documentation Directory Typo

**Impact**: Low | **Effort**: Minimal | **Priority**: 10

The documentation directory is spelled `src/documentaion/` (missing the second 't' — should be `documentation`). This affects 6+ files and all import paths/references in CLAUDE.md. Rename to `src/documentation/` for professionalism and discoverability.

**Note**: This is a bulk rename that will touch CLAUDE.md, all doc file paths, and any code that references the directory. Best done as a standalone commit.
