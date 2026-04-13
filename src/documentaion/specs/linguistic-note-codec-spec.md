# Linguistic Note Codec Spec (Draft)

Status: Draft
Owner: Textfresser
Last updated: 2026-04-13

## Compatibility Policy (Dev Mode, 2026-04-13)

1. Textfresser note formats and intermediate contracts are green-field. Breaking changes are allowed.
2. This package is a clean break from `dict-note` and the current note codec helpers.
3. Backward compatibility with legacy dict-note markdown is explicitly out of scope.

## Why this spec exists

Textfresser now has a native `@textfresser/linguistics` schema layer and a newer note-codec direction that distinguishes typed sections from raw preserved content. We need a dedicated composed package that owns markdown-to-linguistics conversion and nothing else.

This spec defines the new package boundary and the data/markdown contracts before implementation.

## Package intent

Tentative package:

- workspace path: `src/packages/composed/linguistic-note-codec`
- package name: `@textfresser/linguistic-note-codec`

The package exists only to convert:

1. `Lemma | Selection <-> entry-shaped typed DTOs`
2. `entry-shaped typed DTOs <-> structured markdown note text`

The package must not own:

1. filesystem reads or writes
2. vault lookup or wikilink resolution against the library
3. generation, prompting, or LLM orchestration
4. app-level note path, note id, or storage routing policy

## Goals

1. Parse a note containing multiple linguistic entries into typed entry blocks.
2. Reconstruct canonical `Lemma` or `Selection` roots from structured markdown.
3. Serialize typed entries back to structured markdown deterministically.
4. Preserve freeform/manual markdown content.
5. Separate parsing from normalization/healing.
6. Validate reconstructed roots against `@textfresser/linguistics`.

## Non-goals

1. No legacy dict-note compatibility layer.
2. No filesystem integration.
3. No generation-time section production.
4. No implicit healing during ordinary parse.
5. No canonical reconstruction from header prose or tag projections.

## Package boundary

The package is a composed workspace package. It may depend on independent packages such as `@textfresser/linguistics`.

It is the markdown boundary for linguistic note content:

- input side: structured markdown note text
- output side: typed note documents and typed note data

It is not the source of truth for linguistic schemas. `@textfresser/linguistics` remains the only source of truth for `Lemma`, `Selection`, enums, and schema validation.

## Core model

The note contains multiple entries. Each entry corresponds to one linguistic root plus note payload.

### Note-level types

```ts
type NoteDocument = {
	entries: EntryDocument[];
	meta?: Record<string, unknown>;
};

type NoteData = {
	entries: EntryData[];
	meta?: Record<string, unknown>;
};

type PartialNoteData = {
	entries: PartialEntryData[];
	meta?: Record<string, unknown>;
};
```

### Entry-level split

The package should keep a document layer and a data layer.

```ts
type EntryDocument = {
	blocks: EntryBlock[];
};

type EntryData =
	| {
			kind: "lemma";
			lemma: Lemma<any, any, any>;
			payload: EntryPayload;
	  }
	| {
			kind: "selection";
			selection: Selection<any, any, any, any, any>;
			payload: EntryPayload;
	  };

type PartialEntryData =
	| EntryData
	| {
			kind: "invalid";
			blocks: EntryBlock[];
			partialPayload?: Partial<EntryPayload>;
			reconstructionTarget: "lemma" | "selection" | "unknown";
	  };
```

Rationale:

1. the document layer preserves block ordering, interleaving, and freeform anchoring
2. the data layer owns reconstructed semantic content
3. the two layers must round-trip through explicit codecs
4. loose semantic reconstruction needs a partial-invalid representation and must not lie with `NoteData`

## Invariants

These are non-negotiable.

1. Every entry has exactly one `identity` block.
2. `header` and `tags` are never read for canonical linguistic reconstruction.
3. Parse does not perform silent healing.
4. Validation of reconstructed roots happens against `@textfresser/linguistics`.
5. Freeform/manual content must survive parse and serialize.
6. Known typed block order is not semantically meaningful during parse.
7. Serialization uses canonical block ordering by default.

## Root block model

