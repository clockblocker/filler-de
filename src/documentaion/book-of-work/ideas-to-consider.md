---
  Reviewed: 2026-02-19 (from open PRs #6, #7, #13, #15, #16, #17, #22)
  Accepted items moved to: documentation/book-of-work.md

  Rejected:

  #: 2
  Item: Remove vestigial apiProvider setting
  Source: PR #22
  What: apiProvider: "google" is a typed literal with one option. Settings tab renders a pointless
    dropdown. Remove from types.ts, settings-tab.ts, api-service.ts, and locales.
  Decision: Rejected. apiProvider will be expanded later
---

# Ideas to Consider

## Deep Audit — Textfresser Generate Pipeline (2026-02-19)

Source: automated codebase scan targeting duplication, dead code, type safety, testing gaps, and structural concerns in the generate/propagation pipeline.

### P1 (correctness risk)

#### 1) Two separate `parseEntryChunk` implementations with diverging behaviour
- Files: `domain/dict-note/internal/parse.ts`, `domain/propagation/note-adapter.ts`
- Both implement `parseEntryChunk(chunk, metaByEntryId)` walking the same chunk format. The propagation version is richer (typed section kinds, section sorting, sampled warnings) while dict-note's is simpler. Any on-disk format change must be applied in two places.
- Fix: extract shared header/chunk parsing primitive into `dict-note/internal/`, each caller applies its own section-level enrichment.

#### 2) Unguarded `as string` cast in `serialize-entry.ts`
- File: `commands/generate/steps/serialize-entry.ts`
- `noteMetadataHelper.upsert(fullMeta)` returns `string | Promise<string>`, result is cast `as string` without guard. `dictNoteHelper.serializeToString` has the correct guard-and-throw pattern.
- Fix: use the same guard-and-throw approach or delegate to `dictNoteHelper.serializeToString`.

### P2 (duplication / maintainability)

#### 3) `trimTrailingNewlines` duplicated in two sibling files
- Files: `steps/propagation-line-append.ts`, `steps/propagate-morphemes.ts`
- Identical private function. Similarly, `findNextMorphologyMarkerOffset` ≈ `findNextBlockMarkerOffset`.
- Fix: move both into `propagation-line-append.ts` (already imported by `propagate-morphemes.ts`).

#### 4) `EntriesMetaSchema` duplicated across two parsers
- Files: `domain/dict-note/internal/parse.ts`, `domain/propagation/note-adapter.ts`
- Both define `z.object({ entries: z.record(z.record(z.unknown())).optional() }).passthrough()` with the same `as any` Zod v3/v4 bridge cast.
- Fix: define once in `dict-note/internal/schema.ts` or `constants.ts`.

#### 5) Entry-construction pattern duplicated across 3 propagation steps
- Files: `propagate-morphemes.ts`, `propagate-inflections.ts`, `propagate-morphology-relations.ts`
- All three inline the same 4-line pattern: compute `existingIds` → `dictEntryIdHelper.buildPrefix(...)` → `dictEntryIdHelper.build(...)` → assemble `{ headerContent, id, meta: {}, sections }`.
- Fix: extract `buildNewEntry(headerContent, prefix, existingIds, sections)` factory.

#### 6) `UNUSED_STUB` dead error kind in `CommandError` union
- File: `commanders/textfresser/errors.ts`
- `CommandErrorKind.UNUSED_STUB` is never produced or matched. Remove it.

#### 7) Zod v4 imports in 3 files violate project `zod/v3` convention
- Files: `commanders/textfresser/errors.ts`, `commands/types.ts`, `domain/dict-entry-id/tags.ts`
- All use `import { z } from "zod"` (v4) but only v3-compatible features. Risk: schemas passed to v3-expecting code can trigger `_zod.run is not a function`.
- Fix: migrate to `"zod/v3"`.
- Cross-ref: related to book-of-work 2.2.

#### 8) `generateNewEntrySections` — positional index coupling in `Promise.allSettled` unwrap
- File: `commands/generate/steps/generate-new-entry-sections.ts`
- 6 LLM calls via `Promise.allSettled`, unwrapped by hard-coded indices (`settled[0]`..`settled[5]`). Adding/removing/reordering a prompt silently breaks the mapping.
- Fix: use named object → `Promise.allSettled([...])` with named destructuring.
- Cross-ref: complements book-of-work 2.1.

### P2 (testing gaps)

#### 9) `foldScopedActionsToSingleWritePerTarget` has no direct unit test
- File: `commands/generate/steps/propagate-core.ts`
- Critical contract: collapse multiple `UpsertMdFile` + `ProcessMdFile` pairs per target into a single composed transform. Only tested indirectly.
- Needed: multiple transforms composed in order, `UpsertMdFile` seed → `ProcessMdFile` chaining, dedup, failure path.

#### 10) `check-attestation`, `serialize-entry`, `move-to-worter` steps have no unit tests
- Files: `steps/check-attestation.ts`, `steps/serialize-entry.ts`, `steps/move-to-worter.ts`
- `checkAttestation` is the entry gate (two branches untested). `serializeEntry` has the unguarded cast (#2). `moveToWorter` has untested "already at destination" skip.

### P3 (code hygiene)

#### 11) `note-adapter.ts` decomposition targets (993 lines)
- File: `domain/propagation/note-adapter.ts`
- Suggested split: `wikilink-dto.ts`, `section-parsers.ts`, `section-serializers.ts`, thin orchestrator.
- Cross-ref: provides specific decomposition plan for book-of-work 2.1.

#### 12) Module-level mutable `warningCountBySampleKey` state
- File: `domain/propagation/note-adapter.ts`
- Sampling rate-limiter accumulates across Obsidian process lifetime. 2000-key cap clears entire map. Makes tests order-dependent.
- Fix: extract into factory function; production keeps singleton, tests get fresh state.

#### 13) Anonymous 120-line inline transform closure in `propagate-morphology-relations.ts`
- File: `steps/propagate-morphology-relations.ts` (Equation-kind branch)
- Untestable in isolation. Extract to named `buildEquationTransform(params)` top-level function.

#### 14) `MORPHOLOGY_STEM_MATCH_MIN_LENGTH = 4` needs calibration
- File: `steps/propagate-morphemes.ts`
- Magic constant with stale `TODO calibrate` comment. Add 5-10 real German morpheme test cases to lock in boundary behaviour.

#### 15) `CommandStateWithLemma` nested Omit type hurts hover clarity
- File: `commands/types.ts`
- Deep `Omit + intersection` expands at hover. Extract named `TextfresserStateWithLemma` interface.
