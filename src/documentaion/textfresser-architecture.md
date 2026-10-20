# Textfresser vocabulary architecture

Textfresser turns a word or phrase from a source note into a linked vocabulary entry. The current runtime is German-first.

Related decisions and proposals:

- [ADR-0006: Separate linguistic truth, lexical generation, and note policy](../../docs/adr/0006-separate-linguistic-truth-generation-and-note-policy.md)
- [ADR-0008: Route unconfirmed closed-set links through a surface host](../../docs/adr/0008-route-unconfirmed-closed-set-links-through-a-surface-host.md) (superseded by ADR-0012)
- [ADR-0010: Return field-level results from aggregate lexical generation](../../docs/adr/0010-return-field-level-results-from-aggregate-lexical-generation.md)
- [ADR-0011: Use different compatibility policies for domain and infrastructure](../../docs/adr/0011-use-different-compatibility-policies-for-domain-and-infrastructure.md)
- [ADR-0012: Link classified Segments to Reading blocks and keep every Lemma in Worter](../../docs/adr/0012-link-classified-segments-to-reading-blocks-and-keep-every-lemma-in-worter.md)

## Current package state

The application still imports `@textfresser/lexical-generation` from `src/packages/independent/deprecated-lexical-generation/`.

The replacement package is `src/packages/composed/lexical-generation/`. It uses the temporary name `@textfresser/lexical-generation-next`. Provider acceptance tests use this package, but the application does not.

Do not add features to the deprecated package unless the live application requires a maintenance fix. See `book-of-work/lexical-generation-deprecation-and-rebuild-plan.md` for the cutover checklist.

## Domain model

