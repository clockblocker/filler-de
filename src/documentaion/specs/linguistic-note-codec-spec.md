# Linguistic Note Codec Spec

Status: Draft
Owner: Textfresser
Last updated: 2026-02-21

## Why this spec exists

Textfresser currently has multiple markdown-to-note adapters with overlapping responsibilities:

1. `dict-note` handles legacy dictionary entry parsing/serialization.
2. `propagation/note-adapter` handles a narrower typed propagation shape.
3. `core/notes/note-codec` already provides a structural typed-vs-raw section codec.

The new linguistics module and the upcoming generation shape require a single dedicated package that owns linguistic note markdown as a first-class boundary.

This spec defines that package.

## Goals

1. Create one canonical markdown boundary for linguistic notes.
2. Support both directions:
   - markdown -> linguistic note DTOs
   - linguistic note DTOs -> markdown
   - full note text -> note DTO
   - note DTO -> full note text
3. Keep the package independent from filesystem, vault lookup, and generation orchestration.
4. Preserve user-authored content losslessly when it is outside the claimed typed contract.
5. Make canonical block identity explicit rather than implicitly reconstructed from old ids or rendered headers.

## Non-goals

1. No filesystem access.
2. No library lookup or path resolution.
3. No sense matching or “should this be a new sense” decisions.
4. No generation logic.
5. No migration of old adapters in this step.

## Package boundary

The new module is a new composed workspace package with its own test suite.

Proposed package name:

`@textfresser/linguistic-note-codec`

Why composed:

1. It composes pure `@textfresser/linguistics` DTOs with markdown/note rendering policy.
2. It owns Textfresser-specific decorations, section claiming, and metadata shape.
3. It must remain independent from filesystem and Obsidian runtime concerns.

## Design principles

1. The package is the single markdown boundary for linguistic notes.
2. It owns both structural note-block parsing and semantic typed section codecs, in layers.
3. The note envelope extends pure linguistics payloads instead of replacing them.
4. Raw and unknown content must roundtrip losslessly.
5. Rendered header text is decoration, not source of truth.
6. Canonical identity must roundtrip explicitly and must not be inferred from header text.

## Layered architecture

### Layer 1: Lossless note structure

This layer owns:

1. Entry/block splitting.
2. Header line and block-id placement.
3. Section marker parsing and serialization.
4. Frontmatter decomposition, ownership, merge, and recomposition.
5. Raw passthrough for unclaimed sections and loose text.

### Layer 2: Linguistic typed codecs

This layer owns:

1. Block DTO decoding/encoding for lemma and selection blocks.
2. Typed section decoding/encoding for the supported section set.
3. Decorations such as header rendering, localized titles, and note-owned metadata.
4. Diagnostics for schema mismatches without destroying raw content.

## File-level DTO

```ts
type LinguisticMarkdownNote = {
	noteSurface: string;
	blocks: LinguisticMarkdownBlock[];
	diagnostics: LinguisticNoteDiagnostic[];
	frontmatter: {
		entries: Record<string, LinguisticBlockMeta>;
		passthrough: Record<string, unknown>;
	};
};
```

Notes:

1. One markdown file may contain multiple lemma and selection blocks.
2. Example: one `schloss.md` file may contain two lemma senses and one inflection block.
3. `noteSurface` is the host-note surface string, not a filesystem concern.
4. The package owns full note text, including frontmatter merge for the `entries` map.
5. `frontmatter.passthrough` preserves unrelated parseable frontmatter keys that are not owned by this package.
6. The package owns the `entries` frontmatter key.
7. If frontmatter is unreadable as structured data, parse emits diagnostics and preserves the raw note text structurally, but normalized frontmatter merge is unavailable until the caller repairs or migrates it.

## Block DTO

```ts
type LinguisticMarkdownBlock =
	| LemmaNoteBlock
	| SelectionNoteBlock
	| InvalidTypedBlock
	| RawNoteBlock;
```

```ts
type BlockCommon = {
	blockKind: "LemmaNote" | "SelectionNote";
	stableId: string;
	canonicalKey: CanonicalKey;
	header: {
		rendered: string;
	};
	decorations: {
		emojiDescription?: string[];
		ipa?: string;
	};
	sections: LinguisticNoteSection[];
	meta?: Record<string, unknown>;
};
```

