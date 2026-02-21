# Textfresser Wikilink Resolution Spec (Draft)

Status: Draft
Owner: Textfresser
Last updated: 2026-02-21

## Compatibility Policy (Dev Mode, 2026-02-20)

1. Textfresser is treated as green-field. Breaking changes are allowed; no backward-compatibility guarantees for Textfresser note formats, schemas, or intermediate contracts.
2. Librarian and VAM are stability-critical infrastructure. Changes there require conservative rollout, migration planning when persisted contracts change, and explicit regression coverage.

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

## Holistic model (design baseline, 2026-02-21)

### Wikilink sources

1. User-authored manual wikilinks (user wraps text in `[[...]]`).
2. Textfresser-authored wikilinks (Lemma/Generate/Propagation pipelines).

### Target families

1. Closed-set leaves in `Library` (grammar/function-word inventory).
2. Open-set lemma notes in `Worter`.
3. Open-set non-lemma notes in `Worter` (`inflection`/`variant` paths).

These three target families are the full routing space for lexical units across languages.

## Linguistic wikilink DTO (draft, 2026-02-21)

All Textfresser-produced dictionary-note wikilinks should be represented as linguistic wikilink DTOs during parse of note content into entry/entity DTOs.

### Core types

```ts
type LinguisticWikilinkSource = "UserAuthored" | "TextfresserCommand";

type LinguisticWikilinkIntent =
	| "ManualSurfaceLookup"
	| "LemmaSemanticAttestation"
	| "GenerateSectionLink"
	| "PropagationLink";

type LinguisticTargetRef =
	| {
			kind: "WorterSurfaceHost";
			language: string;
			surface: string;
	  }
		| {
			kind: "ClosedSetLibraryLeaf";
			language: string;
			coreName: string;
			suffixParts: string[];
		  }
	| {
			kind: "OpenSetWorterNote";
			language: string;
			unitKind: "Lexem" | "Phrasem" | "Morphem";
			surfaceKind: "Lemma" | "Inflected" | "Variant";
			basename: string;
	  };

type EntryBlockId = {
	posTag: string;
	featureTags: string[];
	senseIndex: number;
};

type LinguisticAnchorRef =
	| { kind: "BlockId"; value: EntryBlockId }
	| { kind: "Heading"; value: string }
	| null;

type LinguisticWikilinkDto = {
	source: LinguisticWikilinkSource;
	intent: LinguisticWikilinkIntent;
	displayText: string;
	target: LinguisticTargetRef;
	anchor: LinguisticAnchorRef;
};
```

### Resolved form (runtime)

```ts
type ResolvedLinguisticWikilinkDto = LinguisticWikilinkDto & {
	resolution:
		| {
				status: "Resolved";
				splitPath: string;
				resolver: "Obsidian" | "Librarian" | "Policy";
		  }
		| {
				status: "Unresolved";
				reason: string;
				candidates: string[];
		  };
};
```

### Rules tied to this DTO

1. DTOs are semantic-first; path rendering is a projection concern, not the source of truth.
2. Manual closed-set links use `target.kind = "WorterSurfaceHost"` by default.
3. Lemma attestation should emit `anchor.kind = "BlockId"` when target marker is known.
4. Non-Lemma generated links may omit anchor (`anchor = null`) unless a specific anchor target is intentionally requested.
5. Language matching for classification/resolution prioritizes active dictionary language, then configured target language.
6. Block-id anchors are structured, deterministic, and encode:
   - POS tag,
   - POS x language-specific lexical feature tags,
   - sense index.
   - sense index scope is per `(posTag + featureTags)` bucket (not global per note).
7. Markdown rendering uses compact serialized form:
   - `^<posTag>-<featureTags...>-<senseIndex>`
   - examples: `^noun-n-1`, `^verb-1`, `^prep-2`.
8. LLM-facing disambiguation payloads should use expanded objects (`id -> { pos, features, emojiDescription, ... }`) rather than raw compact IDs.
9. Go-back links are excluded from linguistic-wikilink DTO scope (Librarian navigation concern).
10. Parser/reader pipelines should strip/ignore go-back links before linguistic DTO extraction.
11. Dict-entry wikilinks (attestation, relation, inflection, morpheme) are in DTO scope.
12. Parse-time target granularity is rich (`LinguisticTargetRef` is fully populated at parse time); no basename-only unresolved target variant is used in DTOs.
13. `ClosedSetLibraryLeaf` is stored decomposed (`coreName + suffixParts`) in DTOs, not as raw basename.
14. Decomposition is done at parse time via Librarian suffix parser utility, respecting user-configured separator policy.
15. `source` and `intent` are derived from section ownership/context during parse; they are not stored as explicit markdown-level wikilink tags.
16. `LemmaPreflight` is runtime-only command state and is not part of persisted/parsed linguistic-wikilink DTOs.

