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
- Keep section-aware path resolution behind a small policy contract supplied by the language pack.
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
  noteCodec: NoteCodec;
  propagationPolicy: PropagationPolicy;
  renderers: SectionRendererRegistry;
  parsers: SectionParserRegistry;
};
```

Important: `SectionKey` is core-stable, while titles and css markers are language-pack data.

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

### Vault contract

Core logic should depend on a minimal vault port:

```ts
type VaultPort = {
  exists(path: SplitPathToMdFile): boolean;
  read(path: SplitPathToMdFile): Promise<Result<string, VaultError>>;
  dispatch(actions: VaultAction[]): Promise<Result<void, VaultError>>;
  findByBasename(name: string): SplitPathToMdFile[];
};
```

Keep `VaultActionManager` at the edge.

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

- `runTranslate`
  - take selected text / block
  - call translation gateway
  - build write action

### Core notes

- generic note parse/serialize shell
- entry metadata abstraction
- stable section ordering by language-pack policy, while preserving original order for ties and opaque/raw sections
- typed entry match helpers

### Core propagation

- parse only the sections that matter for propagation
- normalize propagation payloads
- dedupe and merge
- compute target write plans
- fold writes by target file only after object-level merge planning

Core propagation should operate on `SectionKey` and typed payloads, never on German section constants.

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
    propagation/
      planner.ts
      merge-policy.ts
      note-codec.ts
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
- add `VaultPort`
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

### Phase 4. Move propagation into core

- move `domain/propagation` into `core/propagation`
- replace `DictSectionKind`/css-suffix coupling with `SectionKey`
- move section parse/render specifics into language parsers

This is the hardest phase because current propagation parsing is the most contaminated generic layer.
The target end state is object-first propagation: parse note -> merge typed section payloads -> serialize note.

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

### Risk 4. Async/session workflow drift

The main migration risk is not the top-level facade. It is preserving background-generate behavior: state snapshotting, pending-generate coalescing, target ownership cleanup, and result handoff back into live session state.

Mitigation:

- keep background generate coordination as an explicit migration track with dedicated regression coverage
- do not fold async coordinator changes into unrelated module moves

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

## Decisions applied to implementation

### 1. `SectionKey` is core-stable

Use a global core `SectionKey` set first. Do not start with arbitrary per-language section identifiers in core.

### 2. Unknown sections are preserved

The core note model must keep opaque raw sections so user-authored or future sections survive round trips.
This also covers duplicate sections and sections that are recognized structurally but not claimed semantically by a typed parser.

### 3. Parsing is layered

The note codec must recognize every section marker needed for full round-tripping. Typed semantic parsers are only required for propagation-relevant sections.
Freeform/manual content stays opaque unless a specific parser opts into a typed representation.

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

Filesystem and target-path logic may consume a policy contract, but must not import language-specific section modules directly.
That policy must be explicit about:

- lookup precedence
- normalization and case fallback
- healing asymmetry
- special routing rules such as morpheme or library fallback

### 10. First pass preserves the note surface format

Do not mix architecture cleanup with note-format cleanup.

## Recommended implementation order

1. Extend existing tests around note round-tripping, attestation rewrite, path resolution, propagation, re-encounter matching, and background generate coordination.
2. Introduce `SectionKey`, `LanguagePack`, and `VaultPort`.
3. Wrap existing German behavior as `dePack`.
4. Move note and propagation logic behind the new contracts, including explicit raw-section support and ordering guarantees.
5. Move entry matching and stub policy into `core/entries`.
6. Rewrite generate to consume the contracts.
7. Preserve background-generate coordinator semantics through a dedicated migration step.
8. Shrink the Obsidian adapter last.
