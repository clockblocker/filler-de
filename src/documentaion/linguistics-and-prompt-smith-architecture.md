# Linguistics & Prompt-Smith — Architecture

> **Scope**: This document covers the **linguistics type system** (`src/linguistics/`) and the **prompt management layer** (`src/prompt-smith/`). These two modules form the foundational layer that both the Lemma and Generate commands depend on. For the command pipeline itself, see `textfresser-architecture.md`. For FS dispatch, see `vam-architecture.md`.

---

## 1. Purpose

### Why a linguistics type system?

Every word the user encounters flows through a pipeline that starts with LLM classification and ends with a markdown dictionary entry in the vault. The linguistics module provides a **Zod-schema-based type system** that serves as the single source of truth for:

- **LLM output validation** — agent responses are parsed against Zod schemas that reference linguistics enums
- **Section formatters** — formatters consume typed DTOs (e.g., `NounInflectionCell`) rather than raw JSON
- **Domain model** — `GermanLinguisticUnit` captures the full grammatical identity of every encountered word
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
MorphemeKind = "Root" | "Prefix" | "Suffix" | "Suffixoid" | "Infix"
             | "Circumfix" | "Interfix" | "Transfix" | "Clitic"
             | "ToneMarking" | "Duplifix"
```

**Source**: `common/enums/linguistic-units/morphem/morpheme-tag.ts`

```typescript
MorphemeTag = "Separable" | "Inseparable"
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
| `common/enums/linguistic-units/morphem/morpheme-tag.ts` | `MorphemeTagSchema` |
| `common/enums/linguistic-units/phrasem/phrasem-kind.ts` | `PhrasemeKindSchema` |
| `common/enums/inflection/feature-values.ts` | `CaseValueSchema`, `NumberValueSchema` |

---

### 2.2 German-specific (de/)

**Location**: `src/linguistics/de/`

The German-specific layer derives from common enums, adding features only where a POS or morpheme kind has language-specific properties.

#### Stub pattern

Most POS values are stubs — they carry only the `pos` discriminant with no extra features:

```typescript
// de/lexem/de-pos.ts
type GermanPosStub = Exclude<POS, "Noun">;
// = "Pronoun" | "Article" | "Adjective" | "Verb" | ...

// Each stub schema is just: z.object({ pos: z.literal("Verb") })
```

Only `Noun` has specialized features. The same pattern applies to morpheme kinds — only `Prefix` has specialized features (separability); the rest are stubs.

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

`de/lexem/verb/features.ts` and `de/morphem/root/features.ts` are empty placeholders with TODO comments.

#### Top-level German DTO

**Source**: `de/index.ts`

```typescript
GermanLinguisticUnitSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("Lexem"),   surface: GermanLexemSurfaceSchema }),
    z.object({ kind: z.literal("Phrasem"), surface: PhrasemSurfaceSchema }),
    z.object({ kind: z.literal("Morphem"), surface: GermanMorphemSurfaceSchema }),
])
```

Type: `GermanLinguisticUnit` — the complete grammatical identity of any German word/phrase/morpheme.

#### Key files — German

| File | Exports |
|---|---|
| `de/index.ts` | `GermanLinguisticUnitSchema`, `GermanLinguisticUnit` |
| `de/lexem/index.ts` | `GermanLexemSurfaceSchema`, `GermanLexemSurface` |
| `de/lexem/de-pos.ts` | `GERMAN_POS_STUBS` |
| `de/lexem/noun/features.ts` | `GermanGenusSchema`, `NounClassSchema`, `articleFromGenus`, `NounInflectionCell`, display constants |
| `de/lexem/noun/index.ts` | `GermanNounSurfaceSchema`, `GermanNounLemma`, `GermanNounInflection` |
| `de/morphem/index.ts` | `GermanMorphemSurfaceSchema`, `GermanMorphemSurface` |
| `de/morphem/de-morphem-kind.ts` | `GERMAN_MORPHEM_KIND_STUBS` |
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
CollocationStrength = "Weak" | "Medium" | "Strong"

// Phrasem full features: discriminated by phrasemeKind
//   Collocation adds optional `strength: CollocationStrength`
//   All others: just the discriminant

