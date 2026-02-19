# Book Of Work

## Deferred Follow-Ups (Morphological Relations)

### 1) Prefix derivations: avoid redundant `<derived_from>` with equation
- Status: Deferred by request.
- Current behavior: prefix cases can render both:
  - `<derived_from>` `[[base]]`
  - `[[prefix|decorated]] + [[base]] = [[source]] *(gloss)*`
- Follow-up decision to implement later: for inferred prefix derivations, render only the equation and skip `<derived_from>`.

### 2) Architecture doc table sync for Lexem POS section coverage
- Status: Deferred by request.
- Gap: `sectionsForLexemPos` in code includes `Morphology` for all Lexem POS, but the table in `/Users/annagorelova/work/Textfresser_vault/.obsidian/plugins/textfresser/src/documentaion/linguistics-and-prompt-smith-architecture.md` is only partially updated.
- Follow-up to implement later: update all POS rows in the table so docs exactly match `section-config.ts`.

---

## Post-Migration Cleanup (from PR review, 2026-02-19)

Source: ideas extracted from open PRs #6, #7, #13, #15, #16, #17, #22 in clockblocker/filler-de.

### Immediate (low effort)

#### 3) Rename `src/documentaion/` → `src/documentation/`
- Source: PR #6 ideas (#10)
- Typo directory still exists alongside correctly-spelled `documentation/` at repo root. Bulk rename of 6+ files + CLAUDE.md refs. Standalone commit.

#### 4) Healer `as any` elimination
- Source: PR #6 ideas (#8)
- Two `makeNodeSegmentId(node as any)` casts in `healer.ts` and `leaf-move-healing.ts`. Fix with overloads on `makeNodeSegmentId`.

#### 5) Placeholder command cleanup in `main.ts`
- Source: PR #6 ideas (#7)
- `fill-template` and `duplicate-selection` permanently return `false`. `check-ru-de-translation` and `check-schriben` are TODO stubs. Remove or gate behind dev flag.

#### 6) Fold `serializeDictNote()` into `dictNoteHelper` facade
- Source: PR #7 ideas
- `serialize-dict-note.ts` is a thin wrapper. Add `dictNoteHelper.serializeToString()`, delete the file, update 5 imports.

#### 7) Add API timeout to `generate()` call
- Source: PR #22
- `client.chat.completions.parse()` in `api-service.ts` has no timeout. Wrap in `Promise.race` with 30-60s timeout.

#### 8) `literals.ts` — consider killing or splitting by domain
- Source: PR #6 ideas (#4)
- 760-line flat file. Originally needed for Zod v4 considerations — may no longer be necessary. Either kill it or split into `types/literals/linguistic.ts`, `ui.ts`, `commands.ts` + barrel re-export.

#### 9) Error type consolidation
- Source: PR #6 ideas (#2)
- `TextfresserCommandError` and `LibrarianCommandError` are independent types with similar patterns. Shared `BaseCommandError` enables unified error reporting.

#### 10) Add `@generated` header to prompt-smith codegen output
- Source: PR #6 ideas (#9)
- `src/prompt-smith/index.ts` is generated but committed alongside hand-written code with no marker.

### Bug fixes to verify against current code

#### 11) Unsafe `error.message` access in catch blocks
- Source: PR #6 fix
- Catch blocks accessing `error.message` without `instanceof Error` narrowing. Check `src/main.ts` and `tfile-helper.ts`.

#### 12) Event listener leak in `whenMetadataResolved()`
- Source: PR #6 fix
- `this.app.metadataCache.off("resolved", () => null)` passes anonymous fn that never matches. Listener never removed. Check if still present in `src/main.ts`.

### Needs separate discussion

#### 13) Extract propagation action collection helper
- Source: PR #7 ideas
- The `push healingActions + push buildPropagationActionPair + return ok(ctx)` epilogue is copy-pasted across all 4 propagation steps (~32 lines). Extract into shared function.

#### 14) Audit in-progress loading indicator
- Source: PR #22
- The `notify` callback communicates results/errors but may not show "loading..." state during the API call itself. Worth auditing whether Lemma/Generate flows show in-progress UI.

#### 15) Codec factory `createEventCodec<TPayload>()`
- Source: PR #6 ideas (#3)
- 8 event codecs in `user-event-interceptor/events/` reimplementing similar encode/decode. A factory would reduce boilerplate. Marginal — works fine as-is.

### Longer-term

#### 16) `generate-sections.ts` decomposition
- Source: PR #6 ideas (#5)
- Was 716 lines. V2 pipeline already extracted section formatters — check current size. If still large, split per-section-kind generators.

#### 17) `splitPath` as-cast reduction
- Source: PR #6 ideas (#6)
- 96 `as` casts in split-path codec chains. Use overloads + discriminated unions. High effort but aligned with CLAUDE.md's explicit pattern.

#### 18) Unit test coverage expansion
- Source: PR #6 ideas (#1)
- Pure-logic modules first: codecs, vault-action-queue, section-healing. No Obsidian runtime deps needed.
