# Textfresser vocabulary architecture

Textfresser turns a word or phrase from a source note into a linked vocabulary entry. The current runtime is German-first.

Related decisions and proposals:

- [ADR-0006: Separate linguistic truth, lexical generation, and note policy](../../docs/adr/0006-separate-linguistic-truth-generation-and-note-policy.md)
- [ADR-0008: Route unconfirmed closed-set links through a surface host](../../docs/adr/0008-route-unconfirmed-closed-set-links-through-a-surface-host.md)
- [ADR-0010: Return field-level results from aggregate lexical generation](../../docs/adr/0010-return-field-level-results-from-aggregate-lexical-generation.md)
- [ADR-0011: Use different compatibility policies for domain and infrastructure](../../docs/adr/0011-use-different-compatibility-policies-for-domain-and-infrastructure.md)

## Current package state

The application still imports `@textfresser/lexical-generation` from `src/packages/independent/deprecated-lexical-generation/`.

The replacement package is `src/packages/composed/lexical-generation/`. It uses the temporary name `@textfresser/lexical-generation-next`. Provider acceptance tests use this package, but the application does not.

Do not add features to the deprecated package unless the live application requires a maintenance fix. See `book-of-work/lexical-generation-deprecation-and-rebuild-plan.md` for the cutover checklist.

## Domain model

| Term | Meaning |
| --- | --- |
| Surface | Text that the user encounters. |
| Selection | The linguistic classification of that Surface in context. |
| Lemma | The canonical linguistic form. |
| Attestation | The source context and source-note reference. |
| Vocabulary note | One Markdown note for a visible Surface. |
| Entry | One linguistic sense or grammatical role in a vocabulary note. |
| Section | A managed part of an Entry, such as translation, relation, or inflection. |

One note can contain multiple Entries. Do not use the note path as the identity of a sense.

## Command flow

Textfresser has three commands:

| Command | Result |
| --- | --- |
| `Lemma` | Resolve the selected Surface, insert a safe link, and start background generation. |
| `Generate` | Create or update one Entry and propagate generated references. |
| `TranslateSelection` | Translate selected text without creating a vocabulary Entry. |

### Lemma

`Lemma` uses two dispatch phases:

```text
selection
  -> resolve or create a safe working target
  -> insert a clickable link
  -> resolve the linguistic Selection
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
2. Finds an existing matching Entry or allocates a new Entry.
3. Produces the applicable sections.
4. Propagates relations, morphology, morphemes, and inflections.
5. Serializes the note.
6. Dispatches all vault changes through VAM.

If generation fails, Textfresser can remove an empty target only when the invocation created or owns that target. It must not delete a pre-existing user note.

When the user opens the target during generation, the click handler waits for completion and then scrolls to the generated block.

## Note and section ownership

Textfresser owns:

- Entry identity and matching;
- note parsing and serialization;
- section selection and display order;
- German labels and formatting;
- target paths, aliases, tags, and block IDs;
- propagation and merge policy.

The lexical-generation package owns model calls and generation DTOs. The linguistics package owns linguistic schemas and operations.

Headers and tags are projections. They must not become the canonical source for linguistic identity.

The current note code has a legacy adapter and a newer document/data split under `core/notes/`. The proposed replacement contract is in `specs/linguistic-note-codec-spec.md`.

## Target routing

Textfresser uses two storage families:

| Family | Content |
| --- | --- |
| `Library` | Closed-set grammar and function-word leaves managed by the Librarian. |
| `Worter` | Surface-host notes for open-set Entries and unconfirmed lookups. |

The accepted target policy is:

- A user-authored `[[surface]]` link opens the `Worter` surface host.
- A model-confirmed closed-set attestation can link to the exact `Library` leaf.
- A `Worter` note can contain open-set Entries and closed-set membership Entries.
- Normal Textfresser links render a basename. They do not store full vault paths.
- Aliases and anchors must survive normalization.
- Unknown slash-separated targets must remain unchanged.

The Librarian parses Library suffixes. Textfresser must not duplicate the separator rules.

Current gap: the wikilink-completion behavior still rewrites one unresolved Core Name to a unique Library leaf. It leaves multiple matches unchanged. This unique-match behavior does not conform to the surface-host policy and must be reconciled before the routing migration is complete.

## Propagation

Generated sections can create updates in other notes.

| Source | Typical propagated result |
| --- | --- |
| Lexical relation | Inverse or matching relation on the target Entry |
| Morphology | Backlink or composition equation |
| Morpheme | "used in" reference |
| Inflection | Entry or reference for an inflected Surface |

Propagation uses semantic intent keys and stable Entry IDs. It must deduplicate repeated intent.

Propagation produces Vault Actions. It does not write through Obsidian directly.

## Boundaries

- `Textfresser` is the public commander and state owner.
- `orchestration/` owns multi-step command coordination.
- `commands/` owns command pipelines.
- `core/` and `domain/` own note, Entry, wikilink, and propagation policy.
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
