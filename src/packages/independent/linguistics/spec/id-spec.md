# Ling ID Implementation Spec

## Goal

Implement a first-class Ling ID system for this package.

The Ling ID system must do two jobs:

- act as a canonical identity string
- act as a distilled serialization format that can be parsed back into a distilled DTO

This spec is written for the implementation agent. It should be sufficient to implement the feature without additional product decisions.

## Out Of Scope

- No selection ID in v1
- No validation inside `parseLingId`
- No attempt to reconstruct the exact original source object shape beyond the distilled DTO
- No backward-compat layer for any previous unpublished ID format

## Terms

- `Lemma ID`: full Ling ID for a lemma
- `Surface ID`: full Ling ID for a surface
- `Shallow Surface ID`: comparison-only ID for surfaces that ignores target richness
- `Distilled DTO`: the object returned by `parseLingId`

## Source Model Constraints

Use the existing type model.

Surface target is already:

```ts
type SurfaceTargetFor<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> =
	| { canonicalLemma: string }
	| {
			lemma: AbstractLemma<LK, D>;
	  };
```

Important constraints:

- a surface target is mandatory
- the target has exactly two states:
  - shallow: `{ canonicalLemma }`
  - full: `{ lemma }`
- the ID system must preserve that branch exactly
- the parser must not auto-upgrade a shallow target into a full target
- the parser must not collapse a full target into a shallow target
- morpheme lemma extras such as `isClosedSet?` and `separable?` are in scope for v1 and must be preserved by full lemma IDs and by `parseLingId`

## Public API To Add

Add these exports to the package root:

```ts
type LemmaLingId = string;
type SurfaceLingId = string;
type ShallowSurfaceLingId = string;
type LingId = LemmaLingId | SurfaceLingId;
type LingIdSurfaceInput<L extends TargetLanguage = TargetLanguage> =
	AnySurface<L> & {
		orthographicStatus: "Standard" | "Typo";
	};

function buildToLingIdFor<L extends TargetLanguage>(lang: L): (
	value:
		| AnyLemma<L>
		| LingIdSurfaceInput<L>
		| ParsedLemmaDto
		| ParsedSurfaceDto,
) => LingId;

function buildToLemmaLingIdFor<L extends TargetLanguage>(lang: L): (
	value: AnyLemma<L> | ParsedLemmaDto,
) => LemmaLingId;

function buildToSurfaceLingIdFor<L extends TargetLanguage>(lang: L): (
	value: LingIdSurfaceInput<L> | ParsedSurfaceDto,
) => SurfaceLingId;

function buildToShallowSurfaceLingIdFor<L extends TargetLanguage>(lang: L): (
	value: LingIdSurfaceInput<L> | ParsedSurfaceDto,
) => ShallowSurfaceLingId;

function parseLingId(id: LingId): ParsedLingDto;
```

Notes:

- `parseLingId` is global, not language-specific
- `buildToLingIdFor(lang)` is a convenience dispatcher
- `buildToLingIdFor(lang)` must return:
  - lemma ID for lemma input
  - surface ID for surface input

## Distilled Parse Result

`parseLingId` must return a distilled DTO union.

Suggested shape:

```ts
type ParsedLingDto = ParsedLemmaDto | ParsedSurfaceDto;
```

Lemma:

```ts
type ParsedLemmaDto =
	| {
			lingKind: "Lemma";
			language: TargetLanguage;
			canonicalLemma: string;
			lemmaKind: "Lexeme";
			pos: Pos;
			inherentFeatures: Record<string, string | boolean>;
			meaningInEmojis?: string;
	  }
		| {
			lingKind: "Lemma";
			language: TargetLanguage;
			canonicalLemma: string;
			lemmaKind: "Morpheme";
			morphemeKind: MorphemeKind;
			isClosedSet?: boolean;
			separable?: boolean;
			meaningInEmojis?: string;
	  }
	| {
			lingKind: "Lemma";
			language: TargetLanguage;
			canonicalLemma: string;
			lemmaKind: "Phraseme";
			phrasemeKind: PhrasemeKind;
			meaningInEmojis?: string;
			discourseFormulaRole?: string;
	  };
```

Surface:

```ts
type ParsedSurfaceDto = {
	lingKind: "Surface";
	language: TargetLanguage;
	orthographicStatus: "Standard" | "Typo";
	surfaceKind: "Lemma" | "Variant" | "Inflection";
	normalizedFullSurface: string;
	discriminators: {
		lemmaKind: LemmaKind;
		lemmaSubKind: string;
	};
	target:
		| { canonicalLemma: string }
		| { lemma: ParsedLemmaDto };
	inflectionalFeatures?: Record<string, string | boolean>;
};
```

Requirements:

- parser output must be a plain serializable DTO
- parser output must be feedable into the relevant strict exported schemas
- parser output must preserve branch choice for `target`
- parser output for nested full lemma targets must recursively parse the nested lemma ID into a distilled lemma DTO
- parser output must not hide DTO fields via non-enumerable properties

## Wire Format

### Prefix

All IDs start with:

```text
ling:v1:<LANG>:<KIND>;
```

