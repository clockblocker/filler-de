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
