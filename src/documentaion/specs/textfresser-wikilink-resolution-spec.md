# Textfresser Wikilink Resolution Spec (Draft)

Status: Draft
Owner: Textfresser
Last updated: 2026-02-20

## Why this spec exists

Wikilink target resolution has grown across multiple helpers and call-sites. We need one explicit contract for how Textfresser resolves and rewrites link targets.

This spec moves the in-depth discussion out of BOW and defines the behavior we want before implementation/refactor.

## Key clarification

Slash-based phrase targets are not a valid routing signal by themselves.

Closed-set lexical classes are intentionally stored in `Library/...` and should be handled via explicit routing policy and known roots, not by generic "target has slashes" heuristics.

## Goals

1. Resolve wikilink targets deterministically and predictably.
2. Preserve meaningful user data (aliases and anchors).
3. Avoid accidental target corruption during normalization.
4. Keep Librarian and Textfresser responsibilities clear.

## Non-goals

1. No generic flattening rule based only on "many path segments".
2. No hidden routing side effects from arbitrary slash-separated strings.
3. No BOW-level design discussion; BOW should only point to this spec.

## Resolution contract

### Input forms we must support

1. Plain target: `[[Fahren]]`
2. Target with alias: `[[Fahren|fahrt]]`
3. Vault-root path target: `[[Worter/de/.../Fahren]]`, `[[Library/de/.../auf-prefix-de]]`
4. Relative target: `[[./Fahren]]`, `[[../verbs/Fahren]]`
5. Target with anchor: `[[Fahren#^b123]]`, `[[Worter/de/.../Fahren#Kontexte]]`
6. Target with `.md`: `[[Library/de/.../Fahren.md]]`

### Output invariants

1. Preserve `#...` anchors exactly.
2. Preserve alias text exactly.
3. Normalize only the target path part.
4. Return a stable basename-style wikilink target when the input is an explicit known vault path.
5. Do not flatten unknown slash-structured text.

### Known-root flattening rule

Flatten to basename only when target explicitly matches one of these known forms:

1. `Worter/...`
2. `Library/...`
3. `/Worter/...`
4. `/Library/...`
5. Relative forms `./...` or `../...` (resolved first, then normalized)
6. Explicit `.md` suffix path after known-root or relative resolution

If none of these forms match, keep the target path as-is.

## Proposed resolution pipeline

1. Parse wikilink into `{ target, alias, anchor }`.
2. Split anchor from target once and carry it through unchanged.
3. Classify target kind:
   1. Explicit known-root path.
   2. Relative path.
   3. Plain basename or unknown structured target.
4. Resolve candidate destination:
   1. Try Obsidian native resolution from source note context.
   2. If unresolved, use Librarian alias resolution where applicable.
   3. If command policy requires deterministic destination, compute Textfresser canonical target.
5. Normalize render target:
   1. If resolved as known-root/relative path, render basename.
   2. Otherwise keep original target text.
6. Reattach anchor and alias.

## Examples

1. `[[Worter/de/lexem/lemma/f/fah/fahre/Fahren]]` -> `[[Fahren]]`
2. `[[Library/de/prefix/auf-prefix-de|>auf]]` -> `[[auf-prefix-de|>auf]]`
3. `[[Worter/de/x/Fahren#^abc|fahrt]]` -> `[[Fahren#^abc|fahrt]]`
4. `[[domain/schema/field]]` -> `[[domain/schema/field]]` (unchanged)
5. `[[../Worter/de/x/Fahren.md#Kontexte]]` -> `[[Fahren#Kontexte]]` (after relative resolution)

## Responsibilities split

1. Textfresser decides policy target family (`Library` vs `Worter`) for its commands.
2. Librarian resolves aliases/tree semantics and keeps naming invariants.
3. `wikilinkHelper` performs syntax-safe normalization only; it must not encode business routing policy.

## Test plan requirements

1. Unit tests for `normalizeLinkTarget` and `normalizeWikilinkTargetsInText`.
2. Cases with anchors, aliases, `.md`, known roots, relative paths, and unknown slash targets.
3. Regression tests for previously broken generated notes (full path leakage in headers/morphemes/inflections).
4. Integration tests for Lemma/Generate rewrite flow to confirm consistent target rendering.