PhrasemSurfaceSchema = makeSurfaceSchema(PhrasemFullFeaturesSchema, PhrasemRefFeaturesSchema)
```

---

### 2.4 Dict Entry ID System

**Source**: `common/dict-entry-id/`

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

**Source**: `common/dict-entry-id/tags.ts`

```typescript
LinguisticUnitKindTag = "LX" | "PH" | "MO"
SurfaceKindTag        = "LM" | "IN" | "VA"
```

Bidirectional maps:
- `linguisticUnitKindTagFrom` / `linguisticUnitKindFrom` (Lexem <-> LX, Phrasem <-> PH, Morphem <-> MO)
- `surfaceKindTagFrom` / `surfaceKindFrom` (Lemma <-> LM, Inflected <-> IN, Variant <-> VA)

**Note**: Tag schemas use Zod v4 (`import z from "zod"`) because they participate in VAM type composition.

#### Parsed ID types

**Source**: `common/dict-entry-id/dict-entry-id.ts`

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

**Source**: `common/sections/`

#### DictSectionKind

**Source**: `common/sections/section-kind.ts`

```typescript
DictSectionKind = "Relation" | "FreeForm" | "Attestation" | "Morphem"
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
| Inflection | Inflection | Flexion |
| Deviation | Deviations | Abweichungen |
| FreeForm | Notes | Notizen |
| Tags | Tags | Tags |

#### CSS suffixes

**Source**: `common/sections/section-css-kind.ts`

Maps each `DictSectionKind` to a CSS class suffix used in `entry_section_title_{suffix}`:

```
Header -> "formen", Attestation -> "kontexte", FreeForm -> "notizen",
Relation -> "synonyme", Morphem -> "morpheme", Deviation -> "abweichungen",
Inflection -> "flexion", Translation -> "translations", Tags -> "tags"
```

#### Section selection

**Source**: `common/sections/section-config.ts`

**CORE_SECTIONS** (always included):

```typescript
[Header, Tags, Translation, Attestation, FreeForm]
```

**Per-POS sections** (`sectionsForLexemPos`):

| POS | Sections |
|---|---|
| Noun | CORE + Relation, Morphem, Inflection |
| Verb | CORE + Relation, Morphem, Inflection, Deviation |
| Adjective | CORE + Relation, Inflection |
| Adverb | CORE + Relation |
| Article | CORE + Inflection |
| Pronoun | CORE + Inflection |
| Preposition | CORE + Relation |
| Particle | CORE + Relation |
| Conjunction | CORE only |
| InteractionalUnit | CORE only |

**Special-case sections**:
- `sectionsForProperNoun` = CORE only (no Inflection, Morphem, Relation)
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
| Morphem | 5 |
| Inflection | 6 |
| Deviation | 7 |
| FreeForm | 8 |

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
│   └── features.ts
├── prompt-parts/                     # Human-authored prompt sources
│   ├── german/
│   │   ├── english/                  # German->English: all 9 prompt kinds
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
│       └── english/                  # English->English: all 9 kinds (fallback)
└── codegen/
    ├── consts.ts                     # PromptKind enum, PromptPartKind enum
    ├── generated-promts/             # Auto-generated compiled prompts
    │   ├── german/english/           # 9 *-prompt.ts files
    │   ├── german/russian/           # 2 *-prompt.ts files
    │   └── english/english/          # 9 *-prompt.ts files (fallback)
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

The `SchemasFor` registry maps every `PromptKind` to its input/output schemas:

```typescript
export const SchemasFor = {
    [PromptKind.Lemma]:           lemmaSchemas,
    [PromptKind.Morphem]:         morphemSchemas,
    [PromptKind.Relation]:        relationSchemas,
    [PromptKind.Translate]:       translateSchemas,
    [PromptKind.Inflection]:      inflectionSchemas,
    [PromptKind.NounInflection]:  nounInflectionSchemas,
    [PromptKind.Disambiguate]:    disambiguateSchemas,
    [PromptKind.WordTranslation]: wordTranslationSchemas,
    [PromptKind.Features]: featuresSchemas,
} satisfies Record<PromptKind, { userInputSchema: z.ZodTypeAny; agentOutputSchema: z.ZodTypeAny }>;
```

Type helpers extract inferred types per kind:

```typescript
type UserInput<K extends PromptKind>  = z.infer<SchemasFor[K]["userInputSchema"]>
type AgentOutput<K extends PromptKind> = z.infer<SchemasFor[K]["agentOutputSchema"]>
```

#### PromptKind enum

**Source**: `codegen/consts.ts`

```typescript
PromptKind = "Lemma" | "Morphem" | "Relation" | "Translate"
           | "Inflection" | "NounInflection" | "Disambiguate" | "WordTranslation" | "Features"
```

#### Schema catalog