### Examples

1. `[[aufpassen#^verb-sep-1|>Pass]]` -> `LemmaSemanticAttestation` + `OpenSetWorterNote` + `BlockId({ posTag: "verb", featureTags: ["sep"], senseIndex: 1 })`
2. `[[aufpassen#^verb-sep-1|auf<]]` -> same target/anchor, different `displayText`
3. `[[verbessern#^verb-1|verbessert]]` -> `LemmaSemanticAttestation` + `OpenSetWorterNote` + `BlockId`
4. `[[wir-personal-pronomen|Wir]]` -> `LemmaSemanticAttestation` + `ClosedSetLibraryLeaf` + `anchor = null`
5. Manual `[[Wir]]` (closed-set surface flow) -> `ManualSurfaceLookup` + `WorterSurfaceHost`

### Parse-time target derivation

1. Relation links are lemma-only targets by policy.
2. For relation links:
   - `surfaceKind` is `Lemma`.
   - unit/type inference uses relation-section type + current entry POS context.
   - language comes from current dictionary context.
   - fallback path: if context inference is insufficient, lookup existing target and collapse to Lexem target policy.
3. For inflection links:
   - infer inflection-target policy (`Inflected`) unless lemma-target reuse rule applies.
4. For morpheme links:
   - infer from morpheme DTO kind (closed-set German prefixes -> `Library`, others -> `Worter`).
5. For attestation links:
   - infer from attestation context and lemma/surface relation.

### Source and intent derivation

1. Section ownership rule:
   - `Freeform` section => `source = "UserAuthored"`
   - all other Textfresser-managed sections => `source = "TextfresserCommand"`
2. Intent mapping by section context:
   - Attestation section => `LemmaSemanticAttestation`
   - Relation/Morphology/Inflection/Morpheme sections => `GenerateSectionLink`
   - Propagation-only sections/markers (when explicitly detectable) => `PropagationLink`
   - Freeform section => `ManualSurfaceLookup`
3. If propagation provenance is not explicitly detectable at parse time, fall back to `GenerateSectionLink`.

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
4. Do not bake full vault paths into normal Textfresser-produced wikilinks.
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
3. Librarian exposes separator-aware suffix parsing utility used by Textfresser to decode `Library` basenames into `{ coreName, suffixParts }` when building linguistic DTOs.
4. `wikilinkHelper` performs syntax-safe normalization only; it must not encode business routing policy.

## Test plan requirements

1. Unit tests for `normalizeLinkTarget` and `normalizeWikilinkTargetsInText`.
2. Cases with anchors, aliases, `.md`, known roots, relative paths, and unknown slash targets.
3. Regression tests for previously broken generated notes (full path leakage in headers/morphemes/inflections).
4. Integration tests for Lemma/Generate rewrite flow to confirm consistent target rendering.

## Open questions

1. Resolver ordering by intent/phase still needs to be locked explicitly (Obsidian vs Librarian vs policy resolver).
2. Relative-path normalization behavior without source-file context still needs a final fallback contract.

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

### Locked policy: Closed-set surface hosts (updated 2026-02-21)

This policy is locked before Decision #10 (generation render default policy), because it defines the target structure that rendering must respect.

1. Canonical closed-set Lexem content home: `Library` (unchanged).
2. Manual surface handling: user-authored `[[surface]]` resolves to a `Worter` surface host note, not directly to a concrete `Library` leaf.
3. Surface-host creation trigger: eager on first closed-set encounter when no existing surface host note is available.
4. Invariant: all units that share a surface (within a language) share the same `Worter` note.
5. Surface-host content can mix:
   - open-set dictionary entries,
   - closed-set membership entries linking to `Library`,
   - other surface-level entries.