## Open questions

1. Should relative paths always be resolved to absolute split paths before normalization, or only when an active file context exists?
2. When Obsidian and Librarian resolution disagree, which resolver is authoritative per command phase?
3. Do we ever need to display full paths intentionally in advanced/debug modes?

## Alignment snapshot (2026-02-20)

This section captures agreed baseline decisions from brainstorming. It is not the final design of every edge case.

### Agreed baseline

1. Split syntax and policy responsibilities:
   - `wikilinkHelper` should be syntax-focused (parse/find/format-safe transforms).
   - Textfresser/Librarian routing policy should live outside `wikilinkHelper`.
2. Anchor must be a first-class field in link DTOs to avoid ad-hoc split/re-attach logic.
3. We must model two different operations explicitly:
   - Authoring-time normalization (sanitize LLM/text before persisting markdown).
   - Read-time resolution (map a clicked/entered target to an actual destination).
4. Two-tier DTOs are preferred:
   - Lightweight normalized DTO for formatter/guardrail pipelines.
   - Full resolver DTO for navigation/routing when split-path/provenance is needed.
5. Migration should keep a compatibility wrapper to avoid risky big-bang refactors across all call-sites.
6. `formatLinkTarget(splitPath)` is generation-side rendering (split-path -> link target string), not raw-text normalization. It is related policy, but a different direction in the pipeline.
7. Comparison normalization (current `normalizeTarget` behavior: trim + case-fold) is domain policy, not pure wikilink syntax.

### Locked policy: Closed-set surface hubs (2026-02-20)

This policy is locked before Decision #10 (generation render default policy), because it defines the target structure that rendering must respect.

1. Canonical closed-set Lexem content home: `Library` (unchanged).
2. Ambiguity handling: create/use a `Worter` surface hub when one surface maps to 2+ closed-set `Library` targets.
3. Hub creation trigger: lazy, on the second closed-set `Library` entry for the same surface.
4. Hub content: minimal disambiguation links to canonical `Library` targets; do not duplicate dictionary content.
5. LLM-confirmed attestations (Lemma/Generate): link directly to the specific `Library` note selected by confirmed POS.
6. Manual `[[surface]]`: should resolve to the `Worter` hub when it exists.
7. Completion behavior on ambiguity: stop silently picking one leaf target; do not auto-rewrite ambiguous unresolved links to a single winner.
8. Re-encounter policy: POS-confirmed re-encounters stay direct-to-`Library`; hub is for manual/unconfirmed surface entry.

### Implementation v1 (concrete)

This section turns the locked policy into implementable behavior for the first rollout.

#### Hub storage model

1. Hubs are not normal dict entries. They are dedicated surface-index notes.
2. Store hubs in a dedicated flat folder (not sharded dict-entry folders):
   - `Worter/de/closed-set-hub/{surface}.md`
3. Hub notes must include a cheap marker so pipelines can detect and skip dict-entry logic:
   - frontmatter marker: `textfresser.kind: closed-set-surface-hub`

Example:

```md
---
textfresser:
  kind: closed-set-surface-hub
  surface: die
---
# die

Possible closed-set targets:
- [[die-pronomen-de|die (Pronoun)]]
- [[die-artikel-de|die (Article)]]
```

#### Hub lifecycle

1. Create hub lazily when the second closed-set `Library` target for the same surface appears.
2. Keep hub updated when closed-set targets are added/renamed/deleted.
3. Keep hub even if it drops back to one target (do not break existing manual links).
4. Trash hub only when it has zero closed-set targets.

#### Link routing behavior

1. POS-confirmed Lemma/Generate attestations continue linking directly to specific `Library` note:
   - example: `[[die-pronomen-de|die]]`
2. Manual/unconfirmed `[[surface]]` should land on the hub when it exists:
   - example: `[[Die]]` resolves to `Worter/de/closed-set-hub/die.md`

#### Wikilink completion guard (critical fix)

In wikilink completion behavior, when unresolved link content has multiple Library leaf matches:

1. Do **not** auto-pick a single leaf.
2. Return passthrough (keep user-entered target unchanged).
3. This rule applies regardless of whether a hub already exists.

