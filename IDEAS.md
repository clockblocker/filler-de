# Improvement Ideas

Generated: 2026-02-20 | Branch: `post_mirgation_cleanup`

---

## 1. Remove ~201 Unused Files Detected by Knip

**Severity**: High
**Effort**: Low (mechanical deletion after verification)
**Impact**: Reduces codebase noise, speeds up IDE indexing, cuts build graph

### Data

`bunx knip` reports 201 unused files, 339 unused exports, and 307 unused exported types. Main clusters:

| Cluster | ~Files | Notes |
|---------|--------|-------|
| `prompt-smith/prompt-parts/` | 170 | **False positive** — loaded at build time via `codegen:prompts` script (filesystem-based, invisible to static analysis) |
| `commanders/librarian/healer/` | 10 | Tree-action adapters, canonical-naming codec, duplicate healing |
| `commanders/textfresser/` | 8 | shard-path, apply-meta, propagation domain (index, intent-key, merge-policy, normalize, note-adapter, ports, types) |
| `types/` | 5 | `literals.ts`, `literals/commands.ts`, `literals/linguistic.ts`, `common-interface/maybe.ts` |
| misc | 8 | `sentence-splitter.ts`, `debounce-scheduler.ts`, `dom-waiter.ts`, VAM `events.ts`, `get-editor.ts` |

Unused dependencies: `sbd`, `@types/sbd` (sentence boundary detection — replaced by block-marker pipeline), `ts-plugin-sort-import-suggestions`, `typescript-eslint`.

### Next Steps

1. Add knip entry point for the codegen script in `knip.json` so prompt-parts are no longer false positives
2. Delete the ~31 genuinely unused files (healer, textfresser, types, misc clusters)
3. Remove unused dependencies: `sbd`, `@types/sbd`, `ts-plugin-sort-import-suggestions`
4. Run `bun run build && bun test` after each batch to catch false negatives
5. Tackle the 339 unused exports in a follow-up pass

---

## 2. Standardize Error Handling — 22 Files Still Use Raw `throw`

**Severity**: Medium
**Effort**: Medium
**Impact**: Consistent Result-based error flow; fewer uncaught exceptions at runtime

### Data

The codebase convention is `neverthrow` Result types (used in 92 files). However, 22 files still use raw `throw` with 37 total throw statements. Categories:

| Category | Files | Throws | Justification |
|----------|-------|--------|---------------|
| API/Network failures | `api-service.ts` | 5 | Caught by `withRetry()` wrapper — tolerable |
| Tree invariant violations | `healer.ts`, `tree.ts`, `compute-leaf-healing.ts` | 8 | "Should never happen" bugs — arguably correct |
| Background coordination | `background-generate-coordinator.ts` | 4 | Top-level bubbling — convert to Result |
| Retry exhaustion | `retry.ts` | 3 | Last-resort throws — wrap in ResultAsync |
| State validation | `global-state.ts`, `parsed-settings.ts`, `maybe.ts` | 3 | Defensive checks — convert to Result |
| Misc business logic | 11 other files | 14 | Mixed — triage individually |

### Next Steps

1. **Priority 1**: Convert `background-generate-coordinator.ts` (4 throws) — these are in the hot path of Generate command
2. **Priority 2**: Convert `retry.ts` to return `ResultAsync` — callers already expect neverthrow
3. **Priority 3**: Audit `api-service.ts` — throws inside `withRetry` are OK, but raw throws at top-level aren't
4. Leave tree invariant `throw`s as-is (they signal bugs, not recoverable errors)

---

## 3. Enable Stricter tsconfig Options

**Severity**: Medium
**Effort**: Low (fix warnings iteratively)
**Impact**: Catches dead variables/params at compile time; prevents new dead code

### Data

Currently disabled in `tsconfig.json`:
```json
"noUnusedLocals": false,
"noUnusedParameters": false
```

These flags would surface unused variables and function parameters as compile errors, complementing the knip-based unused-export analysis.

### Next Steps

1. Enable `noUnusedLocals: true` first — run `bun run typecheck:changed` to see scope of breakage
2. Fix violations (prefix unused params with `_`, remove dead locals)
3. Enable `noUnusedParameters: true` in a second pass
4. Both changes prevent future accumulation of dead code

---

## 4. Split Large Monolithic Files

**Severity**: Medium
**Effort**: High (refactoring with test verification)
**Impact**: Better navigability, smaller diff surface, easier code review

### Data

24 files exceed 300 lines. The top 5:

| File | Lines | Suggested Split |
|------|-------|-----------------|
| `textfresser/domain/propagation/note-adapter.ts` | 993 | Extract parsing logic, warning sampling, and format helpers into separate modules |
| `main.ts` | 822 | Extract initialization phases (settings, managers, commanders) into `init-*.ts` modules |
| `types/literals/linguistic.ts` | 586 | Data file — may be fine as-is if it's just enum/const declarations |
| `librarian/healer/codex/codex-impact-to-actions.ts` | 572 | Split by action type (ensure, process, write-status, backlink) |
| `librarian/librarian.ts` | 571 | Extract codex handling and healing delegation into sub-modules |

### Next Steps