The root linguistic object is reconstructed from typed root blocks, not from presentation blocks.

### Identity block

`identity` is mandatory and canonical for discriminants and spelled forms.

```ts
type IdentityBlock =
	| {
			block: "identity";
			entryKind: "lemma";
			language: TargetLanguage;
			lemmaKind: "Lexeme";
			pos: Pos;
			spelledLemma: string;
	  }
	| {
			block: "identity";
			entryKind: "lemma";
			language: TargetLanguage;
			lemmaKind: "Phraseme";
			phrasemeKind: PhrasemeKind;
			spelledLemma: string;
	  }
	| {
			block: "identity";
			entryKind: "lemma";
			language: TargetLanguage;
			lemmaKind: "Morpheme";
			morphemeKind: MorphemeKind;
			spelledLemma: string;
	  }
	| {
			block: "identity";
			entryKind: "selection";
			language: TargetLanguage;
			orthographicStatus: OrthographicStatus;
			surfaceKind: SurfaceKind;
			lemmaKind: "Lexeme";
			pos: Pos;
			spelledLemma: string;
			spelledSurface: string;
	  }
	| {
			block: "identity";
			entryKind: "selection";
			language: TargetLanguage;
			orthographicStatus: OrthographicStatus;
			surfaceKind: SurfaceKind;
			lemmaKind: "Phraseme";
			phrasemeKind: PhrasemeKind;
			spelledLemma: string;
			spelledSurface: string;
	  }
	| {
			block: "identity";
			entryKind: "selection";
			language: TargetLanguage;
			orthographicStatus: OrthographicStatus;
			surfaceKind: SurfaceKind;
			lemmaKind: "Morpheme";
			morphemeKind: MorphemeKind;
			spelledLemma: string;
			spelledSurface: string;
	  };
```

### Root meta block

`root_meta` is the home for root scalar fields that are canonical but not part of identity.

`root_meta` is optional in general, but mandatory when it carries any root field.

```ts
type RootMetaBlock = {
	block: "root_meta";
	emojiDescription?: string[];
	isClosedSet?: boolean;
	separable?: IsSeparable;
	discourseFormulaRole?: DiscourseFormulaRole;
};
```

`root_meta` must not absorb fields that already belong elsewhere:

1. not identity discriminants
2. not relations
3. not inherent features
4. not surface inflectional features

## Entry payload model

The entry payload contains note-owned or block-owned content around the root DTO.

```ts
type EntryPayload = {
	attestations?: AttestationPayload[];
	translations?: TranslationPayload;
	freeform?: FreeformBlockPayload[];
	header?: HeaderPayload;
	tags?: TagsPayload;
	relation?: RelationPayload;
	inherentFeatures?: InherentFeaturesPayload;
	inflection?: InflectionPayload;
};

type InflectionPayload = {
	canonical?: {
		inflectionalFeatures: Record<string, unknown>;
	};
	rendered?: {
		// package-owned rendered rows/table payload
		rows: unknown[];
	};
};
```

The exact payload subtypes are package-owned. Their job is to represent structured note content, not to replace the native root DTOs.

`InflectionPayload` is intentionally split:

1. `canonical` owns linguistic `surface.inflectionalFeatures`
2. `rendered` owns note-facing paradigm/table/list payload

## Block ownership table

Ownership must be explicit.

| Block | Canonical ownership |
|---|---|
| `identity` | entry kind, language, lemma kind, discriminator, spelled lemma, and for selections orthographic status, surface kind, spelled surface |
| `root_meta` | root scalar fields not owned elsewhere |
| `relation` | root `lexicalRelations` and `morphologicalRelations` |
| `inherent_features` | root `inherentFeatures` |
| `inflection` | root `surface.inflectionalFeatures` in `canonical` plus optional rendered paradigm payload in `rendered` |
| `attestation` | attestation payload only |
| `translation` | translation payload only |
| `header` | presentation only |
| `tags` | derived/indexing only |
| `freeform` | opaque preserved content |

## Projection rules

Certain blocks are projections and are never authoritative for root reconstruction.

### Header

`header` is presentation-only. It may contain:

