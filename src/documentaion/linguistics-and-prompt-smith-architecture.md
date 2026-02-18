# Linguistics & Prompt-Smith — Architecture

> **Scope**: This document covers the **linguistics type system** (`src/linguistics/`) and the **prompt management layer** (`src/prompt-smith/`). These two modules form the foundational layer that both the Lemma and Generate commands depend on. For the command pipeline itself, see `textfresser-architecture.md`. For FS dispatch, see `vam-architecture.md`.

---

## 1. Purpose

### Why a linguistics type system?

Every word the user encounters flows through a pipeline that starts with LLM classification and ends with a markdown dictionary entry in the vault. The linguistics module provides a **Zod-schema-based type system** that serves as the single source of truth for:

- **LLM output validation** — agent responses are parsed against Zod schemas that reference linguistics enums
- **Section formatters** — formatters consume typed DTOs (e.g., `NounInflectionCell`) rather than raw JSON
- **Domain model** — `Entity<L,U,S,P>` captures language/unit/surface identity with split `features.lexical` and `features.inflectional` (German binding: `DeEntity`)
- **Dict entry IDs** — structured IDs like `LX-LM-NOUN-1` encode unit kind, surface kind, POS, and index

### Why a prompt management layer?

The system makes 2-6 LLM calls per new dictionary entry (Lemma + Morphem + Relation + Inflection + Translation, sometimes Disambiguate). Each prompt needs:

- A **system prompt** assembled from agent-role + task-description + examples
- **Input/output schemas** for structured JSON responses (Gemini `zodResponseFormat`)
- **Language pair routing** — German-English is primary, German-Russian partial, English-English fallback
- **Build-time validation** — examples checked against schemas before prompts are compiled

Prompt-Smith handles all of this with a codegen pipeline that produces a type-safe `PROMPT_FOR` dictionary.

---

## 2. Linguistics — Type Hierarchy

### 2.1 Common (language-agnostic)

The `src/linguistics/common/` subtree defines enums and schemas shared across all languages.

#### Core discriminants

**Source**: `common/enums/core.ts`

```typescript
LinguisticUnitKind = "Phrasem" | "Lexem" | "Morphem"
SurfaceKind        = "Lemma" | "Inflected" | "Variant"
```

| Discriminant | Values | Purpose |
|---|---|---|
| `LinguisticUnitKind` | Phrasem, Lexem, Morphem | Top-level unit classification |
| `SurfaceKind` | Lemma, Inflected, Variant | Relationship of surface form to canonical entry |

`LANGUAGE_ISO_CODE` maps `{ English: "en", German: "de" }`.

#### Lexem enums

**Source**: `common/enums/linguistic-units/lexem/pos.ts`

```typescript
POS = "Noun" | "Pronoun" | "Article" | "Adjective" | "Verb"
    | "Preposition" | "Adverb" | "Particle" | "Conjunction"
    | "InteractionalUnit"
```

Each POS has a compact tag via `PosTag`:

| POS | PosTag |
|---|---|
| Noun | NOUN |
| Pronoun | PRON |
| Article | ART |
| Adjective | ADJ |
| Verb | VERB |
| Preposition | PREP |
| Adverb | ADV |
| Particle | PART |
| Conjunction | KON |
| InteractionalUnit | IU |

Bidirectional maps: `posTagFormFromPos` (POS -> PosTag) and `posFormFromPosTag` (PosTag -> POS).

**Source**: `common/enums/linguistic-units/lexem/inflectional-features.ts`

```typescript
InflectionalFeature = "Number" | "Gender" | "Case" | "Degree"
                    | "Person" | "Tense" | "Mood" | "Voice" | "Aspect"
```

#### Morphem enums

**Source**: `common/enums/linguistic-units/morphem/morpheme-kind.ts`

```typescript
// Universal (11 kinds)
MorphemeKind = "Root" | "Prefix" | "Suffix" | "Suffixoid" | "Infix"
             | "Circumfix" | "Interfix" | "Transfix" | "Clitic"
             | "ToneMarking" | "Duplifix"

// German subset (7 kinds) — see de/morphem/de-morphem-kind.ts
GermanMorphemeKind = "Root" | "Prefix" | "Suffix" | "Suffixoid"
                   | "Circumfix" | "Interfix" | "Duplifix"
```

**Source**: `de/morphem/prefix/features.ts`

```typescript
Separability = "Separable" | "Inseparable"
```

#### Phrasem enums

**Source**: `common/enums/linguistic-units/phrasem/phrasem-kind.ts`

```typescript
PhrasemeKind = "Idiom" | "Collocation" | "DiscourseFormula"
             | "Proverb" | "CulturalQuotation"
```

| Kind | Description | Example |
|---|---|---|
| Idiom | Non-literal, fixed expression | "kick the bucket" |
| Collocation | Productive template with open slot | "[modifier] + reasons" |
| DiscourseFormula | Fixed social routine | "thank you", "excuse me" |
| Proverb | Full-sentence folk wisdom | "A stitch in time saves nine" |
| CulturalQuotation | Well-known literary/public quote | "To be or not to be" |

#### Inflection feature values

**Source**: `common/enums/inflection/feature-values.ts`

```typescript
CaseValue   = "Nominative" | "Accusative" | "Dative" | "Genitive"
NumberValue = "Singular" | "Plural"
```