Where:

- `<LANG>` is a stable short code such as `DE`, `EN`
- `<KIND>` is one of:
  - `LEM`
  - `SURF`

### Lemma Wire Format

```text
ling:v1:<LANG>:LEM;<canonicalLemma>;<lemmaKind>;<lemmaSubKind>;<lemmaFeatures>;<meaningInEmojis>
```

Examples:

```text
ling:v1:DE:LEM;untergehen;Lexeme;VERB;separable=Yes;-
ling:v1:DE:LEM;untergehen;Lexeme;VERB;separable=No;-
ling:v1:DE:LEM;See;Lexeme;NOUN;gender=Fem;-
ling:v1:DE:LEM;See;Lexeme;NOUN;gender=Neut;-
ling:v1:DE:LEM;ab%2D;Morpheme;Prefix;separable=Yes;-
ling:v1:EN:LEM;walk;Lexeme;VERB;-;🚶
```

### Surface Wire Format

```text
ling:v1:<LANG>:SURF;<normalizedFullSurface>;<orthographicStatus>;<surfaceKind>;<lemmaKind>;<lemmaSubKind>;<inflectionalFeatures>;<targetMode>;<targetPayload>
```

Examples:

```text
ling:v1:EN:SURF;walk;Standard;Inflection;Lexeme;VERB;tense=Pres,verbForm=Fin;lemma;ling:v1:EN:LEM;walk;Lexeme;VERB;-;🚶
ling:v1:DE:SURF;See;Standard;Lemma;Lexeme;NOUN;-;canon;See
ling:v1:DE:SURF;See;Standard;Lemma;Lexeme;NOUN;-;lemma;ling:v1:DE:LEM;See;Lexeme;NOUN;gender=Fem;-
ling:v1:DE:SURF;See;Standard;Lemma;Lexeme;NOUN;-;lemma;ling:v1:DE:LEM;See;Lexeme;NOUN;gender=Neut;-
```

### Shallow Surface Wire Format

This is a separate comparison key, not a replacement for full `SURF`.

```text
ling:v1:<LANG>:SURF-SHALLOW;<normalizedFullSurface>;<orthographicStatus>;<surfaceKind>;<lemmaKind>;<lemmaSubKind>;<inflectionalFeatures>
```

Examples:

```text
ling:v1:DE:SURF-SHALLOW;See;Standard;Lemma;Lexeme;NOUN;-
ling:v1:EN:SURF-SHALLOW;walk;Standard;Inflection;Lexeme;VERB;tense=Pres,verbForm=Fin
```

## Serialization Rules

### Lemma Serialization

For lemma IDs:

- serialize `canonicalLemma`
- serialize `lemmaKind`
- serialize lemma subkind:
  - `pos`
  - `morphemeKind`
  - `phrasemeKind`
- serialize `lemmaFeatures`
- serialize `meaningInEmojis` or `-`

Important rule:

- for lexemes, `lemmaFeatures` is the full `inherentFeatures` bag
- for morphemes, `lemmaFeatures` is the bag of present top-level morpheme extras, currently:
  - `isClosedSet`
  - `separable`
- for phrasemes, `lemmaFeatures` is the bag of present top-level identity-relevant extras, currently:
  - `discourseFormulaRole` when present

Identity rule:

- for lexemes, all present `inherentFeatures` are identity-breaking
- for morphemes, all present supported top-level morpheme extras are identity-breaking in v1
- for phrasemes, all present supported top-level phraseme extras are identity-breaking in v1

This is not a selected subset.

Examples:

- German `untergehen` with `separable=Yes` and `separable=No` must produce different IDs
- German `See` with `gender=Fem` and `gender=Neut` must produce different IDs

### Surface Serialization

For full surface IDs:

- serialize `normalizedFullSurface`
- serialize `orthographicStatus`
- serialize `surfaceKind`
- serialize `surface.discriminators.lemmaKind`
- serialize `surface.discriminators.lemmaSubKind`
- serialize inflectional features if `surfaceKind === "Inflection"`, otherwise `-`
- serialize target branch explicitly:
  - `canon`
  - `lemma`
- serialize target payload:
  - if `canon`: the canonical lemma string
  - if `lemma`: the nested full lemma ID

### Shallow Surface Serialization

For shallow surface IDs:

- serialize the same surface shell as full surface ID
- do not serialize target mode
- do not serialize target payload

This ID exists only for comparison.

## Normalization Rules

These rules are mandatory.

### Feature Ordering

Feature keys must be serialized in deterministic order.

V1 rule:

- sort feature keys alphabetically by serialized key name
- do this for:
  - lemma feature bags
  - inflectional feature bags
- implementation must not rely on object insertion order

Architecture rule:

- keep the serialization code language-specific
- do not add explicit per-language order tables in this implementation unless needed for correctness
- future language-specific ordering can override alphabetical ordering later without changing the wire grammar

### Empty Feature Bundles

Use `-` for an empty feature bundle.

Examples:

- lemma with no inherent features -> `-`
- non-inflection surface -> `-`
- inflection surface with empty inflectional bundle -> `-`

### Missing Vs Explicit