1. emoji projection
2. article or display helpers
3. IPA
4. decorated visible surface or lemma text

The header may be regenerated from canonical root data and payload. It must not be the source of truth for those fields.

### Tags

`tags` are indexing or projection content. They may be derived from:

1. inherent features
2. optional indexing policy
3. app-level tagging policy outside this package

Tags must not be the canonical source for:

1. discriminator
2. lemma kind
3. surface kind
4. orthographic status
5. spelled forms

## Repeated block policy

Canonical entry shape should avoid repeated semantic blocks.

Allowed to repeat:

1. `attestation`
2. `freeform`

Not canonical, but parseable in loose mode:

1. repeated `relation`
2. repeated `translation`
3. repeated `inherent_features`
4. repeated `inflection`
5. repeated `identity`
6. repeated `root_meta`

When repeated semantic blocks are encountered:

1. `parseStrict` must fail
2. `parseLoose` must report issues
3. normalization may merge or reject them explicitly

## Parse vs normalize

Healing is an explicit step, not an implicit side effect of parse.

### Parse

`parseDocument*` is responsible for:

1. markdown-to-document parsing only
2. block boundary detection
3. typed-block recognition on the document layer
4. freeform preservation on the document layer

`documentToData*` is responsible for:

1. document-to-data reconstruction
2. semantic ownership mapping
3. schema validation
4. issue reporting in loose mode

`parseData*` is a convenience composition of `parseDocument*` and `documentToData*`.

Parse is not responsible for:

1. deduping relation items
2. sorting tags
3. merging duplicate semantic blocks
4. rewriting freeform content

### Normalize

Normalization is responsible for explicit, opt-in healing such as:

1. deduping relation targets
2. normalizing repeated tags
3. merging duplicate semantic blocks when policy allows
4. canonicalizing block order
5. trimming or canonicalizing typed semantic payload formatting

Normalization must not rewrite freeform content beyond safe boundary-level placement during serialization.

## Strict and loose modes

The package should expose both strict and loose variants.

### Strict mode

Strict mode fails when:

1. required root blocks are missing
2. required root fields are missing
3. there are conflicting semantic blocks
4. reconstructed root DTO validation fails
5. block payload shape is invalid for a typed block

### Loose mode

Loose mode returns issues instead of failing immediately and preserves enough information to continue working with the note.

Loose mode must:

1. keep freeform content
2. keep parseable typed blocks
3. report ambiguity, duplication, and validation failures as `CodecIssue[]`
4. avoid inventing canonical values from projections

Loose semantic reconstruction must return `PartialNoteData`, not `NoteData`.

Rationale:

1. a document may contain enough structure to identify an intended lemma/selection entry
2. that same entry may still fail schema validation or semantic reconstruction
3. loose mode must preserve that partial entry without pretending it is a valid `EntryData`

## Ordering policy

Reading must not depend on typed block order.

Default serialization should use canonical block ordering. A serializer option may allow preserving encountered order where available.

Recommended default order:

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

Important distinction:

1. parse ignores typed semantic order
2. freeform order must still be preserved on the document layer

### Freeform anchoring

Freeform anchoring is a document-layer concern only.

Rules:

1. `EntryDocument` preserves exact freeform interleaving relative to typed blocks
2. `EntryData` does not guarantee positional anchoring for freeform payload
3. `serializeDocument` may preserve original interleaving
4. `serializeData` emits canonical ordering and treats freeform as trailing by default unless an explicit layout policy is provided

## Structured markdown model

The persisted format is structured markdown, not raw JSON note dumps.

### Entry boundaries

One note may contain many entries.

The canonical note representation is:

1. a sequence of entry chunks
2. separated by a stable entry separator owned by this package

The exact separator token is package-owned. It must be deterministic and unambiguous.

### Block boundaries

Each entry chunk contains:

1. recognized typed blocks
2. unrecognized or manual freeform markdown spans

The exact typed-block marker syntax is package-owned. It must satisfy these rules:

1. each typed block has a stable semantic block id
2. marker ids are semantic and stable
3. human-facing titles, if present, are cosmetic/localized only
4. the parser can distinguish typed blocks from freeform content without heuristics over prose