1. Start with `main.ts` — extract `initManagers()`, `initCommanders()`, `registerCommands()` into focused modules
2. Split `note-adapter.ts` — the warning-sampling logic (lines 95–140) and format parsing are independent concerns
3. Leave `linguistic.ts` alone if it's pure data declarations
4. Verify with `bun run typecheck:changed && bun test` after each split

---

## 5. Audit Unsafe `as unknown` Type Casts

**Severity**: Medium
**Effort**: Low-Medium
**Impact**: Type safety; fewer runtime surprises from cast-masked bugs

### Data

9 files contain `as unknown` casts (13 total occurrences):

| File | Cast | Verdict |
|------|------|---------|
| `cd.ts:38,48` | Accessing non-public Obsidian API (`leftSplit.collapsed`, `commands`) | **Keep** — documented undocumented API access |
| `vault-reader.ts:107,113,118` | `tRef as unknown as TFolder/TFile` | **Fix** — add instanceof narrowing instead |
| `split-path-to-locator.ts:41` | Generic type correlation lost | **Fix** — use overloads per project convention |
| `canonicalize-to-destination.ts:119,226` | Generic result unwrapping | **Fix** — add overload signatures |
| `api-service.ts:274` | Zod v3/v4 boundary | **Keep** — documented version bridge |
| `facade.ts:358` | Accessing private `selfEventTracker` internals | **Fix** — expose via interface |
| `checkbox-behavior.ts:23` | Duck-typing librarian method | **Fix** — add proper interface |
| `idle-tracker.ts:20` | `window` extension for E2E | **Keep** — test-only bridge |

### Next Steps

1. Fix the 5 "Fix" items using proper narrowing, overloads, or interfaces
2. Keep the 3 "Keep" items but ensure they have explanatory comments (most already do)

---

## 6. Reduce Deep Relative Imports

**Severity**: Low
**Effort**: Medium (tsconfig paths + mass rewrite)
**Impact**: Readability; less fragile imports when files move

### Data

104 import statements have 4+ levels of `../`. The deepest reach 7–8 levels:

```
// 7 levels deep:
../../../../../../managers/obsidian/vault-action-manager/types/split-path
```

Hotspots: `librarian/healer/library-tree/tree-action/bulk-vault-action-adapter/` (deepest nesting in codebase).

Most deep imports target a few shared modules:
- `utils/logger` (from everywhere)
- `types/split-path` (from healer tree modules)
- `stateless-helpers/*` (from managers and commanders)

### Next Steps

1. Add tsconfig `paths` aliases: `@/utils/*`, `@/types/*`, `@/helpers/*`
2. Update the esbuild config to resolve the aliases
3. Migrate the 104 deep imports in batches (healer tree modules first)
4. Set a lint rule to warn on 4+ `../` levels going forward

---

## 7. Calibrate Tunable Parameters with TODO Markers

**Severity**: Low
**Effort**: Low (data collection + adjustment)
**Impact**: Correctness of fuzzy matching and sampling thresholds

### Data

Three parameters have explicit TODO-calibration markers:

| Parameter | File | Current Value | Purpose |
|-----------|------|---------------|---------|
| `SEARCH_RADIUS` | `stateless-helpers/multi-span.ts:75` | 50 chars | Anchor-calibrated span mapping for separable prefix verbs |
| `MORPHOLOGY_STEM_MATCH_MIN_LENGTH` | `generate/steps/propagate-morphemes.ts:65` | 4 chars | Minimum stem length for prefix-match equivalence |
| `WARN_SAMPLE_MAX_KEYS` | `propagation/note-adapter.ts:102` | 2000 keys | Warning dedup cache size before flush |

### Next Steps

1. Collect a sample of real separable-verb attestations to test `SEARCH_RADIUS` (50 may be too small for compound verbs)
2. Test `MORPHOLOGY_STEM_MATCH_MIN_LENGTH` against real morphology data — 4 chars prevents false positives like "ab" matching "abnehmen", but may miss valid 3-char stems
3. `WARN_SAMPLE_MAX_KEYS` at 2000 is reasonable for typical vaults — verify with large corpus stats

---

## 8. Consolidate Utils into Helper Facades

**Severity**: Low
**Effort**: Low
**Impact**: Consistency with project's `xxxHelper` facade philosophy

### Data

`src/stateless-helpers/` follows the facade pattern well (10+ `xxxHelper` modules). However, `src/utils/` has small standalone files that could be consolidated:

| File | Functions | Candidate Facade |
|------|-----------|-----------------|
| `array-utils.ts` | `dedupeByKeyFirst`, `dedupeByKeyLast` | `arrayHelper` |
| `text-utils.ts` | `extractHashTags` | `textHelper` or merge into `markdownStripHelper` |
| `delimiter.ts` | `buildCanonicalDelimiter`, `buildFlexibleDelimiterPattern` | `delimiterHelper` |

### Assessment

This is low-priority. The current utils are small (1–3 functions each) and creating facades for 2-function modules adds ceremony without much benefit. Consider consolidating only when these modules grow, or when new related functions are added.

### Next Steps

1. Defer unless new functions are added to these modules
2. If `text-utils.ts` grows, merge into `markdownStripHelper` (related concern)
3. If `array-utils.ts` grows, create `arrayHelper` facade with proper barrel export