Do not silently collapse:

- explicit feature values
- missing features

If a field is absent in the DTO, that must be reflected by omission from the serialized feature bundle, not by inventing a value.

### Branch Preservation

Do not collapse:

- `{ canonicalLemma: "See" }`
- `{ lemma: { ... } }`

Those are different full surface serializations.

## Comparison Semantics

There are two equality modes.

### Full Equality

Compare full Ling IDs.

This includes:

- target branch choice
- nested full lemma identity if present

### Shallow Surface Equality

Compare shallow surface IDs.

This ignores:

- target branch choice
- target payload

### Required `See` Matrix

For two German surfaces with `normalizedFullSurface = "See"`:

1. both have same full lemma target -> same full ID
2. both have different full lemma targets -> different full ID
3. both have shallow `{ canonicalLemma: "See" }` targets -> same full ID
4. one has shallow target, one has full target -> different full ID
5. all four above share the same shallow surface ID

## Parsing Rules

`parseLingId` must:

- inspect prefix
- dispatch by:
  - language code
  - kind
- rebuild a distilled DTO
- recursively parse nested lemma IDs inside full surface targets

`parseLingId` must not:

- validate with `LemmaSchema` or `SurfaceSchema`
- infer richer data than what was encoded
- convert shallow target into full target

## Lang Pack Responsibilities

Each language pack must own:

- language code mapping, e.g. `German -> DE`, `English -> EN`
- any language-specific normalization of feature names or values
- language-specific serializer entrypoints

For v1, feature ordering itself is not a per-language table.
Use the global alphabetical rule above.

Global shared code may own:

- prefix parsing
- token splitting
- escaping
- recursive parse orchestration
- top-level API exports

## Escaping

This is required for implementation, not optional.

Any dynamic field that can contain reserved separators must be escaped before serialization and unescaped during parse.

Reserved separators currently include:

- `;`
- `,`
- `=`
- `-` when it appears in a serialized dynamic token

At minimum, escaping must work for:

- `canonicalLemma`
- `normalizedFullSurface`
- `meaningInEmojis`
- feature values
- nested IDs in target payload

The exact escaping scheme is up to the implementation agent, but it must be:

- deterministic
- reversible
- applied consistently in serializer and parser

## Implementation Order

Recommended implementation order:

1. Add public types and exports
2. Add language-code mapping
3. Implement lemma serializer
4. Implement surface serializer
5. Implement shallow surface serializer
6. Implement parser for lemma IDs
7. Implement parser for surface IDs
8. Add root export tests
9. Add round-trip tests
10. Add `See` ambiguity tests

## Required Tests

The implementation is not complete until these tests exist.

### Root API

- root exports include:
  - `buildToLingIdFor`
  - `buildToLemmaLingIdFor`
  - `buildToSurfaceLingIdFor`
  - `buildToShallowSurfaceLingIdFor`
  - `parseLingId`

### Lemma Identity

- German `untergehen` with `separable=Yes` and `separable=No` serialize differently
- German `See` with `gender=Fem` and `gender=Neut` serialize differently
- German prefix morphemes with and without `separable` serialize differently
- English `walk` lemma with empty inherent features serializes with `-`

### Surface Identity

- surface with shallow target serializes differently from the same surface with full target
- surface with full target serializes nested lemma ID, not inline ad hoc fields
- inflectional surface serializes sorted inflectional features
- non-inflection surface serializes `-` for inflectional features

### Shallow Surface Identity

- two surfaces differing only in target richness have the same shallow surface ID
- two surfaces differing only in target lemma identity have the same shallow surface ID
- two surfaces differing in inflectional features have different shallow surface IDs

### Parsing

- parser round-trips lemma IDs:

```ts
const id = toLemmaLingId(lemma);
expect(toLemmaLingId(parseLingId(id))).toBe(id);
```

- parser round-trips surface IDs:

```ts
const id = toSurfaceLingId(surface);
expect(toSurfaceLingId(parseLingId(id))).toBe(id);
```

- parser preserves shallow target branch
- parser preserves full target branch
- parser recursively parses nested lemma IDs in full surface targets

### DTO Behavior

- parsed lemma DTO survives spread / `JSON.stringify` / `structuredClone`
- parsed surface DTO survives spread / `JSON.stringify` / `structuredClone`
- parsed lemma DTO can be passed directly to `buildToLemmaLingIdFor(...)`
- parsed surface DTO can be passed directly to `buildToSurfaceLingIdFor(...)`

## Acceptance Criteria

Implementation is done when all of the following are true:

- all required exports exist
- lemma IDs are stable and deterministic
- surface IDs are stable and deterministic
- shallow surface IDs are stable and deterministic
- parser round-trips both lemma and surface IDs
- parser preserves shallow vs full surface target branch
- `See` ambiguity matrix behaves exactly as specified
- tests pass

## Non-Negotiable Rules

- all present lexeme `inherentFeatures` are identity-breaking
- no central `identity-feature-registry`
- language packs own identity serialization details
- full surface ID includes target richness
- shallow surface ID ignores target richness
- `parseLingId` is global
- parser output is feedable, not auto-validated
