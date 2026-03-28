# Textfresser Rewrite Plan

## Why rewrite this area

`src/commanders/textfresser/**` still reflects the pre-extraction world where lexical generation lived inside this package. After the generator moved to `@textfresser/lexical-generation`, this package kept too many mixed responsibilities:

- Obsidian command wiring and background coordination
- lemma and generate orchestration
- dictionary note parsing and serialization
- attestation capture and rewrite
- filesystem scanning and target-path resolution
- propagation logic
- target-language section policy
- target-language section rendering

The result is not just "large". It is structurally misleading: modules named `common`, `domain`, `targets`, and `generate/steps` all depend on each other in both directions.

## Rewrite goals

1. Keep the Obsidian-facing command layer tiny.
2. Move all reusable vault, propagation, attestation, note, and metadata logic into a language-agnostic core.
3. Treat section rendering and section parsing as language-pack concerns.
4. Keep lexical generation fully outside this package. This package consumes lexical outputs; it does not own generation strategy.
5. Make it possible to add a new target language without editing "generic" core modules.

## Locked decisions

- Use a fixed core `SectionKey` vocabulary first, with extensions only if a real target language requires them.
- Preserve the current markdown surface format exactly in the first rewrite pass.
- Preserve unknown and manual sections as opaque raw sections during parse and serialize.
- Keep generation DTO-first: typed lexical DTOs become typed section DTOs, which are then rendered to markdown.
- Make propagation operate on parsed note objects as the primary model.
- Let the language pack decide section applicability.
- Keep translation acquisition as a core service and translation formatting as a renderer concern.
- Keep lemma-triggered background generate for now, but treat it as an Obsidian workflow coordinator behavior.
- Keep section-aware path resolution behind explicit routing contracts instead of one vague policy abstraction.
- Use the literal renderer/parser folder structure, but expose each language through a `pack.ts` entrypoint.

## What the current code tells us

### Existing strengths worth preserving

- `Textfresser` is already trying to act as a facade over commands and user-event handling.
- `domain/dict-note` already contains a mostly generic note shape.
- propagation has meaningful standalone concepts: note adapter, merge policy, normalization, and vault ports.
- target-path resolution and attestation rewriting already encode real vault invariants that should not be re-invented.

### Main structural leaks