#### Zod export pattern

Every enum file follows the same four-export pattern:

```typescript
import { z } from "zod/v3";

const VALUES = ["Foo", "Bar", "Baz"] as const;

export const FooSchema    = z.enum(VALUES);      // Zod schema
export type Foo           = z.infer<typeof FooSchema>;  // TS type
export const Foo          = FooSchema.enum;       // Const enum object
export const FOO_OPTIONS  = FooSchema.options;    // Readonly string array
```

**Exception**: `pos.ts` and `tags.ts` use `import z from "zod"` (v4) because they are consumed by VAM code that requires v4 APIs (`.extend()`, `z.codec()`). See section 3.5 for the full boundary rules.

#### Key files — common enums

| File | Exports |
|---|---|
| `common/enums/core.ts` | `LinguisticUnitKindSchema`, `SurfaceKindSchema`, `LANGUAGE_ISO_CODE` |
| `common/enums/linguistic-units/lexem/pos.ts` | `POSSchema`, `PosTagSchema`, `posTagFormFromPos`, `posFormFromPosTag` |
| `common/enums/linguistic-units/lexem/inflectional-features.ts` | `InflectionalFeatureSchema` |
| `common/enums/linguistic-units/morphem/morpheme-kind.ts` | `MorphemeKindSchema` |
| `de/morphem/prefix/features.ts` | `SeparabilitySchema` |
| `common/enums/linguistic-units/phrasem/phrasem-kind.ts` | `PhrasemeKindSchema` |
| `common/enums/inflection/feature-values.ts` | `CaseValueSchema`, `NumberValueSchema` |

---

### 2.2 German-specific (de/)

**Location**: `src/linguistics/de/`

The German-specific layer derives from common enums, adding features only where a POS or morpheme kind has language-specific properties.

#### Stub pattern

Only POS values without specialized schemas remain stubs — they carry only the `pos` discriminant with no extra fields:

```typescript
// de/lexem/de-pos.ts
type GermanPosStub = Exclude<POS, "Noun" | "Verb" | "Adjective">;
// = "Pronoun" | "Article" | "Preposition" | ...

// Each stub schema is just: z.object({ pos: z.literal("Verb") })
```

Specialized POS schemas currently exist for `Noun`, `Verb`, and `Adjective`.

#### Morpheme kinds — explicit folder per kind

Unlike lexem POS stubs (dynamic), each German morpheme kind has an explicit `{kind}/features.ts` file. Only `Prefix` has specialized features (separability); the rest export a minimal schema with just the `morphemeKind` discriminant. The German subset is 7 of the 11 universal kinds (excluding Infix, Transfix, Clitic, ToneMarking).

```typescript
// de/morphem/de-morphem-kind.ts
GermanMorphemeKind = "Root" | "Prefix" | "Suffix" | "Suffixoid"
                   | "Circumfix" | "Interfix" | "Duplifix"
```

#### Noun features

**Source**: `de/lexem/noun/features.ts`

```typescript
GermanGenus = "Maskulinum" | "Femininum" | "Neutrum"
NounClass   = "Common" | "Proper"

GermanNounFullFeaturesSchema = z.object({
    genus: GermanGenusSchema,
    nounClass: NounClassSchema,
    pos: z.literal("Noun"),
})

GermanNounRefFeaturesSchema = z.object({
    pos: z.literal("Noun"),
})
```

Full features live on Lemma surfaces; Inflected/Variant surfaces carry only ref features (the `pos` discriminant).

**Article derivation**: `articleFromGenus: Record<GermanGenus, string>` maps `Maskulinum -> "der"`, `Femininum -> "die"`, `Neutrum -> "das"`.

**Display constants** (also in `de/lexem/noun/features.ts`):

| Constant | Type | Values |
|---|---|---|
| `GERMAN_CASE_TAG` | `Record<CaseValue, string>` | Nominative -> "Nominativ", Accusative -> "Akkusativ", Genitive -> "Genitiv", Dative -> "Dativ" |
| `GERMAN_NUMBER_TAG` | `Record<NumberValue, string>` | Singular -> "Singular", Plural -> "Plural" |
| `CASE_LABEL_FOR_TARGET_LANGUAGE` | `Record<TargetLanguage, Record<CaseValue, string>>` | German: Nominativ/Akkusativ/Genitiv/Dativ; English: Nominative/Accusative/Genitive/Dative |
| `NUMBER_LABEL_FOR_TARGET_LANGUAGE` | `Record<TargetLanguage, Record<NumberValue, string>>` | German + English: Singular/Plural |
| `GERMAN_GENUS_LABEL_FOR_TARGET_LANGUAGE` | `Record<TargetLanguage, Record<GermanGenus, string>>` | German: Maskulin/Feminin/Neutrum; English: Masculine/Feminine/Neuter |
| `CASE_SHORT_LABEL` | `Record<CaseValue, string>` | N, A, G, D |
| `CASE_ORDER` | `CaseValue[]` | Nominative, Accusative, Genitive, Dative |

**Noun inflection cell** (used by noun-inflection formatter):

```typescript
type NounInflectionCell = {
    case: CaseValue;
    number: NumberValue;
    article: string;
    form: string;
}
```

#### Prefix features

**Source**: `de/morphem/prefix/features.ts`