6. LLM-confirmed attestations (Lemma/Generate): link directly to the specific `Library` note selected by confirmed POS.
7. For closed-set links, semantic sub-sense targeting is not the default routing dimension.
8. Optional targeting is still allowed for niche cases (example: specific prefix sub-sense anchor).
9. Completion behavior must never auto-rewrite manual closed-set surfaces to a single concrete `Library` leaf.
10. Re-encounter policy: POS-confirmed re-encounters stay direct-to-`Library`; surface host is for manual/unconfirmed surface entry.

### Implementation v1 (concrete)

This section turns the locked policy into implementable behavior for the first rollout.

#### Surface-host storage model

1. No dedicated hub-only note type is required.
2. Closed-set memberships are represented as ordinary entries/stubs inside a `Worter` surface host note.
3. Existing open-set entries in that note remain valid and untouched.
4. Membership entry shape: header + id + link to resolved `Library` target + tags (same "multiple entries under one roof" principle).

Example:

```md
## über (Adjektiv) ^lx-adj-1
...

## über (closed-set membership) ^lx-cs-prep-1
- [[uber-praeposition-de|über (Preposition)]]
- #kind/closed-set #pos/preposition
```

#### Surface-host lifecycle

1. Reuse existing `Worter` surface host note when present (even if it already contains open-set entries).
2. If no suitable host exists, create/promote one on first closed-set encounter.
3. Keep membership entries updated when closed-set targets are added/renamed/deleted.
4. `unknown` temp note must be renamed or deleted at finalize; it never persists.

#### Link routing behavior

1. POS-confirmed Lemma/Generate attestations continue linking directly to specific `Library` note:
   - example: `[[die-pronomen-de|die]]`
2. Manual/unconfirmed `[[surface]]` lands on the surface host by default.
3. A single `Worter` note may contain both open-set entries and closed-set membership entries for the same surface.
4. Lemma attestation links should use target anchors when available (`#^...`) because that command is an explicit grammar lookup flow.
5. Non-Lemma generated links are not required to target anchors (low ROI); note-level target is acceptable.
6. Closed-set anchor targeting remains allowed when intentionally requested for niche cases.

#### Inflection-link routing

1. Inflection cells are wikilinks, not plain text.
2. For inflected surface `s`:
   - if `Worter/.../lemma/.../s.md` exists, resolve inflection link target to that lemma note and represent inflection as an additional dict entry in the same note.
   - otherwise resolve to `Worter/.../inflection/.../s.md`.
3. Rendered link text remains surface-first (`[[s]]`).

#### Morpheme-link routing

1. Morpheme routing is driven by morpheme DTO kind from LLM output.
2. German prefix morphemes classified as closed-set resolve to `Library`.
3. Other morphemes resolve to `Worter`.

#### Anchor encoding workflow

1. Parse markdown block-id anchor (for example `^noun-n-2`) into `EntryBlockId`.
2. Use `EntryBlockId` as structured anchor in internal DTO flows.
3. For disambiguation prompts, expand ID into rich objects (`pos`, decoded features, emoji description, sense metadata).
4. On serialization, encode `EntryBlockId` back to compact block-id string.
5. Treat per-POS/per-language feature-tag mapping as registry-driven policy, not hardcoded in generic wikilink helpers.
6. Allocate `senseIndex` sequentially within each `(posTag + featureTags)` bucket.

#### Lemma pre-query working-target lifecycle

1. One Lemma invocation owns at most one working target note.
2. Pre-query selection handling:
   - If selected surface is one word and already resolves to an existing `Worter` note, reuse that note.
   - Otherwise create a temporary working note at `Worter/.../unknown/.../{selected_text}.md`.
3. Insert clickable wikilink immediately before LLM calls (progress-first UX).
4. `unknown` path is temporary only; it must not remain after LLM finalization.
5. After LLM resolution:
   - Rewrite source attestation wikilink(s) to semantic final target(s).
   - If final target is open-set, move/rename the working note to canonical `Worter` destination.
   - If final target is closed-set, resolve/reuse/create `Worter` surface host note and append/update closed-set membership entry linking to resolved `Library` target.
   - If canonical destination already exists, delete temporary `unknown` note after merge/cleanup checks.
   - If user is currently inside the working note during closed-set finalize, navigate to the resolved closed-set note.
   - Rewrite source attestation to resolved closed-set target where applicable (example: `[[wir-personal-pronomen|Wir]]`).
   - LLM resolution uses full context and must either select an existing semantic/grammatical target or establish a new one.

#### Wikilink completion behavior (closed-set)