| PromptKind | userInputSchema | agentOutputSchema | Linguistics enums used |
|---|---|---|---|
| **Lemma** | `{ context, surface }` | `{ lemma, ipa, linguisticUnit, surfaceKind, pos?, nounClass?, genus?, fullSurface?, emojiDescription }` | `LinguisticUnitKindSchema`, `SurfaceKindSchema`, `PARTS_OF_SPEECH_STR` (as v3 re-creation), `NounClass` (v3), `GermanGenus` (v3) |
| **Morphem** | `{ context, word }` | `{ morphemes: [{ kind, surf, lemma?, tags? }] }` | `MorphemeKindSchema`, `MorphemeTagSchema` |
| **Relation** | `{ context, pos, word }` | `{ relations: [{ kind, words[] }] }` | Own `RelationSubKindSchema` (Synonym, NearSynonym, Antonym, Hypernym, Hyponym, Meronym, Holonym) |
| **Translate** | `string` | `string` | None |
| **Inflection** | `{ context, pos, word }` | `{ rows: [{ label, forms }] }` | None (label/forms are free-form strings) |
| **NounInflection** | `{ context, word }` | `{ cells: [{ case, number, article, form }] }` | `CaseValueSchema`, `NumberValueSchema` |
| **Disambiguate** | `{ context, lemma, senses: [{ index, emojiDescription, unitKind, pos?, genus? }] }` | `{ matchedIndex: number | null, emojiDescription? }` | None (senses use plain strings) |
| **WordTranslation** | `{ context, pos, word }` | `string` | None |
| **Features** | `{ context, pos, word }` | `{ tags: string[] }` (1-5 short lowercase tag components) | None |

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

**Step 2 — Presence check**: German-English must have all 9 kinds. Other language pairs are checked for existence but not required.

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
- `MorphemeKindSchema`, `MorphemeTagSchema` — defined with v3
- `CaseValueSchema`, `NumberValueSchema` — defined with v3

**Unsafe imports (re-created instead)**:
- `POSSchema` — uses v4 in `pos.ts`, so re-created as `z.enum(PARTS_OF_SPEECH_STR)` in `schemas/lemma.ts`
- `NounClassSchema` — uses v3 in source but re-created locally for safety

**Type assertion at ApiService boundary**: PromptRunner casts v3 schemas to `any` when passing to `ApiService.generate()` which expects v4 types. The runtime shapes are compatible; TypeScript just can't verify cross-version. See section 4.1.

---

## 4. Integration — How It All Connects

### 4.1 PromptRunner

**Source**: `src/commanders/textfresser/prompt-runner.ts`

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
    ├─ Morphem:         generate(Morphem, { context, word })         → morphemes[]
    ├─ Relation:        generate(Relation, { context, pos, word })   → relations[]
    ├─ NounInflection:  generate(NounInflection, { context, word })  → cells[]
    ├─ Inflection:      generate(Inflection, { context, pos, word }) → rows[]
    └─ WordTranslation: generate(WordTranslation, { context, word }) → string
    ↓
Section formatters consume typed outputs + German display constants:
    ├─ noun-inflection-formatter uses NounInflectionCell, CASE_ORDER, articleFromGenus
    ├─ inflection-formatter uses rows[].label + rows[].forms
    ├─ relation-formatter uses RelationSubKind → wikilinks
    └─ header-formatter uses emojiDescription, IPA from LemmaResult
    ↓
serializeEntry() → markdown string
    ↓
VAM dispatch (ProcessMdFile / UpsertMdFile)
    ↓
Propagation steps:
    ├─ propagateRelations → ProcessMdFile on target notes (cross-refs)
    └─ propagateInflections → UpsertMdFile for inflected-form stub notes
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

### old-enums.ts

**Source**: `src/linguistics/old-enums.ts`

This file contains legacy enum definitions from before the linguistics module was restructured. It includes detailed enums that the current system either doesn't use or has simplified:

| Legacy enum | Status |
|---|---|
| Discourse formula roles (Greeting, Farewell, Apology, ...) | Not used in current pipeline |
| Collocation types (ADJ+NOUN, VERB+NOUN, ...) | Simplified to `CollocationStrength` in `phrasem-surface.ts` |
| Stylistic tone (Neutral, Casual, Formal, Vulgar, ...) | Not used |
| Scalar degree (Negligible, Minimal, Weak, ..., Maximal) | Not used |
| Theta roles (Agent, Cause, Experiencer, ...) | Not used |
| Noun classes (Common, Mass, Proper, Collective) | Simplified to `NounClass = "Common" | "Proper"` |
| Verb mood (Indicative, Subjunctive-I, Subjunctive-II, Imperative) | Not used in current schemas |
| Comparison degrees (Positive, Comparative, Superlative) | Not used in current schemas |

**Migration path**: As new POS features are implemented (verb conjugation, adjective declension), relevant enums will be promoted from `old-enums.ts` into the proper `common/enums/` or `de/` structure. The old file will shrink over time and eventually be deleted.

**Do not import from `old-enums.ts` in new code** — use the structured `common/` and `de/` modules instead.