Terms follow dumling, dumrel and dumdict. See `CONTEXT.md` and the [adoption map](https://github.com/clockblocker/filler-de/issues/49).

| Term | Meaning |
| --- | --- |
| Lemma | A grammatical entity: language, Family, Kind, Core Features and Canonical Form. It carries no sense. |
| Reading | A Lemma plus one Emoji Description: one sense. |
| Surface | A grammatical form that realizes exactly one Lemma. |
| Attestation | A fleeting occurrence of a Surface in text. It has no durable identity. |
| Attestation Ref | A durable embed of the source block where an Attestation occurred. |
| Lemma note | The one Markdown note for one Lemma and all of its Readings and owned Surfaces. |
| Reading Entry, Surface Entry | The dumdict records a Lemma note holds for one Reading or one Surface. |
| Block | A typed part of a Lemma note, such as translation, relation, or inflection. |

Selection is retired. "Section" means a Library Section only.

One note holds one Lemma. Its path spells the Lemma's identity ([#52](https://github.com/clockblocker/filler-de/issues/52)), but the note's `identity` Block stays authoritative. Do not read identity from the path, and do not use the path as the identity of a Reading.

Current code predates these terms. Its `LemmaResult` and "Lemma" include the sense emojis, so they are Readings. `EntrySection` and `DictSectionKind` are Blocks. Its notes are surface hosts that can hold several Lemmas. The cutover is tracked on the adoption map.

## Command flow

Textfresser has three commands:

| Command | Result |
| --- | --- |
| `Lemma` | Resolve the selected Surface, insert a safe link, and start background generation. |
| `Generate` | Create or update one Reading Entry and propagate generated references. |
| `TranslateSelection` | Translate selected text without creating a Reading Entry. |

### Lemma

`Lemma` uses two dispatch phases:

```text
selection
  -> resolve or create a safe working target
  -> insert a clickable link
  -> resolve the Surface, Lemma, and Reading
  -> choose the final target by policy
  -> rewrite the source link
  -> rename, reuse, or remove the working target
  -> request background Generate
```

The first phase gives the user an immediate link. The second phase applies the model result.

A working note below `Worter/.../unknown/...` is temporary. Finalization must rename it, merge it, or remove it.

The Lemma cache prevents repeated work for the same invocation. Guardrails can reject an unsafe multi-span rewrite.

### Background Generate

The coordinator permits one active Generate operation and one latest pending request. A request stores its own Lemma result so a later Lemma command cannot change its input.

Generate:

1. Reads the target note.
2. Finds an existing matching Reading Entry or allocates a new one.
3. Produces the applicable Blocks.
4. Propagates relations, morphology, morphemes, and inflections.
5. Serializes the note.
6. Dispatches all vault changes through VAM.

If generation fails, Textfresser can remove an empty target only when the invocation created or owns that target. It must not delete a pre-existing user note.

When the user opens the target during generation, the click handler waits for completion and then scrolls to the generated block.

## Note and Block ownership

Textfresser owns:

- note parsing and serialization;
- Block selection and display order;
- German labels and formatting;
- target paths, aliases, tags, and Block IDs;
- plugin-owned Blocks: freeform content;
- propagation and merge policy.

dumling owns Lemma, Reading and Surface identity. dumdict owns the records, Reading matching, and change planning. dumrel owns Reading Knowledge and relation projections. Until the cutover, the lexical-generation package owns model calls and generation DTOs, and the linguistics package owns the legacy linguistic schemas.

Every Block serializes one dumdict or dumrel field, is a projection, or is plugin-owned. Headers, tags, inverse relations and the inflection table are projections. They must not become the canonical source for linguistic identity or data.

The current note code has a legacy adapter and a newer document/data split under `core/notes/`. The replacement contract is in `specs/linguistic-note-codec-spec.md`.

## Target routing

Current code uses two storage families:

| Family | Content |
| --- | --- |
| `Library` | Closed-set grammar and function-word leaves managed by the Librarian. |
| `Worter` | Surface-host notes for open-set Readings and unconfirmed lookups. |

It follows the surface-host policy of ADR-0008, which ADR-0012 supersedes. The target policy is:

- Every Lemma, closed-class ones included, has one note under `Worter/` whose path spells its identity. A closed-class Lemma's note is created on first click; none goes to a Library leaf.
- A Shadow (a dumrel Unit Shadow) has a note under `Worter/<lang>/Shadow/`, removed when its Lemma is created.
- Classify on a selection links each Segment to its unit's Reading with a path-qualified link to the Reading's block, written by the plugin.
- A bare `[[surface]]` link typed by hand is a side case and may be ambiguous; Obsidian picks the nearest or shortest path. There are no Crossroad notes.
- Aliases and anchors must survive normalization.
- Unknown slash-separated targets must remain unchanged.

The path encoding, Shadow paths included, is settled in [#52](https://github.com/clockblocker/filler-de/issues/52). Whether the codec's renderings write bare or path-qualified links is open in the codec spec.

The Librarian parses Library suffixes. Textfresser must not duplicate the separator rules.

Current gap: the wikilink-completion behavior still rewrites one unresolved Core Name to a unique Library leaf. It leaves multiple matches unchanged. Closed-class Library leaves and surface hosts go away at the cutover.

## Propagation

Generated Blocks can create updates in other notes.

Inverse relations must not be written. A Semantic Relation is a direct claim stored on its source Reading only; the target note shows its inverse as a projection, and a missing target stays a Pending Semantic Relation. The current code still writes inverse lines and stub notes, which [#59](https://github.com/clockblocker/filler-de/issues/59) removes.

| Source | Current propagated result |
| --- | --- |
| Semantic Relation | Inverse or matching relation on the target note (legacy; to be removed) |
| Morphology | Backlink or composition equation |
| Morpheme | "used in" reference |
| Inflection | Note or reference for an inflected Surface |

Propagation uses semantic intent keys and stable Block IDs. It must deduplicate repeated intent.

Propagation produces Vault Actions. It does not write through Obsidian directly.

## Boundaries

- `Textfresser` is the public commander and state owner.
- `orchestration/` owns multi-step command coordination.
- `commands/` owns command pipelines.
- `core/` and `domain/` own note, Block, wikilink, and propagation policy.
- `languages/de/` and `targets/de/` own German-specific policy and rendering.
- VAM owns all vault and active-editor I/O.

## Source map

| Area | Location |
| --- | --- |
| Commander | `src/commanders/textfresser/textfresser.ts` |
| State | `src/commanders/textfresser/state/` |
| Lemma orchestration | `src/commanders/textfresser/orchestration/lemma/` |
| Background generation | `src/commanders/textfresser/orchestration/background/` |
| Generate pipeline | `src/commanders/textfresser/commands/generate/` |
| Note model | `src/commanders/textfresser/core/notes/`, `src/commanders/textfresser/domain/dict-note/` |
| Wikilink policy | `src/commanders/textfresser/domain/linguistic-wikilink/`, `src/commanders/textfresser/common/` |
| Propagation | `src/commanders/textfresser/domain/propagation/` |
| German policy | `src/commanders/textfresser/languages/de/`, `src/commanders/textfresser/targets/de/` |