```ts
type LemmaNoteBlock = BlockCommon & {
	blockKind: "LemmaNote";
	payload: AnyLemma;
};

type SelectionNoteBlock = BlockCommon & {
	blockKind: "SelectionNote";
	payload: AnySelection;
};

type RawNoteBlock = {
	blockKind: "RawNote";
	rawBlock: string;
	meta?: Record<string, unknown>;
};

type InvalidTypedBlock = {
	blockKind: "InvalidTypedNote";
	stableId?: string;
	canonicalKey?: CanonicalKey;
	header: {
		raw: string;
		rendered?: string;
	};
	sections: Array<InvalidTypedSection | RawSection | TypedSection>;
	rawBlock: string;
	attemptedBlockKind?: "LemmaNote" | "SelectionNote";
	diagnostics: LinguisticNoteDiagnostic[];
	meta?: Record<string, unknown>;
};
```

## Canonical identity

Canonical identity is a first-class DTO field. It must be explicitly serialized and parsed back. It must not be reconstructed from rendered header text.

### CanonicalKey

```ts
type CanonicalKey = {
	language: TargetLanguage;
	surface: string;
	unitKind: "Lexeme" | "Phraseme" | "Morpheme";
	surfaceKind: "Lemma" | "Inflection" | "Variant" | "Partial";
	discriminator: string;
	discriminator2?: string;
	senseOrdinal?: number;
};
```

### Identity rules

1. `discriminator` is:
   - lexeme -> `pos`
   - phraseme -> `phrasemeKind`
   - morpheme -> `morphemeKind`
2. `discriminator2` is language-dependent and optional.
3. `stableId` is the serialized durable block identity used in markdown block anchors.
4. `stableId` is durable once persisted.
5. `stableId` is not re-derived during parse from the current `canonicalKey`.
6. `stableId` may be initially generated from canonical identity at block-creation time, but afterwards it is preserved unless an explicit migration rewrites both metadata key and anchor.
7. `canonicalKey` is the source of truth for note identity semantics.
8. `emojiDescription` is not canonical identity.
9. A change from `["🏰"]` to `["🏰", "👑"]` must not change canonical identity by itself.
10. The parser/serializer is agnostic about whether a block should be reused or a new sense should be created. That decision belongs to generation/orchestration.

### V1 discriminator2 matrix

V1 supports the following `discriminator2` values:

1. German lexeme noun -> `gender`
2. German lexeme verb -> `separability`
3. German morpheme prefix -> `separability`
4. Everything else -> absent

### Collision handling

If `surface + unitKind + surfaceKind + discriminator + discriminator2` still collides, the block may carry `senseOrdinal`.

This gives the package a deterministic final collision breaker without making rendered decorations part of identity.

## Stable id

`stableId` is the durable markdown block id emitted as `^stableId`.

V1 policy:

1. The new package stores explicit `canonicalKey` in metadata.
2. `stableId` is used as the metadata key in `frontmatter.entries`.
3. `stableId` remains stable across ordinary enrichment and canonical-key-preserving updates.
4. `stableId` changes only during explicit migration or explicit identity rewrite.
5. The exact stable-id string format may continue to resemble the current compact id style, but callers must not rely on it as the only identity carrier.

## Supported block kinds

V1 block kinds:

1. `LemmaNote`
2. `SelectionNote`
3. `InvalidTypedNote`
4. `RawNote`

Lemma and selection blocks live in the same note and use the same structural envelope, but they remain different block kinds.

## Section model

```ts
type LinguisticNoteSection =
	| TypedSection
	| InvalidTypedSection
	| RawSection;
```

```ts
type TypedSection =
	| { kind: "Attestation"; payload: AttestationSectionDto; title: string; marker: string }
	| { kind: "FreeNote"; payload: FreeNoteSectionDto; title: string; marker: string }
	| { kind: "Meaning"; payload: MeaningSectionDto; title: string; marker: string }
	| { kind: "Morphology"; payload: MorphologySectionDto; title: string; marker: string }
	| { kind: "Relation"; payload: RelationSectionDto; title: string; marker: string }
	| { kind: "Inflection"; payload: InflectionSectionDto; title: string; marker: string }
	| { kind: "Translation"; payload: TranslationSectionDto; title: string; marker: string };
```

