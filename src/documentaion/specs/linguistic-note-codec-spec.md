# Linguistic Note Codec Spec

Status: Draft
Owner: Textfresser
Last updated: 2026-02-21

## Why this spec exists

Textfresser currently has multiple markdown-to-note adapters with overlapping responsibilities:

1. `dict-note` handles legacy dictionary entry parsing and serialization.
2. `propagation/note-adapter` handles a narrower typed propagation shape.
3. `core/notes/note-codec` already provides a structural typed-vs-raw section codec.

The new linguistics module and the upcoming generation shape require one dedicated package that owns linguistic note markdown as a first-class boundary.

This spec defines that package.

## Dependency on linguistics identity

This package depends on the linguistics-owned identity contract defined in [linguistic-identity-spec.md](./linguistic-identity-spec.md).

The codec does not define semantic linguistic identity itself.

It relies on:

```ts
type LingId = string & { readonly __brand: "LingId" };

function toLingId(input: AnyLemma | AnySelection): LingId | null;
```

`LingId` is semantic and recomputable for the current identity policy generation.

`stableId` is note-local and durable.

They solve different problems and must not be conflated.

Clean-break rule:

1. This codec may store and roundtrip `LingId`.
2. That storage does not imply cross-version compatibility for `LingId`.
3. If linguistics identity policy changes, old stored `LingId` values are treated as legacy data.

## Goals

1. Create one canonical markdown boundary for linguistic notes.
2. Support both directions:
   - markdown -> linguistic note DTOs
   - linguistic note DTOs -> markdown
   - full note text -> note DTO
   - note DTO -> full note text
3. Keep the package independent from filesystem, vault lookup, and generation orchestration.
4. Preserve user-authored content losslessly when it is outside the claimed typed contract.
5. Roundtrip explicit semantic identity through `LingId` rather than reconstructing identity from rendered headers.

## Non-goals

1. No filesystem access.
2. No library lookup or path resolution.
3. No sense matching or “should this be a new sense” decisions.
4. No generation logic.
5. No migration of old adapters in this step.
6. No codec-owned replacement for linguistics identity.

## Package boundary

The new module is a composed workspace package with its own test suite.

Proposed package name:

`@textfresser/linguistic-note-codec`

Why composed:

1. It composes pure `@textfresser/linguistics` DTOs with markdown and note rendering policy.
2. It owns Textfresser-specific section claiming, metadata shape, and wire-format rendering.
3. It must remain independent from filesystem and Obsidian runtime concerns.

## Design principles

1. The package is the single markdown boundary for linguistic notes.
2. It owns both structural note-block parsing and semantic typed section codecs, in layers.
3. The note envelope extends pure linguistics payloads instead of replacing them.
4. Raw and unknown content must roundtrip losslessly.
5. Rendered header text is decoration, not source of truth.
6. Semantic identity comes from explicit `LingId`, not from header text, emoji order, or codec-owned discriminator logic.
7. Note-local durability comes from `stableId`, not from `LingId`.
8. Stored `LingId` values are treated as current-generation metadata, not as a long-term stable persistence contract.

## Layered architecture

### Layer 1: Lossless note structure

This layer owns:

1. entry and block splitting
2. header line and block-id placement
3. section marker parsing and serialization
4. metadata-carrier decomposition, ownership, merge, and recomposition
5. raw passthrough for unclaimed sections and loose text

### Layer 2: Linguistic typed codecs

This layer owns:

1. block DTO decoding and encoding for lemma and selection blocks
2. typed section decoding and encoding for the supported section set
3. note rendering policy such as localized titles and header wire format
4. diagnostics for schema mismatches without destroying raw content

## File-level DTO

```ts
type LinguisticMarkdownNote = {
	hostSurfaceHint?: string;
	blocks: LinguisticMarkdownBlock[];
	diagnostics: LinguisticNoteDiagnostic[];
	metadata: MetadataEnvelope;
};
```