This replaces the current nearest-leaf winner behavior that can silently rewrite to a wrong closed-set target.

#### Known gap (accepted in v1)

If a link was auto-rewritten earlier when only one closed-set match existed, and later additional matches appear, old links are not retroactively rewritten. This is accepted for v1.

#### Migration/backfill

Add a maintenance command:

1. Scan closed-set `Library` entries.
2. Build/update `Worter/de/closed-set-hub/{surface}.md` notes.
3. Preserve existing hub links where possible; ensure all currently valid closed-set targets are present.

### Decided (2026-02-20)

1. Comparison normalization location:
   - `trim + case-fold` comparison normalization is domain policy (not syntax helper policy).
   - Planned module location:
     - `src/commanders/textfresser/common/target-comparison.ts`
   - Migration intent: Textfresser call-sites should stop using `wikilinkHelper.normalizeTarget`.
2. Generation render default policy:
   - `formatLinkTarget(splitPath)` will default to `basename`.
   - `computeFinalTarget()` will auto-fallback to full-path rendering for `Library` targets when basename lookup is ambiguous (`findByBasename(...)` returns multiple unique paths).
   - Explicit full-path rendering remains opt-in via `libraryTargetStyle: "full-path"`.

### Implementation status (worktree snapshot, 2026-02-20)

1. Implemented in current worktree:
   - Closed-set hub policy module and lifecycle actions:
     - `src/commanders/textfresser/common/closed-set-surface-hub.ts`
   - Generate pipeline hook for hub maintenance:
     - `src/commanders/textfresser/commands/generate/steps/maintain-closed-set-surface-hub.ts`
   - Backfill maintenance command:
     - `rebuild-closed-set-surface-hubs` in `src/main.ts`
     - Includes lookup-availability guard: command aborts when Librarian lookup wiring is unavailable.
   - Wikilink completion ambiguity guard (2+ matches -> passthrough):
     - `src/managers/obsidian/behavior-manager/wikilink-complition-behavior.ts`
   - Domain comparison normalization module + call-site migration:
     - `src/commanders/textfresser/common/target-comparison.ts`
   - Generation render policy update:
     - `formatLinkTarget()` basename default + Library ambiguity fallback in `src/commanders/textfresser/common/lemma-link-routing.ts`
   - Generate-time safety in degraded init states:
     - `maintainClosedSetSurfaceHub` is now a no-op when `TextfresserState.isLibraryLookupAvailable` is false.
2. Still open (design/rollout not finished):
   - Full API boundary cleanup between `wikilinkHelper` syntax responsibilities and policy modules.
   - Canonical lightweight/full DTO contracts with explicit anchor field across all call-sites.
   - Unified resolver precedence by command phase/intent (Obsidian vs Librarian vs policy-computed).
   - Bulk rewrite parse/classify/selective-normalize/reassemble contract finalization.
   - Deterministic manual `[[surface]]` preference for hub target in all contexts (not only ambiguity passthrough).
3. Notes:
   - This status block is a snapshot of current branch/worktree state, not a release/merge guarantee.

### Decision backlog (to resolve separately)

1. Scope of first implementation slice:
   - Authoring-time normalization only, or full resolver now.
2. Final API boundary:
   - Exactly what stays in `wikilinkHelper` vs new policy module(s).
3. Lightweight DTO contract:
   - Field names/types for normalized `{ target, anchor, alias, ... }`.
4. Full resolver DTO contract:
   - `splitPath`, `source`, diagnostics, and required/optional fields.
5. Target classification model:
   - Data-carrying discriminated `TargetKind` variants and required payload per variant.
6. Resolver precedence by intent/phase:
   - Obsidian vs Librarian vs policy-computed ordering for Lemma/Generate/Propagation/Click.
7. Bulk text rewrite contract:
   - Parse -> classify -> selective normalize -> reassemble behavior and opt-outs.
8. Naming cleanup:
   - Replace ambiguous names (`normalizeTarget`, `normalizeLinkTarget`) with intent-specific names.
9. Migration/deprecation timeline:
   - Call-site groups, test gates, and compatibility removal criteria.