```typescript
Separability = "Separable" | "Inseparable"

GermanPrefixFullFeaturesSchema = z.object({
    morphemeKind: z.literal(MorphemeKind.Prefix),
    separability: SeparabilitySchema,
})
```

#### Verb / Root features

`de/lexem/verb/features.ts` defines structured lemma-only verb features:

```typescript
GermanVerbConjugation = "Irregular" | "Rregular"
GermanVerbSeparability = "Separable" | "Inseparable" | "None"
GermanVerbReflexivity = "NonReflexive" | "ReflexiveOnly" | "OptionalReflexive"

GermanVerbValency = {
    separability: GermanVerbSeparability
    reflexivity: GermanVerbReflexivity
    governedPreposition?: string
}

GermanVerbFullFeaturesSchema = z.object({
    pos: z.literal("Verb"),
    conjugation: GermanVerbConjugationSchema,
    valency: GermanVerbValencySchema,
})
GermanVerbRefFeaturesSchema = z.object({ pos: z.literal("Verb") })
```

The module also exports `buildGermanVerbEntryIdentity(profile)` — a deterministic identity string built from conjugation + valency (including separability).

#### Adjective features

`de/lexem/adjective/features.ts` defines structured lemma-only adjective features:

```typescript
GermanAdjectiveClassification = "Qualitative" | "Relational" | "Participial"
GermanAdjectiveGradability = "Gradable" | "NonGradable"
GermanAdjectiveDistribution =
    "AttributiveAndPredicative" | "AttributiveOnly" | "PredicativeOnly"
GermanAdjectiveGovernedPattern =
    "None" | "Dative" | "Accusative" | "Genitive" | "Prepositional"
  | "ZuInfinitive" | "DassClause"

GermanAdjectiveValency = {
    governedPattern: GermanAdjectiveGovernedPattern
    governedPreposition?: string // required only for "Prepositional"
}

GermanAdjectiveFullFeaturesSchema = z.object({
    pos: z.literal("Adjective"),
    classification: GermanAdjectiveClassificationSchema,
    gradability: GermanAdjectiveGradabilitySchema,
    distribution: GermanAdjectiveDistributionSchema,
    valency: GermanAdjectiveValencySchema,
})
GermanAdjectiveRefFeaturesSchema = z.object({ pos: z.literal("Adjective") })
```

#### Top-level German DTO

**Source**: `de/index.ts`

```typescript
GermanLinguisticUnitSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("Lexem"),   surface: GermanLexemSurfaceSchema }),
    z.object({ kind: z.literal("Phrasem"), surface: PhrasemSurfaceSchema }),
    z.object({ kind: z.literal("Morphem"), surface: GermanMorphemSurfaceSchema }),
])
```

Type: `GermanLinguisticUnit` — legacy compatibility DTO.

Canonical propagation DTO: `DeEntity<U,S> = Entity<"German", U, S, DePosLikeDiscriminator<U>>`, with top-level `emojiDescription` + `ipa` + optional `senseGloss` and split features:
- `features.lexical` — inherent lexical properties (`genus`, `nounClass`, valency, etc.)
- `features.inflectional` — realized/variable inflectional data (lemma entries are typically empty here)

#### Key files — German

| File | Exports |
|---|---|
| `de/index.ts` | `GermanLinguisticUnitSchema`, `GermanLinguisticUnit` |
| `de/lemma/de-lemma-result.ts` | `DeLemmaResultSchema`, `DeLexemLemmaResultSchema`, `DePhrasemLemmaResultSchema`, `DePosLikeKindSchema` |
| `de/lemma/generate-contracts.ts` | `DeLexicalTargetSchema`, `DeEnrichment*`, `DeRelation*`, `DeInflection*`, `DeFeatures*`, `DeWordTranslation*` |
| `de/lemma/index.ts` | Barrel exports for vNext lemma/generate contracts |
| `de/lexem/index.ts` | `GermanLexemSurfaceSchema`, `GermanLexemSurface` |
| `de/lexem/de-pos.ts` | `GERMAN_POS_STUBS` |
| `de/lexem/noun/features.ts` | `GermanGenusSchema`, `NounClassSchema`, `articleFromGenus`, `NounInflectionCell`, display constants |
| `de/lexem/noun/index.ts` | `GermanNounSurfaceSchema`, `GermanNounLemma`, `GermanNounInflection` |
| `de/lexem/adjective/features.ts` | `GermanAdjective*Schema`, `GermanAdjective*` types |
| `de/lexem/verb/features.ts` | `GermanVerb*Schema`, `GermanVerb*` types, `buildGermanVerbEntryIdentity` |
| `de/morphem/index.ts` | `GermanMorphemSurfaceSchema`, `GermanMorphemSurface` |
| `de/morphem/de-morphem-kind.ts` | `GermanMorphemeKindSchema`, `GermanMorphemeKind`, `GERMAN_MORPHEME_KINDS` |
| `de/morphem/prefix/features.ts` | `SeparabilitySchema`, `GermanPrefixFullFeaturesSchema` |
| `de/phrasem/index.ts` | Re-exports `PhrasemSurface`, `PhrasemSurfaceSchema` from common |

---

### 2.3 Surface Schema Factory

**Source**: `common/dto/surface-factory.ts`

The factory function `makeSurfaceSchema<F, R>(fullFeatures, refFeatures)` produces a `z.discriminatedUnion("surfaceKind", ...)` with three variants:

```
makeSurfaceSchema(fullFeatures, refFeatures)
    ├─ Lemma      { surfaceKind: "Lemma",     features: F, lemma: string }
    ├─ Inflected  { surfaceKind: "Inflected", features: R, lemma: string, lemmaRef: string, surface: string }
    └─ Variant    { surfaceKind: "Variant",   features: R, lemma: string, lemmaRef: string, surface: string }
```

**Two-tier feature split**:
- **Full features** (`F`) — used for Lemma surfaces. Contains all grammatical properties (e.g., genus + nounClass for nouns).
- **Ref features** (`R`) — used for Inflected/Variant surfaces. Contains only the POS discriminant (genus lives on the lemma entry, not on derived forms).

**Composition diagram**:

```
POS features (genus, nounClass, separability, ...)
    ↓
Lexem/Morphem/Phrasem full features (discriminated union by pos/morphemeKind/phrasemeKind)
    ↓
makeSurfaceSchema(fullFeatures, refFeatures)
    ↓
Surface schema (discriminated union by surfaceKind)
    ↓
z.object({ kind: "Lexem", surface: LexemSurfaceSchema })
    ↓
GermanLinguisticUnit (discriminated union by kind)
```

**Phrasem surface** (`common/dto/phrasem-surface.ts`):

```typescript
CollocationStrength = "Free" | "Bound" | "Frozen"
CollocationType = "AdjectiveNoun" | "NounNoun" | "NounVerb" | ...
DiscourseFormulaRole = "Greeting" | "Farewell" | "Apology" | ...

// Phrasem full features: discriminated by phrasemeKind
//   Collocation adds optional `strength` + `collocationType`
//   DiscourseFormula adds optional `role`
//   Others: just the discriminant

PhrasemSurfaceSchema = makeSurfaceSchema(PhrasemFullFeaturesSchema, PhrasemRefFeaturesSchema)
```

---

### 2.4 Dict Entry ID System

**Canonical source**: `src/commanders/textfresser/domain/dict-entry-id/`

Every dictionary entry has a structured ID that encodes its linguistic classification.

#### ID format

```
{UnitKindTag}-{SurfaceKindTag}[-{PosTag}]-{index}
```

| Component | Values | Example |
|---|---|---|
| UnitKindTag | LX, PH, MO | LX = Lexem |
| SurfaceKindTag | LM, IN, VA | LM = Lemma |
| PosTag | NOUN, VERB, ADJ, ... | Only for Lexem (required) |
| index | 1, 2, 3, ... | Disambiguates polysemous entries |

**Examples**:
- Noun lemma: `LX-LM-NOUN-1`
- Verb inflected form: `LX-IN-VERB-2`
- Morphem lemma: `MO-LM-3`
- Phrasem lemma: `PH-LM-1`

#### Tags

**Source**: `src/commanders/textfresser/domain/dict-entry-id/tags.ts`

```typescript
LinguisticUnitKindTag = "LX" | "PH" | "MO"
SurfaceKindTag        = "LM" | "IN" | "VA"
```

Bidirectional maps:
- `linguisticUnitKindTagFrom` / `linguisticUnitKindFrom` (Lexem <-> LX, Phrasem <-> PH, Morphem <-> MO)
- `surfaceKindTagFrom` / `surfaceKindFrom` (Lemma <-> LM, Inflected <-> IN, Variant <-> VA)

**Note**: Tag schemas use Zod v4 (`import z from "zod"`) because they participate in VAM type composition.

#### Parsed ID types

**Source**: `src/commanders/textfresser/domain/dict-entry-id/dict-entry-id.ts`

`ParsedDictEntryId` is a discriminated union by `unitKindTag`:

```typescript
// Lexem: POS required
ParsedLexemId = {
    unitKindTag: "LX", unitKind: "Lexem",
    surfaceKindTag: SurfaceKindTag, surfaceKind: SurfaceKind,
    posTag: PosTag, pos: POS,
    index: number
}

// Phrasem/Morphem: no POS
ParsedNonLexemId = {
    unitKindTag: "PH" | "MO", unitKind: "Phrasem" | "Morphem",
    surfaceKindTag: SurfaceKindTag, surfaceKind: SurfaceKind,
    posTag: undefined, pos: undefined,
    index: number
}
```

#### Helper facade

`dictEntryIdHelper` provides four methods:
- `.parse(id)` — parse ID string into `ParsedDictEntryId | undefined`
- `.build(parts)` — build ID string from typed parts
- `.buildPrefix(parts)` — build prefix for matching (e.g., `LX-LM-NOUN-`)
- `.nextIndex(existingIds, prefix)` — find max index and return next

---

### 2.5 Section Configuration

**Canonical source**: `src/commanders/textfresser/targets/de/sections/`

#### DictSectionKind

**Source**: `src/commanders/textfresser/targets/de/sections/section-kind.ts`

```typescript
DictSectionKind = "Relation" | "FreeForm" | "Attestation" | "Morphem" | "Morphology"
               | "Header" | "Deviation" | "Inflection" | "Translation" | "Tags"
```

Each kind has display titles in English and German:

| Kind | English | German |
|---|---|---|
| Header | Forms | Formen |
| Attestation | Contexts | Kontexte |
| Translation | Translation | Ubersetzung |
| Relation | Relations | Semantische Beziehungen |
| Morphem | Morphemes | Morpheme |
| Morphology | Morphological Relations | Morphologische Relationen |
| Inflection | Inflection | Flexion |
| Deviation | Deviations | Abweichungen |
| FreeForm | Notes | Notizen |
| Tags | Tags | Tags |

#### CSS suffixes

**Source**: `src/commanders/textfresser/targets/de/sections/section-css-kind.ts`

Maps each `DictSectionKind` to a CSS class suffix used in `entry_section_title_{suffix}`:

```
Header -> "formen", Attestation -> "kontexte", FreeForm -> "notizen",
Relation -> "synonyme", Morphem -> "morpheme", Morphology -> "morphologie", Deviation -> "abweichungen",
Inflection -> "flexion", Translation -> "translations", Tags -> "tags"
```

#### Section selection

**Source**: `src/commanders/textfresser/targets/de/sections/section-config.ts`

**CORE_SECTIONS** (always included):

```typescript
[Header, Tags, Translation, Attestation, FreeForm]
```

**Per-POS sections** (`sectionsForLexemPos`):

| POS | Sections |
|---|---|
| Noun | CORE + Relation, Morphem, Morphology, Inflection |
| Verb | CORE + Relation, Morphem, Morphology, Inflection, Deviation |
| Adjective | CORE + Relation, Morphology, Inflection |
| Adverb | CORE + Relation, Morphology |
| Article | CORE + Morphology, Inflection |
| Pronoun | CORE + Morphology, Inflection |
| Preposition | CORE + Relation, Morphology |
| Particle | CORE + Relation, Morphology |
| Conjunction | CORE + Morphology |
| InteractionalUnit | CORE + Morphology |

**Special-case sections**:
- `sectionsForProperNoun` = CORE only (no Inflection, Morphem, Morphology, Relation)
- `sectionsForPhrasem` = Header, Translation, Attestation, Relation, FreeForm
- `sectionsForMorphem` = Header, Attestation, FreeForm

**`getSectionsFor()` overloads**:

```typescript
getSectionsFor(query: { unit: "Lexem"; pos: POS; nounClass?: NounClass }): readonly DictSectionKind[]
getSectionsFor(query: { unit: "Morphem" | "Phrasem" }): readonly DictSectionKind[]
```

When `unit: "Lexem"` with `pos: "Noun"` and `nounClass: "Proper"`, returns `sectionsForProperNoun`.

**Display weight** (`SECTION_DISPLAY_WEIGHT`):

| Kind | Weight |
|---|---|
| Header | 0 |
| Tags | 1 |
| Attestation | 2 |
| Relation | 3 |
| Translation | 4 |
| Morphem | 4 |
| Morphology | 5 |
| Tags | 6 |
| Inflection | 7 |
| Deviation | 8 |
| FreeForm | 9 |

Lower weight = earlier in the note. Unknown kinds sort to weight 99. `compareSectionsByWeight()` provides a comparator for sorting.

---

## 3. Prompt-Smith — Prompt Management

### 3.1 Architecture Overview

**Location**: `src/prompt-smith/`

```
src/prompt-smith/
├── index.ts                          # Auto-generated: PROMPT_FOR dict + re-exports
├── types.ts                          # AvaliablePromptDict type
├── schemas/                          # Zod I/O schemas per PromptKind
│   ├── index.ts                      # SchemasFor registry, UserInput<K>, AgentOutput<K>
│   ├── lemma.ts
│   ├── morphem.ts
│   ├── relation.ts
│   ├── translate.ts
│   ├── inflection.ts
│   ├── noun-inflection.ts
│   ├── disambiguate.ts
│   ├── word-translation.ts
│   ├── lexem-enrichment.ts
│   ├── phrasem-enrichment.ts
│   ├── feature-shared.ts
│   └── features-*.ts            # per-POS feature contracts
├── prompt-parts/                     # Human-authored prompt sources
│   ├── german/
│   │   ├── english/                  # German->English: full runtime prompt set
│   │   │   ├── lemma/
│   │   │   │   ├── agent-role.ts
│   │   │   │   ├── task-description.ts
│   │   │   │   └── examples/
│   │   │   │       ├── to-use.ts     # Used in generation
│   │   │   │       └── to-test.ts    # Optional test examples
│   │   │   ├── morphem/
│   │   │   └── ...                   # One dir per PromptKind
│   │   └── russian/                  # German->Russian: only Translate & WordTranslation
│   └── english/
│       └── english/                  # English->English: fallback prompt set
└── codegen/
    ├── consts.ts                     # PromptKind enum, PromptPartKind enum
    ├── generated-promts/             # Auto-generated compiled prompts
    │   ├── german/english/           # one *-prompt.ts per PromptKind
    │   ├── german/russian/           # 2 *-prompt.ts files
    │   └── english/english/          # fallback prompts for required kinds
    └── skript/
        ├── run.ts                    # Main codegen entry point
        ├── combine-parts.ts          # Assemble parts into XML-tagged system prompt
        ├── utils.ts                  # Path utilities, kebab-case
        ├── enshure-all-parts-are-present.ts
        ├── enshure-parts-format.ts
        └── enshure-all-examples-match-schema.ts
```