### Recommended wire-format direction

The package should prefer a markdown-native block marker strategy where:

1. `identity` and `root_meta` store machine-readable payloads
2. semantic blocks have explicit markers
3. `header` remains visible markdown content
4. freeform content is any markdown outside recognized typed block markers

This spec intentionally locks the semantic contract more strongly than the initial concrete marker syntax. The implementation may choose the final marker syntax, but it must preserve the invariants in this document.

## Meta

`meta` is intentionally deferred in this spec.

For v1:

1. `meta` is an opaque transport field on `NoteDocument` and `NoteData`
2. this package may pass it through unchanged
3. its wire format and ownership rules are intentionally unspecified here

## Public API

The public surface should stay small.

```ts
parseDocumentStrict(markdown: string, options?): NoteDocument
parseDocumentLoose(
	markdown: string,
	options?,
): { document: NoteDocument; issues: CodecIssue[] }

documentToDataStrict(document: NoteDocument, options?): NoteData
documentToDataLoose(
	document: NoteDocument,
	options?,
): { data: PartialNoteData; issues: CodecIssue[] }

normalizeDocument(
	document: NoteDocument,
	options?,
): { document: NoteDocument; issues: CodecIssue[] }
normalizeData(
	data: NoteData,
	options?,
): { data: NoteData; issues: CodecIssue[] }

serializeDocument(document: NoteDocument, options?): string
serializeData(data: NoteData, options?): string

parseDataStrict(markdown: string, options?): NoteData
parseDataLoose(
	markdown: string,
	options?,
): { data: PartialNoteData; issues: CodecIssue[] }

dataToDocument(data: NoteData, options?): NoteDocument
```

Default `serializeData` behavior must not silently regenerate projection blocks such as `header` or `tags`.

Default policy:

1. if projections are present in data, serialize them
2. if projections are absent, omit them
3. regeneration of projection blocks must be opt-in via explicit serializer options or policy hooks

## Validation rules

The conversion from root blocks to `Lemma` or `Selection` must validate against the native linguistics schemas.

Rules:

1. `identity + root_meta + inherent_features + relation` reconstruct lemma roots
2. `identity + root_meta + inherent_features + relation + inflection` reconstruct selection roots
3. `surface.inflectionalFeatures` belong only in `inflection.canonical` and only on selection roots
4. if `surfaceKind !== "Inflection"`, the `inflection` block may still carry `rendered` payload but must not invent canonical `inflectionalFeatures`

## Error and issue model

The package should expose package-owned issues for loose mode and normalization.

Recommended issue families:

1. `MissingRequiredBlock`
2. `DuplicateBlock`
3. `ConflictingBlockPayload`
4. `InvalidBlockPayload`
5. `InvalidRootDto`
6. `UnknownTypedBlock`
7. `UnclaimedStructuredBlock`
8. `OrderingNormalized`
9. `SemanticBlockMerged`

Issue reporting should remain structured enough for future tooling and tests.

Block-recognition issue terms:

1. `UnknownTypedBlock`: typed marker syntax is recognized, but the block id is unsupported by this codec
2. `UnclaimedStructuredBlock`: the block id is known, but the payload is invalid, ambiguous, or not ownable in the current mode

## Testing requirements

The new package must have its own test suite.

Minimum coverage:

1. `identity` and `root_meta` reconstruction for lemma entries
2. `identity` and `root_meta` reconstruction for selection entries
3. strict rejection of missing or duplicate `identity`
4. strict rejection of canonical reconstruction from `header` or `tags`
5. freeform preservation round-trip
6. parse ignoring typed block order
7. canonical serialization ordering
8. explicit normalization of duplicate semantic blocks
9. root validation against `@textfresser/linguistics`
10. note-level multi-entry round trips

## Open implementation choices

These are still implementation choices, not unresolved semantic questions.

1. final markdown marker syntax for typed blocks
2. exact entry separator token
3. exact package-owned payload DTO shapes for translations, attestations, and freeform
4. exact option names for order preservation during serialization
5. exact issue payload shape

These choices must not violate the invariants or ownership rules above.