When user enters a manual closed-set surface:

1. Do **not** auto-pick a single `Library` leaf.
2. Preserve visible text as `[[surface]]` (no suffix-style rewrite in the source note).
3. Resolve destination to the `Worter` surface host note.

This supersedes nearest-leaf winner behavior that could silently rewrite to the wrong closed-set target.

#### Known gap (accepted in v1)

If a link was auto-rewritten earlier when only one closed-set match existed, and later additional matches appear, old links are not retroactively rewritten. This is accepted for v1.

#### Migration/backfill

Add a maintenance command:

1. Scan closed-set `Library` entries.
2. Ensure each surface has closed-set membership entries in a `Worter` surface host note (reuse existing notes where possible).
3. Preserve existing open-set entries; append/update only membership entries.

### Decided (2026-02-20 and 2026-02-21)

1. Comparison normalization location:
   - `trim + case-fold` comparison normalization is domain policy (not syntax helper policy).
   - Planned module location:
     - `src/commanders/textfresser/common/target-comparison.ts`
   - Migration intent: Textfresser call-sites should stop using `wikilinkHelper.normalizeTarget`.
2. Generation render default policy:
   - `formatLinkTarget(splitPath)` defaults to `basename`.
   - Path-baked rendering in normal Textfresser output is not the long-term policy target.
3. Manual closed-set routing policy:
   - Always prefer `Worter` surface-host routing for manual surface links.
   - Surface host can be mixed-role (open-set entries + closed-set membership entries).
   - Host creation is eager on first closed-set encounter when no host exists.
4. Anchoring policy:
   - Lemma attestation links should target specific anchors when available.
   - Other generated links do not mandate anchor targeting.
   - Block-id anchor format is structured and deterministic:
     - `^<posTag>-<featureTags...>-<senseIndex>`
     - feature-tags are POS x language dependent and registry-mapped.
   - `senseIndex` counter scope is per `(posTag + featureTags)` bucket.
   - LLM disambiguation uses expanded entry objects, not raw compact IDs.
5. `LibraryLeaf` DTO shape policy:
   - Keep decomposed fields in DTO (`coreName`, `suffixParts`), not raw basename.
   - Parse-time decomposition uses Librarian separator-aware suffix parser utility.
6. Language-precedence policy:
   - Resolve by active dictionary language first.
   - Fallback to configured target language.
7. DTO lifecycle policy:
   - Linguistic wikilink DTOs are created during note-content parse into entity/entry DTOs.
   - They are not introduced as separately persisted source-of-truth records.
8. Closed-set finalize policy:
   - Lemma closed-set finalize writes membership entry into a `Worter` surface host note (reuse existing open-set note when present).
   - No dedicated hub-only note type is required.
9. Unknown-lifecycle policy:
   - `Worter/.../unknown/...` notes are invocation-temporary and must be resolved by rename or deletion when Lemma finalization completes.

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
3. New design delta after 2026-02-21 decisions:
   - Spec now treats closed-set "hub role" as mixed-role surface-host entries, not as a dedicated note type.
   - Existing implementation currently has dedicated closed-set-hub modules in places; align in follow-up implementation slice.
4. Notes:
   - This status block is a snapshot of current branch/worktree state, not a release/merge guarantee.

### Decision backlog (to resolve separately)

1. Scope of first implementation slice:
   - Authoring-time normalization only, or full resolver now.
2. Final API boundary:
   - Exactly what stays in `wikilinkHelper` vs new policy module(s).
3. Lightweight DTO contract:
   - Lock or adjust the draft `LinguisticWikilinkDto` field set for parser and formatter pipelines.
4. Full resolver DTO contract:
   - Lock or adjust the draft `ResolvedLinguisticWikilinkDto` diagnostics and resolver provenance payload.
5. Target classification model:
   - Data-carrying discriminated `TargetKind` variants and required payload per variant.
6. Resolver precedence by intent/phase:
   - Final Obsidian vs Librarian vs policy-computed ordering for Lemma/Generate/Propagation/Click.
7. Bulk text rewrite contract:
   - Parse -> classify -> selective normalize -> reassemble behavior and opt-outs.
8. Naming cleanup:
   - Replace ambiguous names (`normalizeTarget`, `normalizeLinkTarget`) with intent-specific names.
9. Migration/deprecation timeline:
   - Call-site groups, test gates, and compatibility removal criteria.