Notes:

1. One markdown file may contain multiple lemma and selection blocks.
2. Example: one `schloss.md` file may contain two lemma senses and one inflection block.
3. `hostSurfaceHint` is optional and is not authoritative.
4. Block-level `linguisticId` is the explicit semantic identity carrier.
5. The package owns full note text, including metadata-carrier merge for the `entries` map.
6. `linguisticId` must be treated as opaque stored metadata from the current clean-break identity generation.

## Metadata boundary

The package owns the existing format-agnostic note-metadata boundary, not “frontmatter only”.

V1 supported carriers:

1. YAML frontmatter
2. hidden trailing JSON metadata section
3. no metadata

The package owns the `entries` metadata key across both carriers.

```ts
type MetadataEnvelope =
	| {
			kind: "StructuredMetadata";
			carrier: "Frontmatter" | "HiddenJson" | "None";
			entries: Record<string, LinguisticBlockMeta>;
			passthrough: Record<string, unknown>;
			raw: {
				frontmatter?: string;
				jsonSection?: string;
			};
	  }
	| {
			kind: "UnreadableMetadata";
			carrier: "Frontmatter" | "HiddenJson" | "Unknown";
			raw: {
				frontmatter?: string;
				jsonSection?: string;
			};
			diagnostics: LinguisticNoteDiagnostic[];
	  };
```

Rules:

1. `StructuredMetadata` preserves parseable non-owned keys in `passthrough`.
2. `UnreadableMetadata` preserves raw metadata carrier text verbatim.
3. The package must support reading notes that use either metadata carrier.
4. The package must not silently discard hidden JSON metadata.
5. A no-op roundtrip of unreadable metadata must preserve raw carrier text verbatim.
6. A caller cannot mutate owned metadata through normalized serialization while `metadata.kind === "UnreadableMetadata"`; that must fail loudly.

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
	linguisticId: LingId;
	header: {
		raw: string;
		rendered: string;
	};
	decorations: {
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
};

