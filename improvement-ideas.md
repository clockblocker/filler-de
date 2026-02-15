# Textfresser Codebase Improvement Ideas

Prioritized list of improvements identified through static analysis.

---

## 1. Unit Test Coverage Expansion

**Impact: High | Effort: Medium**

Several core modules have no unit test coverage:

- **Commanders**: `src/commanders/librarian/` commands beyond healing/tree (e.g., `split-in-blocks`, `codex-generation`)
- **Managers**: `src/managers/overlay-manager/`, `src/managers/obsidian/behavior-manager/`
- **Prompt-smith**: `src/prompt-smith/` — prompt construction, schema validation, section formatters beyond the 37 existing tests

Current: 1008 tests across 87 files, but concentrated in healing, tree, segmenter, and textfresser steps. Expanding to untested modules would catch regressions in UI overlay logic, behavior dispatch, and prompt assembly.

---

## 2. Error Type Consolidation

**Impact: Medium | Effort: Low**

Librarian (`src/commanders/librarian/errors.ts`) and Textfresser (`src/commanders/textfresser/errors.ts`) define separate `CommandError` types with 4 identical error kinds (`NotMdFile`, `NotEligible`, `DispatchFailed`, `NoSelection`).

**Proposal**: Extract a shared `BaseCommandError` type with the common kinds into `src/commanders/shared/errors.ts`. Each commander extends it with domain-specific variants (Textfresser adds `ApiError`; Librarian may add its own in the future). This eliminates duplication and makes error handling more consistent across commanders.

---

## 3. Codec Factory Extraction

**Impact: Medium | Effort: Medium**

12 codec files across `user-event-interceptor/events/`, `librarian/healer/`, `vault-action-manager/`, and `bookkeeper/` share structural patterns: encode raw input → validate → return typed payload.

**Proposal**: Create a `createCodec<TRaw, TPayload>(config)` factory in `src/utils/codec-factory.ts` that standardizes the encode/decode pattern. Each codec becomes a thin config object rather than a full file. Reduces boilerplate and makes adding new event types faster.

---

## 4. `literals.ts` Domain-Based Splitting

**Impact: Medium | Effort: Low**

`src/types/literals.ts` is 761 lines with ~170 const exports covering linguistics, UI, grammar, discourse, and inflection domains — all in one file.

**Proposal**: Split into domain-scoped files under `src/types/literals/`:
- `linguistics.ts` — POS tags, morpheme types, linguistic units
- `grammar.ts` — cases, tenses, moods, persons, numbers
- `discourse.ts` — discourse formula roles, stylistic tones
- `ui.ts` — UI-related constants
- `index.ts` — re-exports all for backwards compatibility

This improves navigability and makes domain boundaries explicit.

---

## 5. `generate-sections.ts` Decomposition

**Impact: High | Effort: Medium**

`src/commanders/textfresser/commands/generate/steps/generate-sections.ts` is 717 lines — the largest single step file. It handles section generation for all POS types and linguistic units.

**Proposal**: Extract per-section generators into `generate-sections/` directory:
- `header-section.ts`
- `morphem-section.ts`
- `relation-section.ts`
- `inflection-section.ts`
- `translation-section.ts`
- `attestation-section.ts`
- `index.ts` — orchestrator that delegates to section generators

Each section generator becomes independently testable and the orchestrator stays under 100 lines.

---

## 6. `splitPath` `as`-Cast Reduction

**Impact: Low | Effort: Low**

The codebase has `as` casts when working with `splitPath` results, particularly where pathfinder could enforce type narrowing at the boundary instead.

**Proposal**: Audit `splitPath` call sites. Where pathfinder already guarantees the file kind (MdFile, Folder), use the overload signatures to get narrow return types directly. Eliminate remaining `as SplitPathToMdFile` casts by ensuring callers go through pathfinder's typed API rather than raw `splitPath`.

---

## 7. Placeholder Command Cleanup in `main.ts`

**Impact: Low | Effort: Low**

`src/main.ts` registers 4 commands that are no-ops (`return false`):
- `fill-template` (line ~346)
- `duplicate-selection` (line ~354)
- `check-ru-de-translation` with `// TODO: insertReplyFromKeymaker` (line ~395)
- `check-schriben` with `// TODO: librarian.ls` (line ~404)

**Proposal**: Remove these dead command registrations. They clutter the command palette and confuse users. If these features are planned, track them as issues rather than dead code.

---

## 8. Healer Method Overloads for `as any` Elimination

**Impact: Low | Effort: Low**

2 `as any` casts in healer code (`leaf-move-healing.ts:46`, `healer.ts:320`), both on `makeNodeSegmentId(node as any)`.

**Proposal**: Add an overload to `makeNodeSegmentId` that accepts the broader node type these callers have, or add a type guard that narrows the node before the call. Eliminates the last `as any` casts in the healer subsystem.

---

## 9. Prompt-Smith Generated Artifact Management

**Impact: Medium | Effort: Medium**

Prompt-smith generates schemas and examples under `src/prompt-smith/` but there's no clear boundary between hand-written prompt logic and generated/derived artifacts.

**Proposal**: Establish a `src/prompt-smith/generated/` directory for codegen output (e.g., `enshure-all-examples-match-schema.ts` outputs). Add a generation script to `package.json` and mark generated files with a `// @generated` header so they're excluded from manual editing and lint can warn on direct modifications.

---

## 10. Documentation Directory Typo Fix

**Impact: Low | Effort: Trivial**

`src/documentaion/` is misspelled (missing second "t"). Should be `src/documentation/`.

**Proposal**: Rename the directory and update all imports/references. This is a one-line rename but affects CLAUDE.md references and any tooling that references the path. Best done as a standalone commit to keep the diff clean.

---

*Generated 2026-02-15 by Nightshift idea-generator agent.*
