---
  Tier 1: Low effort, high value (do soon)

  #: 1
  Item: Rename src/documentaion/ → src/documentation/
  Source: PR #6 ideas
  What: The typo directory still exists. Bulk rename of 6+ files + CLAUDE.md refs. Standalone commit.
  Descision: Accepted

  ────────────────────────────────────────
  #: 2
  Item: Remove vestigial apiProvider setting
  Source: PR #22
  What: apiProvider: "google" is a typed literal with one option. Settings tab renders a pointless
    dropdown. Remove from types.ts, settings-tab.ts, api-service.ts, and locales.
  Descision: Rejected. apiProvider will be expanded later
  ────────────────────────────────────────
  #: 3
  Item: Healer as any elimination
  Source: PR #6 ideas
  What: Two makeNodeSegmentId(node as any) casts in healer.ts and leaf-move-healing.ts. Fix with
    overloads on makeNodeSegmentId. Aligns with project's anti-as philosophy.
  Descision: Accepted

  ────────────────────────────────────────
  #: 4
  Item: Placeholder command cleanup in main.ts
  Source: PR #6 ideas
  What: fill-template and duplicate-selection permanently return false. Plus check-ru-de-translation
    and check-schriben are TODO stubs. Remove or gate behind dev flag.
  Descision: Accepted

  ────────────────────────────────────────
  #: 5
  Item: Fold serializeDictNote() into dictNoteHelper facade
  Source: PR #7 ideas
  What: serialize-dict-note.ts is a thin wrapper. Add dictNoteHelper.serializeToString(), delete the
    file, update 5 imports. Consistent with stateless-helper facade pattern.
  Descision: Accepted


  Tier 2: Medium effort, solid value

  #: 6
  Item: Add API timeout to generate() call
  Source: PR #22
  What: client.chat.completions.parse() in api-service.ts has no timeout. If Gemini hangs, the plugin

    hangs forever. Wrap in Promise.race with 30-60s timeout.
  Descision: Accepted

  ────────────────────────────────────────
  #: 7
  Item: Extract propagation action collection helper
  Source: PR #7 ideas
  What: The push healingActions + push buildPropagationActionPair + return ok(ctx) epilogue is
    copy-pasted across all 4 propagation steps (~32 lines total). Extract into a shared function.
  Descision: Needs separate discssion. Add to the book of work

  ────────────────────────────────────────
  #: 8
  Item: Split literals.ts by domain
  Source: PR #6 ideas
  What: 760-line flat file spanning linguistics, UI, commands, infrastructure. Split into
    types/literals/linguistic.ts, ui.ts, commands.ts + barrel re-export.
  Descision: Accepted (need to consider killing it. It wat there when zod4 was conciderrd. no longer nesessary)

  ────────────────────────────────────────
  #: 9
  Item: Error type consolidation
  Source: PR #6 ideas
  What: TextfresserCommandError and LibrarianCommandError are independent types with similar
  patterns.
    A shared BaseCommandError enables unified error reporting.
  Descision: Accepted

  ────────────────────────────────────────
  #: 10
  Item: Add @generated header to prompt-smith codegen output
  Source: PR #6 ideas
  What: src/prompt-smith/index.ts is generated but committed alongside hand-written code with no
    marker. Document the regeneration workflow.

  Descision: Accepted


  Tier 3: Higher effort, longer-term

  #: 11
  Item: Audit in-progress loading indicator
  Source: PR #22
  What: The notify callback communicates results/errors but may not show "loading..." state during
  the
    API call itself. Worth auditing whether Lemma/Generate flows show in-progress UI.
  Descision: Needs separate discssion. Add to the book of work

  ────────────────────────────────────────
  #: 12
  Item: generate-sections.ts decomposition
  Source: PR #6 ideas
  What: Was 716 lines. V2 pipeline already extracted section formatters — check current size. If
  still
    large, split per-section-kind generators into separate files.
  Descision: Accepted. Add to the book of work
  ────────────────────────────────────────
  #: 13
  Item: Codec factory createEventCodec<TPayload>()
  Source: PR #6 ideas
  What: 8 event codecs in user-event-interceptor/events/ reimplementing similar encode/decode. A
    factory would reduce boilerplate. Marginal — works fine as-is.
  Descision: Needs separate discssion. Add to the book of work

  ────────────────────────────────────────
  #: 14
  Item: splitPath as-cast reduction
  Source: PR #6 ideas
  What: 96 as casts in split-path codec chains. Use overloads + discriminated unions. High effort but

    aligned with CLAUDE.md's explicit pattern.
  Descision: Accepted. Add to the book of work

  ────────────────────────────────────────
  #: 15
  Item: Unit test coverage expansion
  Source: PR #6 ideas
  What: Pure-logic modules first: codecs, vault-action-queue, section-healing. No Obsidian runtime
    deps needed.
  Descision: Accepted. Add to the book of work

  Tier 4: Verify against current code (bug fixes from PR #6)

  #: 16
  Item: Unsafe error.message access in catch blocks
  Source: PR #6 fix
  What: Catch blocks accessing error.message without instanceof Error narrowing. Check src/main.ts
  and
    tfile-helper.ts.
  Descision: Accepted. Add to the book of work

  ────────────────────────────────────────
  #: 17
  Item: Event listener leak in whenMetadataResolved()
  Source: PR #6 fix
  What: this.app.metadataCache.off("resolved", () => null) passes anonymous fn that never matches.
    Listener never removed. Check if still present in src/main.ts.
  Descision: Accepted. Add to the book of work


  Tier 5: Automated audit (2026-02-19)

  #: 18
  Item: Unit tests for stateless helpers (offset-mapper, block-id, markdown-strip)
  Source: Automated audit
  What: Pure utility modules in src/stateless-helpers/ have no dedicated test files. offset-mapper.ts
    has complex offset remapping logic, block-id.ts has parsing, markdown-strip.ts does markdown
    cleaning. All are pure functions — trivial to test with no Obsidian runtime deps.
    Complements #15 (unit test coverage expansion) with specific targets.
  Priority: P1

  ────────────────────────────────────────
  #: 19
  Item: OverlayManager test coverage
  Source: Automated audit
  What: src/managers/overlay-manager/ has zero test files despite being a complex orchestrator
    (selection toolbar, bottom toolbar, context menu, edge zones, action click dispatch). Add
    smoke tests for init/teardown lifecycle, workspace event handling, and action click routing.
  Priority: P1

  ────────────────────────────────────────
  #: 20
  Item: Extract magic numbers to named constants in event coalescing
  Source: Automated audit
  What: Hardcoded 250ms quiet window and 2000ms max window in bulk-event-emmiter.ts, 5000ms TTL
    in self-event-tracker.ts, 500ms navigation timeout in cd.ts. Extract to named constants with
    comments explaining the rationale for each value.
  Priority: P2

  ────────────────────────────────────────
  #: 21
  Item: Wrap undocumented Obsidian API accesses in cd.ts
  Source: Automated audit
  What: cd.ts uses multiple `as unknown` casts to access undocumented APIs (leftSplit.collapsed,
    app.commands.executeCommandById). Wrap these in a helper with try-catch and version comments
    so Obsidian API drift surfaces cleanly instead of crashing.
  Priority: P2

  ────────────────────────────────────────
  #: 22
  Item: API error catch block improvement in api-service.ts
  Source: Automated audit
  What: Line ~199 in api-service.ts uses empty catch with `___errors` — error info is discarded.
    Also, Promise.race() with timeout at line ~187 has non-obvious semantics (rejection from
    postGoogleApi propagates through race). Consider capturing error details in the catch and
    clarifying the timeout race pattern.
  Priority: P2

  ────────────────────────────────────────
  #: 23
  Item: Resolve calibration TODOs for numeric thresholds
  Source: Automated audit
  What: Several unresolved TODOs around tunable thresholds:
    - multi-span.ts:74 "search radius is a tunable parameter"
    - note-adapter.ts:134 "calibrate sampling cache size"
    - propagate-morphemes.ts:72 "calibrate this threshold"
    Either document current values with rationale or extract to a TUNABLE_PARAMS object.
  Priority: P2

  ────────────────────────────────────────
  #: 24
  Item: Document error handling decision tree
  Source: Automated audit
  What: Inconsistent patterns across codebase — some code uses logError() (auto-notice + log),
    some uses raw logger.error(), some catch blocks swallow silently. Add a brief section to
    CLAUDE.md or a docs file with when to use each:
    - Recoverable → neverthrow Result
    - Unrecoverable → logError() with notice
    - Expected → logger.warn()
    - Debug → logger.info()
  Priority: P2

  ────────────────────────────────────────
  #: 25
  Item: Retry config per-API profile
  Source: Automated audit
  What: retry.ts has a single DEFAULT_CONFIG (1s base, 3 attempts, 2x multiplier). API service
    has 45s timeout but uses generic retry. Allow passing custom retry profiles from ApiService
    for different call types (e.g., generate vs cache creation).
  Priority: P2

  ────────────────────────────────────────
  #: 26
  Item: OverlayManager teardown verification
  Source: Automated audit
  What: overlay-manager.ts stores selectionHandlerTeardown as a closure. If plugin is disabled
    without calling unload(), the handler reference persists in userEventInterceptor. Add explicit
    verification that all teardowns fire during unload(), or log a warning if they don't.
  Priority: P3

  ────────────────────────────────────────
  #: 27
  Item: Suffix extraction consolidation
  Source: Automated audit
  What: Suffix parsing logic appears in multiple codec files (split-path-with-separated-suffix,
    segment-id/parse.ts, wikilink.ts) with similar regex patterns. Consider extracting shared
    extractSuffix()/splitNameAndSuffix() helpers to reduce maintenance burden.
  Priority: P3

  ────────────────────────────────────────
  #: 28
  Item: Self-event tracker prefix matching optimization
  Source: Automated audit
  What: self-event-tracker.ts iterates all tracked prefixes for every incoming event (O(n) per
    event). For large vault operations with many folder renames, this could be slow. Consider a
    trie or sorted-prefix binary search if profiling shows this as a bottleneck.
  Priority: P3

  ────────────────────────────────────────
  #: 29
  Item: Path aliases in tsconfig.json
  Source: Automated audit
  What: 15+ files have deep relative imports (4-5 levels: ../../../managers/obsidian/...).
    Adding tsconfig path aliases (@managers/*, @commanders/*, @helpers/*) would improve
    readability. Lower priority since it works fine as-is and has refactoring risk.
  Priority: P3