**Language pair structure**: `prompt-parts/{targetLanguage}/{knownLanguage}/{promptKind}/`

---

### 3.2 Schemas (Zod v3)

**Source**: `schemas/index.ts`

The `SchemasFor` registry maps each `PromptKind` to `{ userInputSchema, agentOutputSchema }`.
Current runtime kinds:

```typescript
"Translate" | "Morphem" | "Lemma"
| "LexemEnrichment" | "NounEnrichment" | "PhrasemEnrichment"
| "Relation" | "Inflection" | "NounInflection"
| "Disambiguate" | "WordTranslation"
| "FeaturesNoun" | "FeaturesPronoun" | "FeaturesArticle" | "FeaturesAdjective"
| "FeaturesVerb" | "FeaturesPreposition" | "FeaturesAdverb" | "FeaturesParticle"
| "FeaturesConjunction" | "FeaturesInteractionalUnit"
```

Type helpers still extract inferred per-kind I/O:

```typescript
type UserInput<K extends PromptKind>  = z.infer<SchemasFor[K]["userInputSchema"]>
type AgentOutput<K extends PromptKind> = z.infer<SchemasFor[K]["agentOutputSchema"]>
```

#### Runtime schema catalog (cutover)

- `Lemma`: minimal classifier result (`lemma`, `linguisticUnit`, `posLikeKind`, `surfaceKind`, optional `contextWithLinkedParts`), with runtime alias compatibility for legacy keys (`pos` / `phrasemeKind`) normalized to `posLikeKind`.
- `LexemEnrichment`: lightweight non-noun lexical metadata (`word` + `pos` input; output `emojiDescription`, `ipa`, optional `senseGloss`).
- `NounEnrichment`: noun-only metadata (`word` input; output `emojiDescription`, `ipa`, optional `senseGloss`, optional `genus` + `nounClass`).
- `PhrasemEnrichment`: lightweight phrasem metadata (`word` + `kind` input; output `emojiDescription`, `ipa`, optional `senseGloss`).
- `Features*` (10 prompt kinds): POS-specific lexical tag extraction (`tags: string[]`).
- `Disambiguate`: senses payload includes optional `senseGloss` (`3..120` chars) in addition to emoji, IPA, and grammatical hints.
- Existing `Morphem`, `Relation`, `Inflection`, `NounInflection`, `Disambiguate`, `WordTranslation`, `Translate` remain.

`PromptKind.Features` is removed.

#### De linguistics contracts (now wired)

Contracts in `src/linguistics/de/lemma/` are the runtime source for lemma classification and internal enrichment/route shapes.

- `DeLemmaResultSchema` narrows lemma classification to:
  - `linguisticUnit: "Lexem" | "Phrasem"` (Morphem excluded in this phase)
  - `posLikeKind` with compatibility guaranteed by schema branch (`POS` for Lexem, `PhrasemeKind` for Phrasem)
  - required `surfaceKind`
  - optional `contextWithLinkedParts` for multi-span attestation replacement
  - legacy compatibility input aliases: `pos` (Lexem) and `phrasemeKind` (Phrasem), normalized to canonical `posLikeKind`
  - normalized output always includes `contextWithLinkedParts` key (`string | undefined`) after schema transform
- `generate-contracts.ts` defines core v1 prompt contracts:
  - shared target (`DeLexicalTargetSchema`)
  - enrichment (`DeEnrichmentInputSchema` / `DeEnrichmentOutputSchema`, including optional `senseGloss`)
  - relation (`DeRelationInputSchema` / `DeRelationOutputSchema`)
  - inflection (`DeInflectionInputSchema` / `DeInflectionOutputSchema`)
  - features (`DeFeaturesInputSchema` / `DeFeaturesOutputSchema`)
  - word translation (`DeWordTranslationInputSchema` / `DeWordTranslationOutputSchema`)

`src/prompt-smith/schemas/lemma.ts` now uses `DeLemmaResultSchema` directly at runtime.

**v3/v4 bridging in schemas**: Where a common enum uses Zod v4 (e.g., `POSSchema`), schemas re-create it with v3:

```typescript
// schemas/lemma.ts
import { PARTS_OF_SPEECH_STR } from "../../linguistics/common/enums/linguistic-units/lexem/pos";
const POSSchemaV3 = z.enum(PARTS_OF_SPEECH_STR);  // safe: imports the string array, not the v4 schema
```

---

### 3.3 Prompt Parts (manual authoring)

Each prompt kind + language pair has three manually authored components:

| File | Export name | Content |
|---|---|---|
| `agent-role.ts` | `agentRole` | 1-2 sentence persona definition |
| `task-description.ts` | `taskDescription` | Detailed rules, output format, constraints |
| `examples/to-use.ts` | `examples` | Array of `{ input, output }` pairs used in prompt |
| `examples/to-test.ts` | `testExamples` | Optional additional examples for validation |

Example files use `satisfies` for compile-time validation:

```typescript
import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
    { input: { context: "...", surface: "..." }, output: { lemma: "...", ... } },
] satisfies { input: UserInput<"Lemma">; output: AgentOutput<"Lemma"> }[];
```

**Sample agent roles**:
- **Lemma**: "You are a German linguistics expert specializing in lemmatization, word classification, and morphological analysis of German text."
- **Morphem**: "You are a German morphology expert specializing in decomposing words into their constituent morphemes and classifying each morpheme by type."
- **Disambiguate**: "You are a German linguistics expert specializing in lexical semantics and polysemy disambiguation, able to distinguish between different senses of the same word form."