```ts
type RawSection = {
	kind: "Raw";
	rawBlock: string;
	title?: string;
	marker?: string;
};

type InvalidTypedSection = {
	kind: "InvalidTypedSection";
	attemptedKind: TypedSection["kind"];
	rawBlock: string;
	title?: string;
	marker?: string;
	diagnostics: LinguisticNoteDiagnostic[];
};
```

### V1 typed sections

The package claims and owns these typed sections in v1:

1. `Attestation`
2. `FreeNote`
3. `Meaning`
4. `Morphology`
5. `Relation`
6. `Inflection`
7. `Translation`

Everything else remains raw until a later spec explicitly claims it.

### Free-note policy

V1 provides:

1. one canonical typed `FreeNote` section
2. raw passthrough for arbitrary custom/manual sections

This keeps a typed path for managed free notes without destroying user-authored custom structures.

### Multiplicity and order rules

V1 canonical multiplicity:

1. each typed section kind may appear at most once per typed block
2. section order is significant and preserved
3. the first claimable occurrence of a typed section kind is the canonical claimed section
4. later occurrences of the same typed section kind are preserved as `InvalidTypedSection` if they structurally target a known typed kind
5. unrelated or unknown repeated sections remain `RawSection`

## Decorations

The package owns note decorations.

Decorations include:

1. rendered header strings
2. localized section titles
3. emoji rendering
4. IPA decoration
5. note-owned title/marker policy

Decorations are projections from block DTOs and must not become the primary source of identity.

Roundtrip policy:

1. parse preserves observed wire-format decoration fields needed for roundtrip fidelity
2. `title`, `marker`, and rendered header text are preserved from the source note when parsing existing notes
3. canonical decoration rendering is used when creating new typed content or when a caller explicitly requests normalization
4. unchanged parsed notes must not be silently canonicalized on write

## Metadata contract

Per-block canonical metadata must be serialized explicitly in per-entry metadata, keyed by block id.

V1 storage model:

1. file-level frontmatter continues to carry an `entries` map keyed by `stableId`
2. each entry metadata object carries explicit canonical note metadata
3. block parsing reads canonical metadata from this map first
4. header text and section text are never the only source of identity
5. unrelated parseable frontmatter keys are preserved under `frontmatter.passthrough`
6. serializer merges package-owned `entries` with preserved `frontmatter.passthrough` into full note text

Illustrative shape:

```ts
type LinguisticBlockMeta = {
	canonicalKey: CanonicalKey;
	blockKind: "LemmaNote" | "SelectionNote";
	decorations?: {
		emojiDescription?: string[];
		ipa?: string;
	};
	extensions?: Record<string, unknown>;
};
```

## Parse result

```ts
type ParseLinguisticMarkdownResult = {
	note: LinguisticMarkdownNote;
};
```

Diagnostics are explicit.

```ts
type LinguisticNoteDiagnostic = {
	code: string;
	message: string;
	stableId?: string;
	sectionKind?: string;
};
```

### Parse behavior

1. Parse returns a list of blocks within a note.
2. Structurally valid but semantically invalid blocks do not force total failure.
3. If a typed payload fails validation, the parser preserves the envelope and raw content as `InvalidTypedBlock` and emits diagnostics.
4. If a section marker is known but not claimable, it remains raw.
5. Go-back links, library lookup, and path resolution are outside this package.
6. If `frontmatter.entries[stableId]` is missing or malformed, the parser emits an `InvalidTypedBlock` when a structural block envelope exists.
7. The parser does not best-effort infer `canonicalKey` from header text in v1.
8. If frontmatter itself is unreadable, parse emits diagnostics and preserves the note structurally, but serialize of a normalized note may fail until frontmatter is repaired.

### Block splitting rules

The parser owns structural block splitting for the full note body after frontmatter is removed.

V1 rules:

1. Any prose before the first structurally valid anchored block becomes a `RawNoteBlock`.
2. Any prose between blocks becomes a `RawNoteBlock`.
3. Any trailing prose after the last block becomes a `RawNoteBlock`.
4. A structurally valid anchored block requires a header line ending in `^stableId`.
5. If such a block has valid owned metadata and valid typed payload, it becomes `LemmaNoteBlock` or `SelectionNoteBlock`.
6. If such a block has a structural envelope but invalid or missing owned metadata, it becomes `InvalidTypedBlock`.
7. Chunks that do not form a structurally valid anchored block remain `RawNoteBlock`.
8. Canonical separator lines are a serialization detail, not the only parse delimiter.
9. Malformed separators or separator-like prose are preserved inside surrounding raw blocks unless they sit inside a structurally claimed block body.