- Generate mixes orchestration with target-specific section policy and rendering. See [src/commanders/textfresser/commands/generate/steps/generate-new-entry-sections.ts](/Users/annagorelova/work/Textfresser_vault/.obsidian/plugins/textfresser/src/commanders/textfresser/commands/generate/steps/generate-new-entry-sections.ts#L11) and [src/commanders/textfresser/commands/generate/steps/generate-new-entry-sections.ts](/Users/annagorelova/work/Textfresser_vault/.obsidian/plugins/textfresser/src/commanders/textfresser/commands/generate/steps/generate-new-entry-sections.ts#L121).
- "Generic" propagation note parsing depends on German section kinds, titles, and ordering. See [src/commanders/textfresser/domain/propagation/note-adapter.ts](/Users/annagorelova/work/Textfresser_vault/.obsidian/plugins/textfresser/src/commanders/textfresser/domain/propagation/note-adapter.ts#L12).
- Link propagation policy is encoded as German `DictSectionKind` knowledge in a shared module. See [src/commanders/textfresser/common/linguistic-wikilink-context.ts](/Users/annagorelova/work/Textfresser_vault/.obsidian/plugins/textfresser/src/commanders/textfresser/common/linguistic-wikilink-context.ts#L1).
- Filesystem lookup and path resolution are partially generic but still depend on target-specific section semantics. See [src/commanders/textfresser/common/target-path-resolver.ts](/Users/annagorelova/work/Textfresser_vault/.obsidian/plugins/textfresser/src/commanders/textfresser/common/target-path-resolver.ts#L21).
- Section policy is hard-coded under `targets/de`, but generic flows import it directly. See [src/commanders/textfresser/targets/de/sections/section-config.ts](/Users/annagorelova/work/Textfresser_vault/.obsidian/plugins/textfresser/src/commanders/textfresser/targets/de/sections/section-config.ts#L1).

## Target architecture

### 1. Tiny Obsidian adapter

The Obsidian-facing surface should be reduced to:

- command registration
- command input extraction from Obsidian context
- event hookup for wikilink clicks
- notification and scroll behavior
- dependency assembly

This layer should not know:

- how sections are chosen
- how note bodies are parsed or serialized
- how propagation works
- how attestation is merged
- how target-language rendering works

Suggested shape:

```text
src/commanders/textfresser/
  obsidian/
    textfresser-facade.ts
    command-adapter.ts
    event-adapter.ts
    notifications.ts
```

### 2. Language-agnostic core

This module owns all behavior that should be identical across languages:

- attestation resolution and source rewriting
- vault scanning and lookup policy
- target-path resolution
- placeholder and rename policy
- dictionary note abstraction
- entry identity / note metadata abstraction
- propagation planning and merge behavior
- command use cases for lemma, generate, and translate

Suggested shape:

```text
src/commanders/textfresser/core/
  commands/
    run-lemma.ts
    run-generate.ts
    run-translate.ts
  attestation/
  notes/
  propagation/
  vault/
  entries/
  state/
  contracts/
```

### 3. Language packs

Everything that varies by target language should live behind a language-pack contract:

- section catalog for that language
- section ordering
- display titles / css markers
- section parser registry
- section renderer registry
- section link policy
- any LU/POS-specific behavior

Suggested shape:

```text
src/commanders/textfresser/languages/
  de/
    pack.ts
    section-catalog.ts
    renderers/
      lexem/
        noun/
        verb/
        adjective/
      phrasem/
      morphem/
    parsers/
      lexem/
        noun/
        verb/
        adjective/
      phrasem/
      morphem/
```

If you want the exact filesystem pattern to match your idea more literally, use:

```text
renderers/{target_lang}/{lu}/{pos-like}
parsers/{target_lang}/{lu}/{pos-like}
```

I would still keep a `pack.ts` entrypoint per language so the rest of the system never imports those folders directly.

## Core contracts

The rewrite should start by defining contracts, not by moving files.

### Language pack contract

```ts
type SectionKey =
  | "header"
  | "attestation"
  | "translation"
  | "relation"
  | "morphem"
  | "morphology"
  | "inflection"
  | "tags"
  | "freeform"
  | "deviation";

type LanguagePack = {
  targetLang: TargetLanguage;
  sectionCatalog: SectionCatalog;
  propagationPolicy: PropagationPolicy;
  renderers: SectionRendererRegistry;
  parsers: SectionParserRegistry;
};
```

Important: `SectionKey` is core-stable, while titles and css markers are language-pack data.
`NoteCodec` is core-owned and parameterized by the language pack. The pack supplies section metadata, marker/title mapping, parsers, renderers, and ordering policy; it does not own a separate codec.

Prefer one `SectionSpec` per `SectionKey` over several loosely-related registries.

```ts
type SectionSpec = {
  key: SectionKey;
  marker: string;
  titleFor(targetLang: TargetLanguage): string;
  order: number;
  appliesTo(input: SectionApplicabilityInput): boolean;
  linkPolicy: SectionLinkPolicy;
  claimPolicy: SectionClaimFallbackPolicy;
  parser?: SectionParser;
  renderer?: SectionRenderer;
};
```

Applicability, ordering, marker/title mapping, link policy, parser claim rules, and renderer selection should move together to avoid drift.

## Contracts to freeze first

These contracts should be named and agreed before implementation starts. They are the real stability boundary for the rewrite.

### EntryIdentity

Defines entry identity beyond `id: string`:

- parsed ID shape
- index semantics
- unit/POS matching rules
- surface-kind tolerance where current behavior depends on it
- next-index allocation rules

### EntryMatchPolicy

Defines re-encounter matching behavior:

- how `matchedIndex` is interpreted
- how existing entries are selected
- propagation-only stub detection
- manual-link escape hatches that prevent stub classification

This should be frozen as a decision table backed by fixtures before any structural refactor:

- matching ignores `surfaceKind` where current behavior does
- next-index allocation still respects the current ID-prefix space
- stub detection depends on both section presence and wikilink intent

### NoteCodec

One canonical note codec for Textfresser notes:

- parse note text into entries and sections
- preserve raw unsupported sections
- serialize entries back to note text
- apply current canonicalization rules for typed sections

Propagation must consume this canonical parsed note model. It should not own a second codec or a second structural note model.

### SectionClaimFallbackPolicy

Defines when a parser is allowed to claim a section as typed:

- if a parser can parse and reserialize a section losslessly enough for current behavior, it may claim it
- otherwise the entire section stays raw

This must be pinned to fixtures and snapshots:

- if `parse -> serialize` changes any approved typed-section fixture beyond current canonicalization rules, the parser must not claim that section
- approved canonicalization must itself be fixture-backed and explicit

### RoutingPorts

Routing must be split by workflow, not hidden in one generic port:

- lemma routing
- propagation routing
- morpheme/library routing

Each routing contract must explicitly cover current precedence and fallback rules.
Implementation should use one shared routing engine with workflow-specific entrypoints, not three unrelated routing implementations.

### GenerateSessionCoordinator

Defines the async/session behavior around background generate:

- state snapshotting
- pending-request coalescing
- ownership and empty-target cleanup
- cache handoff
- deferred scroll behavior

Prefer an explicit result payload over mutable-state diffing:

```ts
type GenerateSessionResult = {
  actions: VaultAction[];
  targetBlockId?: string;
  failedSections: string[];
  cacheUpdates?: {
    generatedEntryId?: string;
  };
};
```

### Note abstraction

Core should stop treating section `kind` as the raw css suffix. The note model should become:

```ts
type TypedNoteSection = {
  kind: "typed";
  key: SectionKey;
  marker: string;
  title: string;
  content: string;
};

type RawNoteSection = {
  kind: "raw";
  rawBlock: string;
  marker?: string;
  title?: string;
  key?: SectionKey;
};

type NoteSection = TypedNoteSection | RawNoteSection;

type DictEntry = {
  id: string;
  headerContent: string;
  meta: DictEntryMeta;
  sections: NoteSection[];
};
```

The language pack is responsible for mapping `SectionKey <-> marker/title`.
The raw-section variant is required for exact round-trip preservation of unsupported, duplicate, or user-authored sections.
For typed sections, preservation should follow current canonicalization behavior rather than byte-for-byte stability.

### Generation input contract

This package should consume completed lexical outputs, not call generator internals all over the place.

```ts
type GenerationInput = {
  lemma: LemmaResult;
  lexicalInfo: LexicalInfo;
  targetLang: TargetLanguage;
};
```

The command flow may still call `@textfresser/lexical-generation`, but only through a narrow gateway. The rest of the code should receive typed results, not a service object.

Generation output should stay layered:

```ts
type SectionDto = {
  key: SectionKey;
  data: unknown;
};
```

Flow:

- lexical generation returns typed lexical DTOs
- language-specific generators convert lexical DTOs into section DTOs
- renderers convert section DTOs into markdown sections

### Routing and workflow ports

Core logic should depend on smaller ports rather than one catch-all vault port.

```ts
type FileMutationPort = {
  exists(path: SplitPathToMdFile): boolean;
  read(path: SplitPathToMdFile): Promise<Result<string, VaultError>>;
  dispatch(actions: VaultAction[]): Promise<Result<void, VaultError>>;
};

type LookupPort = {
  findByBasename(name: string): SplitPathToMdFile[];
  resolveLinkpathDest?(
    linkpath: string,
    from: SplitPathToMdFile,
  ): SplitPathToMdFile | null;
};

type SessionPort = {
  getCurrentFilePath(): SplitPathToMdFile | null;
  navigateTo?(path: SplitPathToMdFile): Promise<Result<void, VaultError>>;
  scrollToBlockId?(blockId: string): void;
};
```

Keep `VaultActionManager` at the edge, but do not pretend all workflows need the same subset of its capabilities.
Capability requirements must be explicit by use case:

- `runLemma` requires file mutation, basename lookup, linkpath resolution, current-file lookup, and navigation
- `runGenerate` requires file mutation and basename lookup, but not navigation
- deferred scrolling belongs to `GenerateSessionCoordinator` / Obsidian edge behavior, not generic generate core

Shared lookup fallback, case normalization, and link normalization should live in core services. Workflow-specific routing behavior should be layered on top of those shared services.

## Rewrite responsibilities by module

### Obsidian adapter

- `executeCommand`
- notify user
- scroll to target block
- bridge active selection / clicked wikilink into core command input

### Core command use cases

- `runLemma`
  - resolve attestation
  - compute pre-prompt placeholder target
  - call lexical gateway for lemma resolution
  - compute final target
  - build rewrite plan
  - update state

- `runGenerate`
  - load and parse target note
  - resolve entry match
  - decide re-encounter vs new entry
  - request section rendering from language pack
  - plan propagation
  - serialize note
  - return explicit session outputs for coordinator handoff

- `runTranslate`
  - take selected text / block
  - call translation gateway
  - build write action

### Core notes

- canonical note parse/serialize shell
- entry metadata abstraction
- stable section ordering by language-pack policy, while preserving original order for ties and opaque/raw sections
- typed entry match helpers
- shared linguistic wikilink normalization service

### Core propagation

- parse only the sections that matter for propagation
- normalize propagation payloads
- dedupe and merge
- compute target write plans
- fold writes by target file only after object-level merge planning

Core propagation should operate on `SectionKey` and typed payloads, never on German section constants.
Core propagation should consume the canonical parsed note model plus typed section extractors, not a second propagation-specific note codec.

### Language pack

- decide which sections exist for each `lu` and `pos-like`
- render each section from lexical input
- parse each section back into typed propagation payloads
- own titles, css suffixes, and display order
- own section-to-link-policy mapping

Freeform and manual content should remain opaque by default. A section only becomes typed if a language parser explicitly claims it.

## Proposed folder layout

```text
src/commanders/textfresser/
  obsidian/
    textfresser-facade.ts
    command-adapter.ts
    event-adapter.ts

  core/
    commands/
      run-generate.ts
      run-lemma.ts
      run-translate.ts
    attestation/
      resolve-attestation.ts
      rewrite-source-content.ts
    entries/
      entry-id.ts
      match-entry.ts
    notes/
      dict-note.ts
      note-codec.ts
      note-meta.ts
      linguistic-wikilink-normalizer.ts
    propagation/
      planner.ts
      merge-policy.ts
      types.ts
    vault/
      target-paths.ts
      fs-scan.ts
      write-plan.ts
      ports.ts
    lexical/
      gateway.ts
      types.ts
    state/
      session-state.ts
    contracts/
      section-key.ts
      language-pack.ts
      command-types.ts

  languages/
    de/
      pack.ts
      section-catalog.ts
      renderers/
        lexem/
          adjective/
          noun/
          verb/
        phrasem/
        morphem/
      parsers/
        lexem/
          adjective/
          noun/
          verb/
        phrasem/
        morphem/
```

## Migration plan

### Phase 0. Freeze behavior

- extend the existing test baseline around current note parse/serialize behavior
- extend tests for attestation rewrite behavior
- extend tests for propagation write folding
- extend tests for target-path resolution and healing
- keep current regression coverage for exact raw round-tripping, duplicate-section preservation, re-encounter matching, stub detection, and background generate coordination

Start from the existing baselines, not from zero. Do this before moving code, otherwise the rewrite will drift.

### Phase 1. Introduce contracts

- add `SectionKey`
- add `LanguagePack`
- freeze `SectionSpec`
- freeze `EntryIdentity`
- freeze `EntryMatchPolicy`
- freeze the canonical `NoteCodec`
- freeze `SectionClaimFallbackPolicy`
- freeze routing ports for lemma, propagation, and morpheme/library resolution
- freeze `GenerateSessionCoordinator`
- add lexical gateway interface
- add a generic `DictEntry` / `NoteSection` model

No behavior change yet.

### Phase 2. Wrap current German behavior as a pack

- move `targets/de/**` under `languages/de/**`
- expose one `dePack`
- adapt current titles, css suffixes, ordering, and section lists into the pack
- keep old internals calling the new pack through an adapter

Goal: prove the contract without changing behavior.

### Phase 3. Move generic note logic into core

- move `dict-note` into `core/notes`
- split generic note shell from language-specific section mapping
- make section sorting and marker rendering depend on pack data, not German imports
- preserve duplicate-section round-tripping and raw passthrough exactly
- move linguistic wikilink normalization into a shared core service

### Phase 4. Move propagation into core

- move `domain/propagation` into `core/propagation`
- replace `DictSectionKind`/css-suffix coupling with `SectionKey`
- move section parse/render specifics into language parsers

This is the hardest phase because current propagation parsing is the most contaminated generic layer.
The target end state is object-first propagation: parse note -> merge typed section payloads -> serialize note.
Propagation must consume the canonical note codec output plus typed section extractors. Do not preserve a second propagation-specific note model.

### Phase 5. Rewrite generate around the new contracts

- replace `generate/steps/**` with one core generate use case plus a small set of helpers
- separate:
  - entry resolution
  - lexical data acquisition
  - section planning
  - section rendering
  - propagation planning
  - note serialization
- make entry matching and propagation-only stub detection explicit core behavior, not incidental generate-step behavior

### Phase 6. Shrink the Obsidian adapter

- keep `Textfresser` or replace it with a facade
- move all business logic out of the class
- keep only dependency assembly, notifications, and event plumbing

### Phase 7. Delete legacy folders

- remove `targets/`
- remove `commands/generate/section-formatters`
- remove German-specific imports from `common/` and `domain/`
- collapse obsolete helper layers

## Non-goals

- rewriting lexical generation prompts or algorithms
- changing vault-level note format unless required by the language-pack abstraction
- broad UX changes to Obsidian command behavior

## Risks

### Risk 1. Over-generalizing too early

If we invent a perfectly abstract multi-language system before capturing current German invariants, we will build the wrong interfaces.

Mitigation:

- define only the contracts needed by the existing German pack first

### Risk 2. Core still leaks language-specific identifiers

If `SectionKey` is not introduced early, the rewrite will merely move German files around.

Mitigation:

- ban imports from `languages/*` into `core/*`

### Risk 3. Note format drift

If parse/serialize semantics change during refactor, re-encounter and propagation will become unstable.

Mitigation:

- snapshot and E2E tests before moving behavior
- define preservation precisely:
  - raw sections preserve bytes
  - typed sections preserve current canonicalization behavior

### Risk 4. Async/session workflow drift

The main migration risk is not the top-level facade. It is preserving background-generate behavior: state snapshotting, pending-generate coalescing, target ownership cleanup, and result handoff back into live session state.

Mitigation:

- keep background generate coordination as an explicit migration track with dedicated regression coverage
- do not fold async coordinator changes into unrelated module moves
- prefer explicit `GenerateSessionResult` handoff over snapshot-and-copy mutable state

## Acceptance criteria

- Obsidian-facing files do not import language-specific section modules directly.
- Core modules do not import from `languages/*`.
- Adding a second target language requires creating a new language pack, not editing core.
- Propagation, attestation, vault scanning, and note serialization run through core contracts.
- The only lexical-generation dependency in command flow is a narrow gateway.
- Current German behavior passes unit tests and the existing CLI E2E suite.
- Duplicate sections, raw unsupported sections, and manual sections survive round-trip unchanged.
- Re-encounter matching and propagation-only stub handling behave exactly as they do today.
- Background generate preserves current coalescing, cleanup, and state-handoff behavior.
- There is one canonical `NoteCodec`, and propagation consumes it instead of maintaining a second note model.

## Decisions applied to implementation

### 1. `SectionKey` is core-stable

Use a global core `SectionKey` set first. Do not start with arbitrary per-language section identifiers in core.

### 2. Unknown sections are preserved

The core note model must keep opaque raw sections so user-authored or future sections survive round trips.
This also covers duplicate sections and sections that are recognized structurally but not claimed semantically by a typed parser.

### 3. Parsing is layered

The note codec must recognize every section marker needed for full round-tripping. Typed semantic parsers are only required for propagation-relevant sections.
Freeform/manual content stays opaque unless a specific parser opts into a typed representation.
If a parser cannot safely provide current-behavior round-tripping for a claimed section, it must leave the section raw.
That safety bar is determined by fixtures and snapshots, not judgment in the abstract.
Linguistic wikilink normalization is a shared core concern; language packs decide only the section semantics around normalized links.

### 4. Generation remains DTO-first

The rewrite must preserve the existing conceptual pipeline:

- typed lexical DTOs
- typed section DTOs
- markdown rendering

Core should work on DTOs and note objects, not markdown-first section generation.

### 5. Section applicability is owned by the language pack

Core asks the language pack which sections apply for a given LU/POS-like combination.
Entry matching itself does not belong to the language pack; it belongs in `core/entries`.

### 6. Translation stays split between service and renderer

Translation acquisition is a service concern. Translation section layout is a renderer concern.

### 7. Background generate stays at the Obsidian workflow layer

Lemma can continue to trigger background generate, but this remains edge orchestration rather than core domain logic.

### 8. Propagation is object-first

Propagation should parse target notes into objects, merge typed payloads there, then serialize once.

### 9. Path resolution sees semantics only through policy

Filesystem and target-path logic must not import language-specific section modules directly.
Instead, routing behavior should be split into explicit workflow contracts:

- lemma routing
- propagation routing
- morpheme/library routing

Those contracts must be explicit about:

- lookup precedence
- normalization and case fallback
- healing asymmetry
- special routing rules such as reusable Worter hosts, unknown placeholders, closed-set fallback, and morpheme or library routing

Use one shared routing engine for common lookup and normalization behavior, with workflow-specific entrypoints for lemma, propagation, and morpheme/library routing.

### 10. First pass preserves the note surface format

Do not mix architecture cleanup with note-format cleanup.

## Recommended implementation order

1. Extend existing tests around note round-tripping, attestation rewrite, path resolution, propagation, re-encounter matching, and background generate coordination.
2. Freeze contracts first: `SectionSpec`, `EntryIdentity`, `EntryMatchPolicy`, canonical `NoteCodec`, `SectionClaimFallbackPolicy`, routing ports/engine, and `GenerateSessionCoordinator`.
3. Introduce `SectionKey` and `LanguagePack`.
4. Wrap existing German behavior as `dePack`.
5. Move note logic behind the canonical note codec, including explicit raw-section support, ordering guarantees, and shared link normalization.
6. Move propagation to consume the canonical note model plus typed section extractors.
7. Move entry matching and stub policy into `core/entries`.
8. Rewrite generate to consume the contracts and return explicit session outputs.
9. Preserve background-generate coordinator semantics through a dedicated migration step.
10. Shrink the Obsidian adapter last.