---

### 3.4 Codegen Pipeline

**Entry point**: `codegen/skript/run.ts`

The codegen pipeline runs at build time to compile prompt-parts into deployable system prompts.

```
prompt-parts/ sources
    ↓
1. Format check (enshure-parts-format.ts)
    ↓
2. Presence check (enshure-all-parts-are-present.ts)
    ↓
3. Schema validation (enshure-all-examples-match-schema.ts)
    ↓
4. Assembly (combine-parts.ts)
    ↓
5. File generation → codegen/generated-promts/{target}/{known}/{kind}-prompt.ts
    ↓
6. Index generation → index.ts with PROMPT_FOR dict
    ↓
7. Format (bun fix)
```

**Step 1 — Format validation**: Checks that all prompt-part files have the correct export names (`agentRole`, `taskDescription`, `examples`) and that example files have proper `satisfies` clauses.

**Step 2 — Presence check**: German-English must have all required `PromptKind` parts. Other language pairs are checked for existence but not required.

**Step 3 — Schema validation**: Loads each `to-use.ts` examples array, validates every `input` against `userInputSchema` and every `output` against `agentOutputSchema`. Reports failures by target/known/kind/index/field.

**Step 4 — Assembly**: `combineParts()` loads the three part files, wraps them in XML tags, and joins:

```xml
<agent-role>
You are a German linguistics expert...
</agent-role>

<task-description>
Classify the given German surface form...
</task-description>

<examples>
<example-1>
<input>{"context":"...","surface":"..."}</input>
<output>{"lemma":"...","ipa":"...",...}</output>
</example-1>
...
</examples>
```

**Step 5 — File generation**: Each compiled prompt is written to `codegen/generated-promts/{target}/{known}/{kind}-prompt.ts` as an auto-generated export:

```typescript
// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Run: bun run codegen:prompts
export const systemPrompt = `...`;
```

**Step 6 — Index generation**: Builds the `PROMPT_FOR` dictionary with fallback logic. If a language pair is missing a prompt kind, it falls back to the English-English version.

#### PROMPT_FOR registry

**Source**: `index.ts` (auto-generated)

```typescript
export const PROMPT_FOR = {
    German: {
        English: {
            Lemma: germanToEnglishLemmaPrompt,            // native
            Morphem: germanToEnglishMorphemPrompt,        // native
            // ... all 9 kinds present
        },
        Russian: {
            Translate: germanToRussianTranslatePrompt,    // native
            WordTranslation: germanToRussianWordTranslationPrompt, // native
            Lemma: germanToEnglishLemmaPrompt,            // fallback to English
            Morphem: germanToEnglishMorphemPrompt,        // fallback to English
            // ... remaining 7 kinds fall back to German->English
        },
    },
    English: {
        English: { ... },                                  // all 9 kinds
        Russian: { ... },                                  // all fallback to English->English
    },
} satisfies AvaliablePromptDict;
```

Type: `AvaliablePromptDict = Record<TargetLanguage, Record<KnownLanguage, Record<PromptKind, { systemPrompt: string }>>>`

---

### 3.5 Zod v3/v4 Boundary

**Why prompt-smith uses zod/v3**: The `SchemasFor` schemas are passed to `zodResponseFormat()` (OpenAI SDK) which requires specific Zod APIs. Prompt-smith relies on v3 semantics like `z.record(valueSchema)` (single-arg for value) and `.passthrough()` (not deprecated in v3). All schema files import `{ z } from "zod/v3"`.

**Safe imports from linguistics**:
- `PARTS_OF_SPEECH_STR` — plain `readonly string[]`, no Zod runtime involved
- `LinguisticUnitKindSchema`, `SurfaceKindSchema` — defined with v3 in `core.ts`
- `MorphemeKindSchema`, `GermanMorphemeKindSchema`, `SeparabilitySchema` — defined with v3
- `CaseValueSchema`, `NumberValueSchema` — defined with v3

**Unsafe imports (re-created instead)**:
- `POSSchema` — uses v4 in `pos.ts`, so re-created as `z.enum(PARTS_OF_SPEECH_STR)` in `schemas/lemma.ts`
- `NounClassSchema` — uses v3 in source but re-created locally for safety

**Type assertion at ApiService boundary**: PromptRunner casts v3 schemas to `any` when passing to `ApiService.generate()` which expects v4 types. The runtime shapes are compatible; TypeScript just can't verify cross-version. See section 4.1.

---

## 4. Integration — How It All Connects

### 4.1 PromptRunner

**Source**: `src/commanders/textfresser/llm/prompt-runner.ts` (with prompt lookup extracted to `src/commanders/textfresser/llm/prompt-catalog.ts`)

PromptRunner is the **type-safe facade** that connects the prompt-smith registry to the API client:

```typescript
class PromptRunner {
    constructor(
        private readonly languages: LanguagesConfig,
        private readonly apiService: ApiService,
    ) {}

    generate<K extends PromptKind>(
        kind: K,
        input: UserInput<K>,
    ): ResultAsync<AgentOutput<K>, ApiServiceError>
}
```

**How it works**:

