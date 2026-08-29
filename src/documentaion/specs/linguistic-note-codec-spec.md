# Linguistic note codec specification

- Status: Draft
- Owner: Textfresser
- Compatibility: Clean break from the legacy Dict Note codec

Related decision:

- [ADR-0007: Separate note documents from semantic note data](../../../docs/adr/0007-separate-note-documents-from-semantic-note-data.md)

## Purpose

The proposed `@textfresser/linguistic-note-codec` package converts between structured Markdown and native linguistic data.

It owns:

- Markdown entry and block parsing;
- typed note documents;
- conversion between note blocks and `Lemma` or `Selection`;
- deterministic serialization;
- structured codec issues.

It must not own:

- vault I/O or lookup;
- wikilink destination resolution;
- prompts or generation;
- note paths, note IDs, or application storage policy;
- linguistic schemas.

`@textfresser/linguistics` remains the source of truth for `Lemma` and `Selection`.

## Required model

The codec must expose two layers:

```ts
type NoteDocument = {
	entries: EntryDocument[];
	meta?: Record<string, unknown>;
};

type EntryDocument = {
	blocks: EntryBlock[];
};

type NoteData = {
	entries: EntryData[];
	meta?: Record<string, unknown>;
};

type EntryData =
	| { kind: "lemma"; lemma: Lemma; payload: EntryPayload }
	| { kind: "selection"; selection: Selection; payload: EntryPayload };
```

`NoteDocument` preserves block order and freeform placement. `NoteData` contains validated semantic data.

Loose semantic parsing must return a partial-invalid Entry when reconstruction fails. It must not return invalid content as `EntryData`.

## Invariants

1. Each Entry must have exactly one `identity` block.
2. `identity` is the only source for Entry kind, language, Lemma kind, discriminator, and spelled forms.
3. A Selection identity must also contain orthographic status, Surface kind, and spelled Surface.
4. `header` and `tags` are projections. They must not define linguistic identity.
5. Reconstructed roots must validate against `@textfresser/linguistics`.
6. Parse must not repair content.
7. Normalization must be an explicit operation.
8. Typed block order must not change parse meaning.
9. Default serialization must use canonical block order.
10. The document layer must preserve freeform and unclaimed structured blocks.

## Block ownership

| Block | Owns |
| --- | --- |
| `identity` | Entry kind, language, Lemma kind, discriminator, spelled Lemma, and Selection identity fields |
| `root_meta` | Canonical root scalar fields that no other block owns |
| `relation` | Lexical and morphological relations |
| `inherent_features` | Inherent features |
| `inflection` | Canonical Selection inflectional features and optional rendered paradigm |
| `attestation` | Source context |
| `translation` | Translation content |
| `header` | Visible presentation only |
| `tags` | Derived indexing only |
| `freeform` | Opaque user content |

`root_meta` must not contain identity fields, relations, inherent features, or inflectional features.

The `inflection` payload has two independent parts:

```ts
type InflectionPayload = {
	canonical?: { inflectionalFeatures: Record<string, unknown> };
	rendered?: { rows: unknown[] };
};
```

A Lemma Entry may have `rendered` inflection content. It must not have `canonical` Selection features.

## Repeated blocks

`attestation` and `freeform` can repeat.

Other semantic blocks must occur once in canonical data. If they repeat:

- strict conversion must fail;
- loose conversion must report an issue;
- normalization may merge them only through an explicit policy.

## Parse and normalize

Parsing has two steps:

1. `parseDocument*` converts Markdown to `NoteDocument`.
2. `documentToData*` reconstructs and validates semantic data.

`parseData*` is a convenience composition.

Strict document parsing must fail on invalid entry or block structure. Strict data conversion must fail on missing identity, conflicting ownership, invalid payload, or invalid native linguistic data.

Loose document parsing must preserve:

- valid typed blocks;
- freeform blocks;
- unknown typed blocks;
- known blocks with unclaimed payload.

Loose data conversion must return structured issues and partial-invalid Entries.

Normalization may:

- deduplicate relation targets and tags;
- merge duplicate semantic blocks when policy allows;
- canonicalize block order;
- normalize typed payload formatting.

Normalization must not rewrite freeform content.

## Serialization

Default block order is:

1. `identity`
2. `root_meta`
3. `header`
4. `attestation`
5. `translation`
6. `relation`
7. `inherent_features`
8. `inflection`
9. `tags`
10. `freeform`

`serializeDocument` may preserve encountered order. `serializeData` uses canonical order and places freeform content last unless the caller supplies a layout policy.

`document -> data -> document` can lose freeform placement. A caller that needs exact placement must stay on the document layer.

Projection regeneration must be opt-in. If `header` or `tags` are absent, default serialization must omit them.

The v1 format supports content only inside Entry boundaries. Strict parsing must reject other note-level content. Loose parsing must report it as unsupported.

The final marker syntax is not fixed. It must:

- identify Entry and typed block boundaries without prose heuristics;
- use stable semantic block IDs;
- keep visible titles cosmetic;
- permit byte-preserving storage of unknown or unclaimed blocks.

## Public API

```ts
parseDocumentStrict(markdown, options?): NoteDocument
parseDocumentLoose(markdown, options?): { document: NoteDocument; issues: CodecIssue[] }

documentToDataStrict(document, options?): NoteData
documentToDataLoose(document, options?): { data: PartialNoteData; issues: CodecIssue[] }

parseDataStrict(markdown, options?): NoteData
parseDataLoose(markdown, options?): { data: PartialNoteData; issues: CodecIssue[] }

normalizeDocument(document, options?)
normalizeData(data, options?)

serializeDocument(document, options?): string
serializeData(data, options?): string
dataToDocument(data, options?): NoteDocument
```

`normalizeData` accepts valid `NoteData`. It must not accept partial-invalid loose output.

## Issue families

The codec must use structured issues. Minimum families are:

- `MissingRequiredBlock`
- `DuplicateBlock`
- `ConflictingBlockPayload`
- `InvalidBlockPayload`
- `InvalidRootDto`
- `UnknownTypedBlock`
- `UnclaimedStructuredBlock`
- `UnsupportedTopLevelContent`
- `OrderingNormalized`
- `SemanticBlockMerged`

## Acceptance

Tests must cover:

- Lemma and Selection reconstruction;
- missing and duplicate identity blocks;
- rejection of identity derived from header or tags;
- native schema validation;
- freeform and unknown-block round trips;
- order-independent parsing;
- canonical serialization order;
- explicit duplicate normalization;
- multiple Entries in one note.

Open implementation choices are the marker syntax, Entry separator, payload DTO details, option names, and issue payload fields.
