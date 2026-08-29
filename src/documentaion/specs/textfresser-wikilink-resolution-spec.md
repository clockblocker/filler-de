# Textfresser wikilink resolution specification

- Status: Design target with one known implementation gap
- Owner: Textfresser

Related decision:

- [ADR-0008: Route unconfirmed closed-set links through a surface host](../../../docs/adr/0008-route-unconfirmed-closed-set-links-through-a-surface-host.md)

## Purpose

This specification defines how Textfresser parses, classifies, resolves, and renders linguistic wikilinks.

It does not define Librarian go-back links.

## Target families

Textfresser uses three target families:

| Family | Location | Use |
| --- | --- | --- |
| Closed-set leaf | `Library` | Confirmed grammar and function-word target |
| Open-set Lemma | `Worter` | Canonical vocabulary Entry |
| Open-set non-Lemma | `Worter` | Inflection, variant, or other Surface Entry |

A slash in a target is not a routing signal by itself.

## In-memory DTO

Parsed linguistic links must keep syntax and policy data separate:

```ts
type LinguisticWikilinkDto = {
	fullMatch: string;
	target: string;
	surface: string;
	alias: string | null;
	anchor: string | null;
	source: "UserAuthored" | "TextfresserCommand";
	intent:
		| "ManualSurfaceLookup"
		| "LemmaSemanticAttestation"
		| "GenerateSectionLink"
		| "PropagationLink";
	targetRef:
		| { kind: "LibraryLeaf"; coreName: string; suffixParts: string[]; basename: string }
		| { kind: "WorterNote"; basename: string; surfaceKind: string }
		| { kind: "Unresolved"; target: string };
};
```

The parser derives `source` and `intent` from the owning Entry section. These fields are not stored as extra Markdown tags.

A `LibraryLeaf` reference must keep `coreName` and `suffixParts`. The Librarian must perform suffix parsing. Textfresser must not guess the configured delimiter.

## Routing rules

1. A user-authored `[[surface]]` link must route to a `Worter` surface host.
2. A model-confirmed closed-set attestation may route to the exact `Library` leaf.
3. A `Worter` surface host may contain open-set Entries and closed-set membership Entries.
4. Textfresser must create the surface host when an unconfirmed closed-set Surface has no host.
5. Completion must not rewrite an unconfirmed Surface to one Library leaf.
6. A temporary `Worter/.../unknown/...` note must not remain after Lemma finalization.
7. A confirmed closed-set re-encounter must remain linked to the Library leaf.
8. Relation targets are Lemma targets.
9. Inflection targets use an existing Lemma host for the same Surface when available. Otherwise, they use an inflection host.
10. German closed-set prefixes route to `Library`. Other Morphemes route to `Worter`.

When more than one Library leaf matches language and POS, selection must be deterministic. Sort matching basenames and select the first. If no POS match exists, use the `Worter` surface host.

## Syntax preservation

The parser must support:

- a plain target;
- an alias;
- a block or heading anchor;
- a `.md` suffix;
- an explicit `Library/...` or `Worter/...` path;
- an absolute vault-root form;
- a relative path when source context is available.

Normalization must:

1. Preserve the alias exactly.
2. Preserve the anchor exactly.
3. Change only the target part.
4. Render a resolved known-root target as its basename.
5. Keep an unknown slash-separated target unchanged.

Examples:

| Input | Output |
| --- | --- |
| `[[Worter/de/x/Fahren]]` | `[[Fahren]]` |
| `[[Library/de/x/auf-prefix-de|>auf]]` | `[[auf-prefix-de|>auf]]` |
| `[[Worter/de/x/Fahren#^verb-1|fahrt]]` | `[[Fahren#^verb-1|fahrt]]` |
| `[[domain/schema/field]]` | Unchanged |

Normal Textfresser output must not store a full vault path.

## Resolution order

For each parsed link:

1. Split the target, alias, and anchor.
2. Classify explicit known-root, relative, plain, or unknown structured targets.
3. Try Obsidian resolution from the source note.
4. Use Librarian lookup for a possible Library leaf.
5. Apply Textfresser routing policy when the command intent requires a deterministic destination.
6. Render the safe target.
7. Reattach the anchor and alias.

The final resolver precedence for each command phase is still open. Until it is fixed, a resolver must not overwrite an explicit successful resolution with a weaker heuristic.

## Anchors

Lemma attestation links must use a block anchor when the target Entry ID is known. Other generated links may target the note only.

Entry block IDs must be deterministic:

```text
^<pos-tag>-<feature-tags...>-<sense-index>
```

`sense-index` is scoped to the POS and feature-tag combination. Model prompts receive expanded sense data. They must not infer meaning from the compact ID.

## Boundaries

- `@textfresser/note-addressing` owns wikilink syntax.
- Textfresser owns target-family, comparison, and rendering policy.
- The Librarian owns Library suffix parsing and leaf lookup.
- VAM and Obsidian own concrete vault destination lookup.
- Note parsing derives semantic link DTOs from section context.

## Current state

Implemented:

- section-context classification;
- `LibraryLeaf`, `WorterNote`, and `Unresolved` target references;
- separator-aware Library basename parsing through a Librarian callback;
- conservative behavior when that callback is absent;
- basename rendering for known target roots;
- temporary working-note cleanup;
- mixed-role `Worter` surface hosts.

Known non-conformance:

- The current completion handler rewrites one unresolved Core Name to a unique Library leaf. It passes through multiple matches. The target policy requires the unconfirmed link to use a `Worter` surface host.

Open:

- one resolver-precedence contract for all command phases;
- final lightweight and resolved DTO boundaries;
- bulk parse, selective normalize, and reassemble API;
- replacement of ambiguous helper names;
- optional vault-wide membership backfill.

## Acceptance

Tests must cover:

- aliases and anchors;
- `.md`, known-root, relative, and unknown slash targets;
- no full-path leakage;
- ambiguous Library matches;
- manual closed-set links;
- confirmed closed-set attestations;
- temporary working-note cleanup;
- Lemma and Generate rewrite integration.