1. Looks up the compiled system prompt: `PROMPT_FOR[languages.target][languages.known][kind]`
2. Looks up the output schema: `SchemasFor[kind].agentOutputSchema`
3. Serializes input: `typeof input === "string" ? input : JSON.stringify(input)`
4. Delegates to ApiService with a v3->v4 cast:

```typescript
return this.apiService.generate({
    schema: schema as any,  // v3 schema cast to v4-compatible any
    systemPrompt: prompt.systemPrompt,
    userInput: serializedInput,
    withCache: true,
}).map((result) => result as AgentOutput<K>);
```

**Instantiation** (in `textfresser.ts`):

```typescript
promptRunner: new PromptRunner(languages, apiService)
```

### 4.2 ApiService

**Source**: `src/stateless-helpers/api-service.ts`

The LLM client wraps Google's Gemini API via the OpenAI SDK compatibility layer.

**Key configuration**:
- **Model**: `gemini-2.5-flash-lite`
- **Temperature**: 0 (deterministic)
- **Top-p**: 0.95
- **Response format**: Structured JSON via `zodResponseFormat(schema, "data")`
- **Fetch adapter**: Custom `fetchViaObsidian()` wraps Obsidian's `requestUrl()` for cross-origin support

**Prompt caching** (Gemini CachedContent API):
- System prompts are cached server-side with 7-day TTL (604,800 seconds)
- Local in-memory cache (`cachedContentIds`) maps system prompt text to Gemini cache ID
- Cache creation has a 3-second timeout — if it fails, proceeds without cache
- When cached, system prompt is omitted from messages; `extra_body.google.cached_content` passes the cache ID

**Retry logic** (`src/stateless-helpers/retry.ts`):
- `withRetry(fn, isRetryable, mapError, config)` wraps any async operation
- Default config: 3 max attempts, 1s base delay, 2x multiplier, +/-20% jitter
- Retryable errors: HTTP 429 (rate limit) and 5xx (server error)
- Non-retryable errors fail immediately
- Returns `ResultAsync<T, E>` (neverthrow pattern)

### 4.3 Data Flow Diagram

```
User selects word in text
    ↓
Lemma cmd → PromptRunner.generate(Lemma, { context, surface })
    ↓  (LLM classifies: unit kind, POS, surface kind, lemma, IPA, emoji)
LemmaResult stored in TextfresserState
    ↓
Generate cmd → getSectionsFor(pos, unit) → applicable DictSectionKind[]
    ↓
For each applicable section, parallel PromptRunner.generate() calls:
    ├─ Morphem:         generate(Morphem, { context, word })         → morphemes[] + derived_from? + compounded_from?
    ├─ Relation:        generate(Relation, { context, pos, word })   → relations[]
    ├─ NounInflection:  generate(NounInflection, { context, word })  → cells[]
    ├─ Inflection:      generate(Inflection, { context, pos, word }) → rows[]
    └─ WordTranslation: generate(WordTranslation, { context, word }) → string
    ↓
Section formatters consume typed outputs + German display constants:
    ├─ de/lexem/noun/inflection-formatter uses NounInflectionCell, CASE_ORDER, CASE_SHORT_LABEL
    ├─ inflection-formatter uses rows[].label + rows[].forms
    ├─ relation-formatter uses RelationSubKind → wikilinks
    └─ dispatchHeaderFormatter routes by POS (noun → genus article, rest → common)
    ↓
serializeEntry() → markdown string
    ↓
VAM dispatch (ProcessMdFile / UpsertMdFile)
    ↓
Propagation steps:
    ├─ propagateGeneratedSections (facade switch by `propagationV2Enabled`)
    ├─ v1 branch: propagateRelations → propagateMorphologyRelations → propagateMorphemes → decorateAttestationSeparability → propagateInflections
    └─ v2 branch: propagateV2 (strict fail-fast, all-or-nothing action emission)
```

### 4.4 Adding a New Prompt (recipe)

To add a new `PromptKind` (e.g., `"Etymology"`):

1. **Add kind to registry**: In `codegen/consts.ts`, add `"Etymology"` to `supportedPromptKinds`
2. **Create schema**: New file `schemas/etymology.ts` with `userInputSchema` + `agentOutputSchema` (import from `zod/v3`)
3. **Register schema**: In `schemas/index.ts`, add `[PromptKind.Etymology]: etymologySchemas`
4. **Author prompt parts**: Create `prompt-parts/german/english/etymology/` with:
   - `agent-role.ts` (export `agentRole: string`)
   - `task-description.ts` (export `taskDescription: string`)
   - `examples/to-use.ts` (export `examples` array with `satisfies` clause)
5. **Run codegen**: `bun run codegen:prompts` — validates, compiles, generates index
6. **Integrate into pipeline**: In `generate-sections.ts`, add a `promptRunner.generate(PromptKind.Etymology, ...)` call and a corresponding section formatter

---

## 5. Deprecated / Migration

### old-enums.ts — DELETED

`src/linguistics/old-enums.ts` has been deleted. It contained legacy enum definitions (discourse formula roles, collocation types, stylistic tones, scalar degrees, theta roles, noun classes, verb moods, comparison degrees) that were never imported by active code. The only consumers were files in `src/types/old/`, which were also deleted as dead code.

Relevant enums that are actually used live in the structured `common/enums/` and `de/` modules.
