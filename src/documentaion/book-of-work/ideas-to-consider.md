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
## Automated Audit (2026-02-19, nightshift/idea-generator)

Source: static codebase analysis via Claude Code explore agent.
Items below are NEW findings not already tracked in book-of-work.md.

### P1 (correctness / safety)

#### A1) `dedupeByKey` aliased to different semantics across 3 locations
- `src/commanders/librarian/.../section-chain-utils.ts` re-exports `dedupeByKeyFirst` AS `dedupeByKey`
- `src/managers/.../collapse-helpers.ts` re-exports `dedupeByKeyLast` AS `dedupeByKey`
- `src/commanders/textfresser/domain/propagation/normalize.ts` re-exports `dedupeByKeyFirst` AS `dedupeByKey`
- Consumer code importing `{ dedupeByKey }` gets `First` or `Last` semantics depending on import path — silent correctness hazard.
- Fix: remove aliases, import `dedupeByKeyFirst`/`dedupeByKeyLast` explicitly at call sites.

#### A2) `hasUsableMetadataSignal()` likely always truthy
- File: `src/main.ts` (~line 152-154)
- `app.vault.getRoot()` returns root `TFolder` which exists as soon as vault opens — before metadata is actually resolved.
- This may cause `whenMetadataResolved()` to resolve too early, which explains the `sleep(300)` band-aid on line 106.
- Fix: check `app.metadataCache.resolvedLinks` population or rely solely on the `"resolved"` event.

#### A3) Definite assignment (`!`) on lazily-initialized fields without guards
- File: `src/commanders/librarian/librarian.ts` (~lines 98-99) — `codecs!: Codecs; rules!: CodecRules`
- Assigned in async `init()`, used in `handleBulkEvent()`, `processActions()`, etc. with no null guard.
- If a vault event fires before `init()` completes, these are `undefined` at runtime but TS won't catch it.
- The `healer` field in the same class correctly uses `null` with runtime guards — apply the same pattern.

### P2 (maintainability / performance)

#### A4) Unbounded `_debug*` arrays on production classes
- `src/commanders/librarian/librarian.ts` (~lines 102-105) — 4 `_debug*` fields accumulate every bulk event/tree action/healing action/vault action with no eviction.
- `src/managers/obsidian/vault-action-manager/impl/actions-processing/dispatcher.ts` (~lines 65-68) — `_debugAllSortedActions` grows across all batches.
- `src/managers/obsidian/vault-action-manager/impl/event-processing/bulk-event-emmiter/bulk-event-emmiter.ts` (~line 27) — `_debugAllRawEvents` accumulates every raw event.
- Fix: gate behind a debug-mode flag, or add a size cap (ring buffer / keep last N).

#### A5) Codec recreation on every hot-path call
- `src/commanders/librarian/healer/library-tree/codex/format-codex-line.ts` (~lines 41-62) — `makeCodecRulesFromSettings()` + `makeCodecs()` called per codex line during every codex regeneration.
- `src/commanders/librarian/healer/library-tree/codex/generate-codex-content.ts` (~lines 54, 96) — called twice per codex generation.
- `src/commanders/librarian/healer/library-tree/codex/parse-codex-click.ts` (~lines 69-70) — called per checkbox click.
- Settings don't change at runtime. The `Librarian` already holds `this.codecs`. Pass from caller or cache at module level.

#### A6) Swallowed exceptions with no logging
- `src/commanders/textfresser/orchestration/background/background-generate-coordinator.ts` (~line 241) — `catch { return; }` silently discards rejection reason for `inFlight.promise`.
- `src/managers/overlay-manager/context-menu/context-menu.ts` (~lines 80, 113) — catches any exception and silently falls back.
- `src/stateless-helpers/note-metadata/internal/json-section.ts` (~line 75) — JSON parse failures swallowed with `return null`.
- Fix: add `logger.warn` in each catch block.

#### A7) Magic timing numbers scattered inline
- `src/main.ts` lines 86, 106, 573 — `sleep(100)`, `sleep(300)`, `sleep(100)` with no named constants or rationale.
- `src/commanders/textfresser/orchestration/background/background-generate-coordinator.ts` (~line 245) — `sleep(300)` before scroll, undocumented.
- `src/managers/obsidian/vault-action-manager/impl/actions-processing/executor.ts` (~line 121) — `sleep(50)` purpose unknown.
- Fix: extract to named constants (e.g. `METADATA_SETTLE_DELAY_MS`) with brief rationale comments.

### P3 (cleanup / low effort)

#### A8) `UNUSED_STUB` dead code in error union
- File: `src/commanders/textfresser/errors.ts` (~lines 12, 21)
- `UNUSED_STUB` is in the enum and discriminated union but never constructed anywhere. Inflates switch exhaustiveness.
- Fix: remove from both the string array and the type union.

#### A9) `V3_SECTIONS` stale version label
- File: `src/commanders/textfresser/commands/generate/steps/section-generation-context.ts` (~line 8)
- "V3" is a migration-era label that now just means "current sections." Creates confusion.
- Fix: rename to `GENERATED_SECTIONS` or `CURRENT_PIPELINE_SECTIONS`.

#### A10) `testing*` public fields on production plugin class
- File: `src/main.ts` (~lines 58-61)
- `testingActiveFileService`, `testingReader`, `testingTFileHelper`, `testingTFolderHelper` — public properties on `TextEaterPlugin`, always instantiated even in production.
- Fix: wrap in a lazy `getTestingApi()` accessor (pattern already exists: `getHelpersTestingApi()`).

#### A11) `as any` casts in `ApiService` without required comments
- File: `src/stateless-helpers/api-service.ts` (~lines 100, 102, 113)
- Bridging Obsidian's `requestUrl` types with Web `fetch` `RequestInit` — legitimate but uncommented.
- CLAUDE.md rule: "each exception must be commented."
- Fix: add one-line comments explaining the Obsidian↔fetch type bridge.

#### A12) Hardcoded model name not configurable
- File: `src/stateless-helpers/api-service.ts` (~line 69) — `private model = "gemini-2.5-flash-lite"`
- Not derived from settings, cannot be changed without code change.
- Fix: expose in `TextEaterSettings` with a sensible default.

#### A13) TODO migration adapters never removed
- File: `src/commanders/librarian/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/error-adapters.ts` (~lines 5-27)
- `codecErrorToString()` and `adaptCodecResult()` are marked `TODO: Remove after full migration to CodecError` but still in use.
- Used in `canonicalize-to-destination.ts` at lines 118, 131, 145, 148.
- Fix: complete migration to `CodecError` types, then delete adapters.