## Serialize result

```ts
type SerializeLinguisticMarkdownResult = {
	noteText: string;
};
```

### Serialize behavior

1. Serialization emits full note text, including frontmatter.
2. Block ids are emitted as markdown anchors using `^stableId`.
3. Claimed typed sections are rendered from DTOs.
4. Raw blocks and raw sections are preserved verbatim where possible.
5. Serialization must not require generation context, filesystem context, or lookup services.
6. The package merges owned `entries` metadata with preserved frontmatter passthrough keys.
7. Advanced fragment serializers such as `{ body, entriesMeta }` are non-primary APIs and must not be the public ownership boundary.
8. If the note carries unreadable frontmatter and the caller requests normalized full-note serialization, serialization must fail loudly rather than silently discarding unknown frontmatter content.

## Markdown contract

### Structural rules

1. A note contains zero or more linguistic blocks.
2. Each block may contain typed sections and raw sections.
3. Block header rendering is package-owned decoration.
4. Section markers and localized titles are package-owned decoration.
5. Lossless raw passthrough is required for unsupported sections and loose text.
6. Exact canonical separator output is package-owned on fresh serialization of normalized notes.
7. Parsed notes preserve observed raw inter-block material unless the caller explicitly normalizes the note.

### Example note

```md
🏰 [[Schloss]] ^lx-lm-noun-neut-1

<span class="entry_section_title entry_section_title_translations">Ubersetzung</span>
castle

<span class="entry_section_title entry_section_title_kontexte">Kontexte</span>
![[source-note#^abc|^]]


---
---


🔒 [[Schloss]] ^lx-lm-noun-neut-2

<span class="entry_section_title entry_section_title_translations">Ubersetzung</span>
lock


---
---


🧪 [[schloss]] ^lx-in-verb-separable-1

<span class="entry_section_title entry_section_title_kontexte">Kontexte</span>
![[source-note#^def|^]]
```

This is illustrative only. The exact stable-id string format is not the primary contract.

## Relationship to `@textfresser/linguistics`

The package embeds pure linguistics DTOs rather than redefining them.

Rules:

1. lemma blocks embed `AnyLemma`
2. selection blocks embed `AnySelection`
3. note-level identity, decorations, and sections remain package-owned
4. generation-specific DTOs and old lexical-generation metadata do not belong here

## Relationship to old adapters

This package is intended to become the single markdown boundary.

Migration strategy is explicitly deferred to a separate PR.

Expected future direction:

1. migrate `dict-note` onto the new package
2. migrate `propagation/note-adapter` onto the new package or onto typed section codecs built on top of it
3. retire duplicated markdown parsing/serialization logic

## Test strategy

The package must ship with its own test suite.

Minimum v1 coverage:

1. markdown -> DTO -> markdown roundtrip for typed notes
2. lossless raw-section preservation
3. lossless raw-block preservation
4. metadata roundtrip for canonical identity
5. lemma block encode/decode
6. selection block encode/decode
7. mixed note with multiple blocks for same surface
8. diagnostics for schema-invalid typed payloads
9. German discriminator2 matrix coverage:
   - noun gender
   - verb separability
   - prefix separability
10. missing/corrupt `entries[stableId]` metadata behavior
11. raw preamble, inter-block prose, malformed headers, and trailing junk
12. repeated typed section handling
13. corpus fixtures taken from current note shapes where compatibility matters

## Explicit exclusions for v1

1. filesystem path resolution
2. library basename lookup
3. Obsidian-specific services
4. generation-time sense matching
5. migration helpers
6. propagation intent building

## Summary

The new package is the canonical linguistic markdown codec for Textfresser.

It owns:

1. lossless note structure
2. typed lemma/selection block codecs
3. typed section codecs for the v1 section set
4. canonical identity metadata
5. note decorations and markdown rendering policy

It does not own:

1. filesystem access
2. library lookup
3. generation policy
4. sense-matching decisions