type InvalidTypedBlock = {
	blockKind: "InvalidTypedNote";
	stableId?: string;
	linguisticId?: LingId;
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

## Identity and addressing

Canonical identity is a first-class field, but it is imported from `@textfresser/linguistics` as `LingId`.

Rules:

1. `linguisticId` must be explicitly serialized and parsed back.
2. `linguisticId` must not be reconstructed from rendered header text.
3. The codec must not define or expose a parallel semantic identity model.
4. `stableId` is the durable markdown block id emitted as `^stableId`.
5. `stableId` is durable once persisted.
6. `stableId` is not re-derived during parse from the current `linguisticId`.
7. `stableId` may initially be generated at block-creation time, but afterwards it is preserved unless an explicit migration rewrites both metadata key and anchor.
8. The parser and serializer are agnostic about whether a block should be reused or a new block should be created.
9. Multiple blocks may share the same `linguisticId`; uniqueness within a note is provided by `stableId`, not by the semantic id.
10. The codec must not assume that a stored `linguisticId` from an older clean-break generation still matches the current `toLingId` output.

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
	| { kind: "Attestation"; payload: AttestationSectionDto; title: string; marker: string; rawBlock?: string }
	| { kind: "FreeNote"; payload: FreeNoteSectionDto; title: string; marker: string; rawBlock?: string }
	| { kind: "Meaning"; payload: MeaningSectionDto; title: string; marker: string; rawBlock?: string }
	| { kind: "Morphology"; payload: MorphologySectionDto; title: string; marker: string; rawBlock?: string }
	| { kind: "Relation"; payload: RelationSectionDto; title: string; marker: string; rawBlock?: string }
	| { kind: "Inflection"; payload: InflectionSectionDto; title: string; marker: string; rawBlock?: string }
	| { kind: "Translation"; payload: TranslationSectionDto; title: string; marker: string; rawBlock?: string };
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
2. raw passthrough for arbitrary custom and manual sections

This keeps a typed path for managed free notes without destroying user-authored custom structures.

### Multiplicity and order rules

V1 canonical multiplicity:

1. each typed section kind may appear at most once per typed block
2. section order is significant and preserved
3. the first claimable occurrence of a typed section kind is the canonical claimed section
4. later occurrences of the same typed section kind are preserved as `InvalidTypedSection` if they structurally target a known typed kind
5. unrelated or unknown repeated sections remain `RawSection`

## Decorations

The package owns note decorations and wire format.

Decorations include:

1. rendered header strings
2. localized section titles
3. section markers
4. note-owned title and marker policy

Decoration rules:

1. header rendering is package-owned decoration
2. parsed `header.raw` preserves source wire format for no-op roundtrip
3. canonical decoration rendering is used when creating new typed content or when a caller explicitly requests normalization
4. unchanged parsed notes must not be silently canonicalized on write
5. semantic identity does not come from decoration text

## Metadata contract

Per-block canonical metadata must be serialized explicitly in package-owned note metadata, keyed by block id.

V1 storage model:

1. the package-owned `entries` map is keyed by `stableId`
2. the same `entries` map shape is used regardless of whether the carrier is YAML frontmatter or hidden JSON
3. each entry metadata object carries explicit note-owned metadata, including `linguisticId`
4. block parsing reads `linguisticId` from this map first
5. header text and section text are never the only source of identity
6. unrelated parseable metadata keys are preserved under `metadata.passthrough`
7. serializer merges package-owned `entries` with preserved metadata passthrough into full note text using the original carrier when possible
8. the codec does not promise stored `linguisticId` compatibility across identity-policy changes

Illustrative shape:

```ts
type LinguisticBlockMeta = {
	linguisticId: LingId;
	blockKind: "LemmaNote" | "SelectionNote";
	decorations?: {
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
6. If `metadata.entries[stableId]` is missing or malformed, the parser emits an `InvalidTypedBlock` when a structural block envelope exists.
7. The parser does not best-effort infer `linguisticId` from header text in v1.
8. If note metadata itself is unreadable, parse emits diagnostics and preserves the raw metadata carrier in `UnreadableMetadata`.
9. The primary v1 parse path is canonical-note-first, not legacy-note inference.

### Legacy compatibility

V1 is not a transparent drop-in parser for current legacy Textfresser notes.

Rules:

1. legacy notes that only carry old entry metadata such as `lexicalMeta` are not valid typed notes for the primary v1 parse path
2. such notes may parse as `RawNoteBlock` and/or `InvalidTypedBlock` plus diagnostics
3. explicit legacy import and upgrade APIs belong to the migration step and are not part of the primary v1 codec contract
4. if callers need typed access to legacy notes before migration, they must continue using legacy adapters

### Block splitting rules

The parser owns structural block splitting for the full note body after package metadata is removed.

V1 rules:

1. top-level candidate block chunking is driven by the canonical entry separator
2. separator recognition applies only at top-level body text, not inside fenced code blocks or preserved raw metadata carriers
3. within each separator-delimited chunk, the first non-blank line ending in `^stableId` is the only valid typed-block header candidate
4. any prose before that header inside the same chunk becomes a preceding `RawNoteBlock`
5. any prose after the typed block body inside the same chunk becomes a trailing `RawNoteBlock`
6. if a separator-delimited chunk has no valid anchored header candidate, the entire chunk remains `RawNoteBlock`
7. if a chunk has a structural anchored header plus valid owned metadata and valid payload, it becomes `LemmaNoteBlock` or `SelectionNoteBlock`
8. if a chunk has a structural anchored header but invalid or missing owned metadata, it becomes `InvalidTypedBlock`
9. header-like text inside arbitrary prose, pasted examples, embeds, or code fences does not start a typed block unless it appears in a separator-delimited top-level chunk and satisfies rule 3
10. canonical separator output is mandatory for normalized serialization in v1

## Serialize result

```ts
type SerializeLinguisticMarkdownResult = {
	noteText: string;
};
```

### Serialize behavior

1. serialization emits full note text, including metadata carrier content
2. block ids are emitted as markdown anchors using `^stableId`
3. claimed typed sections are rendered from DTOs
4. raw blocks and raw sections are preserved verbatim where possible
5. serialization must not require generation context, filesystem context, or lookup services
6. the package merges owned `entries` metadata with preserved metadata passthrough keys
7. advanced fragment serializers such as `{ body, entriesMeta }` are non-primary APIs and must not be the public ownership boundary
8. if the note carries `UnreadableMetadata`, no-op serialization must preserve raw metadata verbatim
9. if the note carries `UnreadableMetadata` and the caller requests normalized serialization or owned metadata mutation, serialization must fail loudly rather than silently discarding raw metadata content

## Markdown contract

### Structural rules

1. a note contains zero or more linguistic blocks
2. each block may contain typed sections and raw sections
3. block header rendering is package-owned decoration
4. section markers and localized titles are package-owned decoration
5. lossless raw passthrough is required for unsupported sections and loose text
6. exact canonical separator output is package-owned on fresh serialization of normalized notes
7. parsed notes preserve observed raw inter-block material unless the caller explicitly normalizes the note

### Example note

```md
🏰 [[Schloss]] ^lx-lm-noun-1

<span class="entry_section_title entry_section_title_translations">Ubersetzung</span>
castle

<span class="entry_section_title entry_section_title_kontexte">Kontexte</span>
![[source-note#^abc|^]]


---
---


🔒 [[Schloss]] ^lx-lm-noun-2

<span class="entry_section_title entry_section_title_translations">Ubersetzung</span>
lock


---
---


🧪 [[schloss]] ^lx-in-verb-1

<span class="entry_section_title entry_section_title_kontexte">Kontexte</span>
![[source-note#^def|^]]
```

This is illustrative only. The exact stable-id string format is not the primary contract.

## Relationship to `@textfresser/linguistics`

The package embeds pure linguistics DTOs rather than redefining them.

Rules:

1. lemma blocks embed `AnyLemma`
2. selection blocks embed `AnySelection`
3. note-level addressing, decorations, and sections remain package-owned
4. generation-specific DTOs and old lexical-generation metadata do not belong here

## Section DTO ownership

The typed section DTOs named in this spec are package-owned contracts.

Rules:

1. v1 does not import these DTO contracts from the current propagation package
2. existing propagation payloads may be adapted into the new package-owned DTOs later
3. shared subset shapes can be extracted after the package contract stabilizes

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
4. metadata roundtrip for stored `LingId`
5. lemma block encode/decode
6. selection block encode/decode
7. mixed note with multiple blocks for same surface
8. diagnostics for schema-invalid typed payloads
9. `LingId`-backed identity metadata roundtrip, including language-pack identity-feature cases
10. missing/corrupt `entries[stableId]` metadata behavior
11. hidden JSON metadata roundtrip
12. unreadable metadata-carrier preservation
13. raw preamble, inter-block prose, malformed headers, code fences, and trailing junk
14. repeated typed section handling
15. corpus fixtures taken from current canonical note shapes where compatibility matters
16. explicit current-generation / legacy-`LingId` handling behavior

## Explicit exclusions for v1

1. filesystem path resolution
2. library basename lookup
3. Obsidian-specific services
4. generation-time sense matching
5. migration helpers
6. propagation intent building
7. legacy-note typed inference in the primary parse path

## Summary

The new package is the canonical linguistic markdown codec for Textfresser.

It owns:

1. lossless note structure
2. typed lemma/selection block codecs
3. typed section codecs for the v1 section set
4. canonical identity metadata carriage
5. note decorations and markdown rendering policy

It does not own:

1. filesystem access
2. library lookup
3. generation policy
4. semantic linguistic identity definition
5. sense-matching decisions
