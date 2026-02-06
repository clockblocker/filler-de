# Textfresser Vocabulary System — Architecture

> **Scope**: This document covers the vocabulary/dictionary half of the plugin (the "Textfresser" commander). For the tree/healing/codex half, see the Librarian docs. For E2E testing, see `e2e-architecture.md`.

---

## 1. Vision

Textfresser builds a **personal, encounter-driven dictionary** for language learners.

**Core premise**: A dictionary that only contains words the user has actually encountered, in contexts they've actually read, is more useful than a generic one.

The flow (two commands: **Lemma** → **Generate**):

```
User dumps a book/script into the vault
  ↓
Plugin splits text into sections, adds block IDs to reference concrete sentences
  ↓
User reads a sentence, finds an unknown word
  ↓
User selects it, calls "Lemma"
  ↓
Lemma (recon):
  LLM classifies: LinguisticUnitKind + POS + lemma form
  Finds/creates the dictionary note
  Checks existing entries → do we already have this semantic/grammatical instance?
  ↓
User calls "Generate"
  ↓
Generate (heavy lifting):
  Existing entry? → just append the new context ref to its Attestation section
  New entry? → launch an LLM request PER section (Relations, Inflection, Morphemes, ...)
  Collect all FS operations (Note updates + cross-reference propagation)
  Single vam.dispatch()
  ↓
User gets a tailor-made dictionary that grows with their reading
```

**Properties of the resulting dictionary:**

1. **Encounter-driven** — contains only words the user has actually met
2. **Context-rich** — each meaning is tied to the sentence where it was found
3. **Self-linking** — newly encountered words are bound to ones already known (via semantic relations)
4. **User-owned** — plain markdown files in the user's vault
5. **Scalable** — grows in both depth (more meanings per word) and breadth (more words)

**Language-agnostic design**: The system is designed as `any_lang → any_other_lang`. Language-specific knowledge lives in prompts and section configs. The core logic (merging DictEntries, propagating references, updating DictEntrySections) is language-independent.

---

## 2. Domain Model

The data hierarchy, from coarsest to finest:

```
Note (Obsidian .md file, named after a Surface)
 └─ DictEntry (one semantic/grammatical meaning of the Surface)
     └─ DictEntrySection (structured category of info about that meaning)
         └─ DictEntrySubSection (specific item within a section)
```

| Concept | What it is | Example |
|---------|-----------|---------|
| **Note** | An Obsidian markdown file. Named after a Surface. Stores all DictEntries for that Surface. | `Rain.md` |
| **DictEntry** | One distinct semantic or grammatical instance of the Surface. A Note can have multiple. | Entry for "rain" (noun) vs entry for "to rain" (verb) in `Rain.md` |
| **DictEntrySection** | A structured block within a DictEntry, categorized by `DictSectionKind`. | Translation, Lexical Relations, Inflection, Morphemes |
| **DictEntrySubSection** | A specific item within a DictEntrySection. Defined by the section kind. | Within Lexical Relations: Synonym, Antonym, Meronym, Holonym |

**Note ≠ DictEntry**: A single Note can hold multiple DictEntries when a Surface has multiple meanings (polysemy) or multiple grammatical roles (e.g., noun vs verb).

**DictEntrySection ≠ DictEntrySubSection**: A DictEntrySection like "Lexical Relations" contains multiple DictEntrySubSections (Synonym, Meronym, Holonym, etc.). Not all sections have subsections — e.g., Translation is flat.

---

## 3. Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│  Managers (Event capture, UI, FS abstraction)           │
│  ├─ UserEventInterceptor  — DOM/editor events           │
│  ├─ OverlayManager        — toolbars, context menu      │
│  ├─ ActionsManager        — command executor factory    │
│  └─ VaultActionManager    — FS dispatch pipeline        │
├─────────────────────────────────────────────────────────┤
│  Commanders (Business logic)                            │
│  ├─ Librarian   — tree, healing, codex                  │
│  └─ Textfresser — vocabulary commands                   │
├─────────────────────────────────────────────────────────┤
│  Stateless Helpers (Pure functions)                     │
│  ├─ dict-note        — parse/serialize dictionary notes │
│  ├─ note-metadata    — format-agnostic YAML/JSON meta   │
│  ├─ block-id         — ^blockId extraction/injection    │
│  ├─ wikilink         — [[wikilink]] parsing             │
│  └─ api-service      — Gemini API wrapper               │
├─────────────────────────────────────────────────────────┤
│  Prompt-Smith (LLM prompt management)                   │
│  ├─ prompt-parts/    — human-written prompt sources     │
│  ├─ codegen/         — build-time assembly + validation │
│  ├─ schemas/         — Zod I/O schemas per PromptKind   │
│  └─ generated-promts/ — compiled system prompts         │
├─────────────────────────────────────────────────────────┤
│  Linguistics (Type system)                              │
│  ├─ enums/core.ts           — LinguisticUnitKind, SurfaceKind │
│  ├─ enums/.../pos.ts        — POS, PosTag               │
│  ├─ enums/.../phrasem-kind  — PhrasemeKind              │
│  ├─ enums/.../morpheme-kind — MorphemeKind              │
│  ├─ sections/section-kind   — DictSectionKind           │
│  └─ old-enums.ts            — detailed inflectional enums │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Linguistic Type System

**Location**: `src/linguistics/`

### 4.1 Linguistic Units

Every word/phrase the user encounters is classified into one of three **linguistic unit kinds**:

```
LinguisticUnitKind = "Phrasem" | "Lexem" | "Morphem"
```

| Unit | What it is | Example |
|------|-----------|---------|
| **Lexem** | Single word (lemma form) | *Kohlekraftwerk*, *laufen*, *schnell* |
| **Phrasem** | Multi-word expression | *ins Gras beißen* (idiom), *starker Kaffee* (collocation) |
| **Morphem** | Sub-word unit | *-keit* (suffix), *un-* (prefix) |

**Source**: `src/linguistics/enums/core.ts`

### 4.2 Surface Kinds

How a surface form relates to its lemma:

```
SurfaceKind = "Lemma" | "Inflected" | "Variant"
```

- **Lemma**: canonical/dictionary form (*laufen*)
- **Inflected**: grammatically changed form (*lief*, *gelaufen*)
- **Variant**: spelling/regional variant (*Email* vs *E-Mail*)

### 4.3 Parts of Speech (Lexems only)

```
POS = "Noun" | "Pronoun" | "Article" | "Adjective" | "Verb"
    | "Preposition" | "Adverb" | "Particle" | "Conjunction"
    | "InteractionalUnit"
```

Each POS has a compact **PosTag** (`NOUN`, `PRON`, `ART`, `ADJ`, `VERB`, `PREP`, `ADV`, `PART`, `KON`, `IU`) with bidirectional maps.

**Source**: `src/linguistics/enums/linguistic-units/lexem/pos.ts`

### 4.4 Phraseme Kinds

```
PhrasemeKind = "Idiom" | "Collocation" | "DiscourseFormula" | "Proverb" | "CulturalQuotation"
```

Each kind has further sub-classifications (e.g., collocation strength: `Free | Bound | Frozen`, collocation type: `ADJ+NOUN`, `VERB+NOUN`, etc.).

**Source**: `src/linguistics/enums/linguistic-units/phrasem/phrasem-kind.ts`, `src/linguistics/old-enums.ts`

### 4.5 DictEntrySection Kinds

Each DictEntry is divided into **DictEntrySections**, categorized by `DictSectionKind`:

```
DictSectionKind = "Relation" | "FreeForm" | "Attestation" | "Morphem"
               | "Header" | "Deviation" | "Inflection"
```

| Kind | German title | Purpose | Has SubSections? |
|------|-------------|---------|-----------------|
| `Header` | Formen | Lemma display, pronunciation, article | No |
| `Attestation` | Kontexte | User's encountered contexts (`![[File#^blockId\|^]]`) | No |
| `Relation` | Semantische Beziehungen | Lexical relations | **Yes** (see below) |
| `Morphem` | Morpheme | Word decomposition (`[[Kohle]]\|[[kraft]]\|[[werk]]`) | No |
| `Inflection` | Flexion | Declension/conjugation tables | No |
| `Deviation` | Abweichungen | Irregular forms, exceptions | No |
| `FreeForm` | Notizen | Catch-all for unstructured content (see below) | No |

Section titles are localized per `TargetLanguage` via `TitleReprFor`.

**FreeForm — the catch-all section**: Any content in a DictEntry that doesn't match our structured format (i.e., doesn't belong to a recognized DictEntrySection) gets collected into the FreeForm section. This keeps the structured sections clean while preserving user-written or unrecognized content. **Auto-cleanup** happens on Note open/close — the system scans the DictEntry, moves stray content into FreeForm, and re-serializes.

**Source**: `src/linguistics/sections/section-kind.ts`

### 4.6 DictEntrySubSections

Some DictEntrySections contain **DictEntrySubSections** — finer-grained items within the section. The Relation section is the primary example:

| SubSection | Notation | Example |
|------------|----------|---------|
| Synonym | `=` | `= [[Kraftwerk]], [[Stromerzeugungsanlage]]` |
| Near-synonym | `≈` | `≈ [[Industrieanlage]], [[Fabrik]]` |
| Antonym | `≠` | `≠ [[Windrad]], [[Solaranlage]]` |
| Hypernym | `⊃` | `⊃ [[Anlage]]` |
| Hyponym | `⊂` | `⊂ [[Braunkohlekraftwerk]]` |
| Meronym | `∈` | `∈ [[Turbine]], [[Kessel]]` |
| Holonym | `∋` | `∋ [[Energieversorgung]]` |

DictEntrySubSections are the unit at which cross-reference propagation operates (see section 9).

### 4.7 Detailed Inflectional Enums

`src/linguistics/old-enums.ts` defines a rich set of grammatical categories for German (extensible to other languages):

- **Person**: 1st, 2nd, 3rd
- **Number**: Singular, Plural, Dual
- **Case**: Nominative, Accusative, Dative, Genitive
- **Tense**: Present, Preterite, Perfect, Pluperfect, Future I, Future II
- **Verb Mood**: Indicative, Subjunctive I, Subjunctive II, Imperative
- **Noun Class**: Common, Mass, Proper, Collective
- **Comparison Degree**: Positive, Comparative, Superlative
- **Theta Roles**: Agent, Cause, Experiencer, Location, Goal, Beneficiary, etc.
- **Stylistic Tone**: Neutral, Casual, Colloquial, Formal, Vulgar, Poetic, etc.
- **Scalar Degree**: 11-point scale from Negligible (-5) to Maximal (+5)

---

## 5. Note & DictEntry Format

**Location**: `src/stateless-helpers/dict-note/`

A Note is an Obsidian markdown file named after a Surface. It contains one or more **DictEntries** — each representing a distinct semantic/grammatical meaning of that Surface.

### 5.1 DictEntry Structure

```markdown
🏭 das [[Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k ♫](https://youglish.com/pronounce/Kohlekraftwerk/german) ^l-nom-n-m1

<span class="entry_section_title entry_section_title_kontexte">Deine Kontexte</span>
![[Atom#^13|^]]
![[Atom#^14|^]]
<span class="entry_section_title entry_section_title_synonyme">Semantische Beziehungen</span>
= [[Kraftwerk]], [[Stromerzeugungsanlage]]
≈ [[Industrieanlage]], [[Fabrik]]
≠ [[Windrad]], [[Solaranlage]]
<span class="entry_section_title entry_section_title_morpheme">Morpheme</span>
 [[Kohle]]|[[kraft]]|[[werk]]
<span class="entry_section_title entry_section_title_translations">Übersetzung</span>
coal-fired power plant
<span class="entry_section_title entry_section_title_flexion">Flexion</span>
N: das [[Kohlekraftwerk]], die [[Kohlekraftwerke]]
A: das [[Kohlekraftwerk]], die [[Kohlekraftwerke]]
G: des [[Kohlekraftwerkes]], der [[Kohlekraftwerke]]
D: dem [[Kohlekraftwerk]], den [[Kohlekraftwerken]]
```

**Key elements:**
- **Header line**: emoji + article + `[[Surface]]` + pronunciation link + ` ^blockId`
- **DictEntryId format** (validated by `DictEntryIdSchema`): `^{LinguisticUnitKindTag}-{SurfaceKindTag}(-{PosTag}-{index})` — the PosTag+index suffix is Lexem-only. E.g., `^lx-lm-nom-1` (Lexem, Lemma surface, Noun, 1st meaning). Final format TBD.
- **DictEntrySections**: marked with `<span class="entry_section_title entry_section_title_{kind}">Title</span>`
- **Multiple DictEntries** (different meanings of the same Surface) separated by `\n---\n---\n---\n`

### 5.2 Parsed Representation

```typescript
type DictEntry = {
  id: string;                       // "l-nom-n-m1"
  headerContent: string;            // header line without ^blockId
  sections: DictEntrySection[];     // (code type: EntrySection)
  meta: Record<string, unknown>;    // from hidden <section> at note bottom
};

type DictEntrySection = {           // (code type: EntrySection)
  kind: string;    // CSS suffix: "kontexte", "synonyme", "morpheme", etc.
  title: string;   // Display text: "Deine Kontexte", "Semantische Beziehungen"
  content: string; // Section body (trimmed). May contain DictEntrySubSections as lines.
};
```

> **Code vs Domain naming**: In code, the type is `EntrySection` (for brevity). In this doc, we use `DictEntrySection` for clarity. Same object.

### 5.3 Metadata

Per-DictEntry metadata is stored in a hidden `<section>` at the bottom of the Note:

```html
<section id="textfresser_meta_keep_me_invisible">
{"entries":{"l-nom-n-m1":{"status":"Done"},"l-nom-n-w2":{"status":"NotStarted"}}}
</section>
```

### 5.4 Parse / Serialize

`dictNoteHelper` provides round-trip-stable parse and serialize:

```typescript
import { dictNoteHelper } from "src/stateless-helpers/dict-note";

const entries = dictNoteHelper.parse(noteText);      // string → DictEntry[]
const { body, meta } = dictNoteHelper.serialize(entries); // DictEntry[] → { body, meta }
```

**Source**: `src/stateless-helpers/dict-note/internal/parse.ts`, `serialize.ts`

---

## 6. Attestation — Capturing Context

**Location**: `src/commanders/textfresser/common/attestation/`

When a user clicks a `[[wikilink]]` in a text they're reading, the system captures the **attestation** — the context in which the word appeared:

```typescript
type Attestation = {
  source: {
    ref: string;                    // "![[Atom#^13|^]]" — embed reference
    textRaw: string;                // raw paragraph content
    textWithOnlyTargetMarked: string; // stripped, only [target] marked
    path: SplitPathToMdFile;        // path to the source file
  };
  target: {
    surface: string;  // the clicked word as it appears in text
    lemma?: string;   // if wikilink is [[lemma|surface]], the lemma
  };
};
```

This attestation is stored in `TextfresserState.attestationForLatestNavigated` and consumed by subsequent commands (Generate, Lemma).

**Flow**:
```
User clicks [[Kohlekraftwerk]] in a text paragraph
  ↓
UserEventInterceptor fires WikilinkClickPayload
  ↓
Textfresser.createHandler() processes it
  ↓
buildAttestationFromWikilinkClickPayload() extracts:
  - source.ref = "![[Atom#^13|^]]"
  - source.textRaw = "Das Kohlekraftwerk erzeugt Strom aus Kohle."
  - target.surface = "Kohlekraftwerk"
  ↓
Stored in state, ready for the next command
```

---

## 7. Commands

### 7.1 Command Architecture

```typescript
// Every command is a pure function: input → ResultAsync<VaultAction[], CommandError>
type CommandFn = (input: CommandInput) => ResultAsync<VaultAction[], CommandError>;

type CommandInput = {
  resultingActions: VaultAction[];
  commandContext: CommandContext & { activeFile: NonNullable<...> };
  textfresserState: TextfresserState;
};
```

Commands return `VaultAction[]` which the Textfresser commander dispatches via VAM:

```
commandFn(input) → VaultAction[] → vam.dispatch(actions)
```

**Available commands**:

| Command | Status | Purpose |
|---------|--------|---------|
| `Lemma` | Stub (planned) | Recon: classify word, find/create note, resolve meaning |
| `Generate` | Partially implemented | Heavy lifting: fill DictEntrySections via LLM, propagate cross-references, dispatch FS ops |
| `TranslateSelection` | Implemented | Translate selected text via LLM |

**Source**: `src/commanders/textfresser/textfresser.ts`, `src/commanders/textfresser/commands/types.ts`

### 7.2 Translate Command (implemented)

Translates selected text using the prompt-smith system:

1. Extract selected text from editor
2. Strip block IDs and replace wikilinks
3. Call `promptRunner.generate(PromptKind.Translate, text)`
4. Insert translation alongside original

**Source**: `src/commanders/textfresser/commands/translate/translate-command.ts`

---

## 8. The Dictionary Pipeline — Lemma + Generate

> **Status**: Planned. Lemma is a stub; Generate is partially implemented (currently handles note move + meta, not yet the per-section LLM flow).

The dictionary pipeline is split into two user-facing commands with distinct responsibilities:

```
         Lemma (recon)                          Generate (heavy lifting)
┌─────────────────────────────┐    ┌──────────────────────────────────────────┐
│ 1. LLM classification       │    │ Existing entry?                          │
│    → LinguisticUnit + POS   │    │   → just append context ref              │
│ 2. Note lookup / creation   │    │                                          │
│ 3. Meaning resolution       │    │ New entry?                               │
│    → existing or new entry? │───→│   → LLM request PER section              │
│                             │    │   → build full DictEntry                 │
│ Light, fast, single LLM call│    │                                          │
└─────────────────────────────┘    │ Cross-reference propagation              │
                                   │ Collect all ProcessMdFile actions        │
                                   │ Single vam.dispatch()                    │
                                   └──────────────────────────────────────────┘
```

### 8.1 Lemma Command (Recon)

The user selects a word and calls "Lemma". This is the lightweight classification step.

#### Step 1 — LLM Classification

**Input**: selected text + surrounding sentence context (from attestation).

**Expected structured output** (via Zod schema):
```typescript
{
  linguisticUnit: "Lexem" | "Phrasem" | "Morphem",
  pos?: POS,                    // only for Lexem
  phrasemeKind?: PhrasemeKind,   // only for Phrasem
  lemma: string,                // dictionary form
  surfaces: Surface[],          // inflected forms referenced
}
```

This narrows the type: `LinguisticUnitKind` → `POS` (for lexems) → determines which sections and prompts apply for Generate.

#### Step 2 — Note Lookup

The lemma maps to a note path in the dictionary folder. If the note exists, parse it with `dictNoteHelper.parse()` to get existing entries.

#### Step 3 — Meaning Resolution

**Problem**: "коса" can mean (1) a braid, (2) a scythe, (3) a spit of land. Each meaning is a separate entry in the same note.

The system needs to:
1. Get existing entries from the note
2. Bundle them with the new context
3. Query the LLM: "Given these existing meanings and this new context, is this a known meaning or a new one?"

**Expected structured output**:
```typescript
{
  isNewMeaning: boolean,
  matchedEntryId?: string,     // if existing meaning
}
```

Lemma pushes this result into `TextfresserState.recentLemmaResults` (ring buffer, last 5–10). Generate consumes the most recent entry.

### 8.2 Generate Command (Heavy Lifting)

The user calls "Generate" after Lemma. Generate takes the classification from Lemma and does the actual work.

#### Path A — Existing Entry

If Lemma resolved to an existing entry (`isNewMeaning = false`):
- Find the entry by `matchedEntryId`
- Append the new attestation ref (`![[File#^blockId|^]]`) to its `Attestation` section
- Serialize → `ProcessMdFile` action

This is fast — no LLM calls needed.

#### Path B — New Entry

If Lemma found no matching entry (`isNewMeaning = true`):
1. **LLM request PER section** — for each applicable `DictSectionKind` (determined by the unit + POS from Lemma), send a separate structured prompt:
   - Relation DictEntrySection prompt → fills SubSections (synonyms, antonyms, hypernyms, etc.)
   - Inflection DictEntrySection prompt → declension/conjugation table
   - Morphem DictEntrySection prompt → word decomposition
   - Header DictEntrySection prompt → pronunciation, article, emoji
   - etc.
2. **Build full `DictEntry`** — assemble all section results into a new entry with a fresh block ID
3. **Append to note** — add entry with `ENTRY_SEPARATOR`

#### After both paths — Cross-Reference Propagation

For every reference surfaced in the LLM output (DictEntrySubSections like synonyms, meronyms, etc.):
- Apply propagation rules to update the referenced Notes' DictEntries (see section 9)
- Each propagation produces a `ProcessMdFile` action on the target Note

#### Dispatch

All `ProcessMdFile` actions (source Note update + all cross-reference propagated updates) are collected into a **single `vam.dispatch()` call**. This ensures atomicity and prevents event feedback loops (via self-event tracking).

### 8.3 Prompt Configuration Matrix

Different prompts are needed depending on:

| Dimension | Values | Effect |
|-----------|--------|--------|
| **TargetLanguage** | German, English, ... | Language of the dictionary |
| **KnownLanguage** | Russian, English, ... | User's native language |
| **DictSectionKind** | Relation, Inflection, ... | What section we're filling |
| **LinguisticUnitKind** | Lexem, Phrasem, Morphem | What kind of thing |
| **POS** | Noun, Verb, Adj, ... | Part of speech (for lexems) |

Prompts know about specifics. The system thinks in generics.

### 8.4 Generate — Current Implementation

The current Generate command handles a simpler pipeline (pre-dating the Lemma split):

Pipeline: `checkAttestation → checkEligibility → applyMeta → moveToWorter → addWriteAction`

1. **checkAttestation** — verify we have a stored attestation from a wikilink click
2. **checkEligibility** — check the active file is eligible for generation
3. **applyMeta** — write metadata to the note
4. **moveToWorter** — move the file to the Wörter (dictionary) folder
5. **addWriteAction** — emit a `ProcessMdFile` vault action

**Source**: `src/commanders/textfresser/commands/generate/generate-command.ts`

---

## 9. Cross-Reference Propagation

> **Status**: Planned. This section describes the intended design.

When Generate fills DictEntrySections for a new DictEntry, the LLM output contains references to other Surfaces. Cross-reference propagation ensures those references are **bidirectional** — if A references B, then B's Note is updated to reference A back.

### 9.1 The Problem

If the LLM says the DictEntry for *Kohlekraftwerk* has antonym *Solaranlage*, then:
- `Kohlekraftwerk.md` → Relation DictEntrySection → Antonym SubSection should list `≠ [[Solaranlage]]`
- `Solaranlage.md` → Relation DictEntrySection → Antonym SubSection should list `≠ [[Kohlekraftwerk]]`

### 9.2 SubSection Inverse Rules

Each DictEntrySubSection type has an **inverse rule** — what gets written to the referenced Note's DictEntry:

| If A's SubSection references B | Then B gets SubSection referencing A | Notation |
|-------------------------------|-------------------------------------|----------|
| A synonym of B | B synonym of A | `= ↔ =` |
| A antonym of B | B antonym of A | `≠ ↔ ≠` |
| A hypernym of B | B hyponym of A | `⊃ ↔ ⊂` |
| A hyponym of B | B hypernym of A | `⊂ ↔ ⊃` |
| A meronym of B | B holonym of A | `∈ ↔ ∋` |
| A holonym of B | B meronym of A | `∋ ↔ ∈` |

Some SubSections are **symmetric** (synonym, antonym) — the inverse is the same SubSection type.
Some are **asymmetric** (hypernym/hyponym, meronym/holonym) — the inverse is a different SubSection type.

### 9.3 Per-DictEntrySection Rules

Not all DictEntrySections participate in cross-reference propagation:

- **Relation**: Full bidirectional propagation with inverse rules (see 9.2). This is where most SubSections live.
- **Morphem**: If `Kohlekraftwerk` decomposes into `[[Kohle]] + [[Kraftwerk]]`, then `Kohle.md` could list `Kohlekraftwerk` under "compounds" — simpler, potentially one-directional.
- **Attestation**: No propagation — contexts are per-encounter.
- **Inflection**: No propagation — forms are per-lemma.
- **Header, FreeForm, Deviation**: No propagation.

### 9.4 Implementation Sketch

```
Generate collects LLM DictEntrySection outputs
  ↓
For each DictEntrySection that has propagation rules:
  For each DictEntrySubSection referencing another Surface:
    1. Resolve Surface → target Note path
    2. Parse target Note with dictNoteHelper.parse()
    3. Find or create the appropriate DictEntry
    4. Compute inverse SubSection type (propagation rule)
    5. Update the target DictEntry's DictEntrySection
    6. Serialize → ProcessMdFile action
  ↓
Collect all ProcessMdFile actions (source Note + all target Notes)
  ↓
Single vam.dispatch()
```

---

## 10. Prompt-Smith System

**Location**: `src/prompt-smith/`

### 10.1 Overview

Prompt-smith is a **build-time prompt management system** that:
- Composes prompts from modular parts (agent role, task description, examples)
- Validates examples against Zod schemas at build time
- Generates type-safe TypeScript exports
- Supports multi-language prompt lookup with fallback

### 10.2 Directory Layout

```
src/prompt-smith/
├── prompt-parts/                    # Human-written source prompts
│   └── [target-lang]/[known-lang]/[prompt-kind]/
│       ├── agent-role.ts            # LLM persona instruction
│       ├── task-description.ts      # Task specification
│       └── examples/
│           ├── to-use.ts            # Examples embedded in prompt
│           └── to-test.ts           # Extra examples for validation only
│
├── codegen/
│   ├── consts.ts                    # PromptKind enum (currently: "Translate")
│   ├── generated-promts/            # AUTO-GENERATED compiled prompts
│   └── skript/                      # Codegen pipeline scripts
│       ├── run.ts                   # Orchestrator
│       ├── combine-parts.ts         # XML composition
│       ├── enshure-all-examples-match-schema.ts
│       ├── enshure-all-parts-are-present.ts
│       └── enshure-parts-format.ts
│
├── schemas/                         # Zod I/O schemas per PromptKind
│   ├── index.ts                     # SchemasFor registry
│   └── translate.ts                 # Translate: string → string
│
├── index.ts                         # GENERATED: PROMPT_FOR lookup table
└── types.ts                         # AvaliablePromptDict type
```

### 10.3 Prompt Composition

Each prompt is assembled from three parts into an XML structure:

```xml
<agent-role>
You are a professional bidirectional German-Russian translator...
</agent-role>

<task-description>
Translate the text between German and Russian:
- Separable verbs: preserve prefix via equivalent construction
  (e.g., zu|stimmen → *под*держивать).
</task-description>

<examples>
<example-1>
<input>Guten Morgen!</input>
<output>Доброе утро!</output>
</example-1>
...
</examples>
```

### 10.4 Codegen Pipeline (`bun run codegen:prompts`)

1. **Format validation** — each file exports the correct const name (`agentRole`, `taskDescription`, `examples`)
2. **Presence validation** — English as KnownLanguage is **required** for all targets; other languages are optional
3. **Schema validation** — every example is validated against the PromptKind's Zod schema
4. **Prompt generation** — parts are composed into generated prompt files
5. **Index generation** — `PROMPT_FOR` registry is built with **fallback to English** for missing language pairs
6. **Format** — `bun fix` on generated files

### 10.5 Runtime Usage

```typescript
// src/commanders/textfresser/prompt-runner.ts
class PromptRunner {
  async generate<K extends PromptKind>(kind: K, input: UserInput<K>): Promise<AgentOutput<K>> {
    const prompt = PROMPT_FOR[this.languages.target][this.languages.known][kind];
    const schema = SchemasFor[kind].agentOutputSchema;
    return this.apiService.generate({ schema, systemPrompt: prompt.systemPrompt, userInput: input });
  }
}
```

Lookup: `PROMPT_FOR[targetLang][knownLang][promptKind]` → `{ systemPrompt: string }`

### 10.6 Language Configuration

```typescript
type LanguagesConfig = {
  known: KnownLanguage;   // "Russian" | "English"
  target: TargetLanguage;  // "German" | "English"
};
// Default: { known: "Russian", target: "German" }
```

### 10.7 Bilingual vs Target-Language-Only Prompts

Some PromptKinds depend on both the target language and the user's known language (**bilingual**), while others only depend on the target language (**target-language-only**):

| Category | Example PromptKinds | Depends on known language? |
|----------|-------------------|---------------------------|
| **Bilingual** | Translate | Yes — output language varies by user's known language |
| **Target-language-only** | Morphem | No — morpheme analysis is purely about target language structure |

For **target-language-only** prompts, only the mandatory `english/` known-language path is created. The codegen fallback mechanism automatically reuses this English prompt for other known languages (e.g., Russian), since the prompt content is identical regardless of the user's native language.

### 10.8 Adding a New Language or PromptKind

**New language pair** (e.g., French→English):
```bash
mkdir -p src/prompt-smith/prompt-parts/french/english/translate/examples
# Create: agent-role.ts, task-description.ts, examples/to-use.ts
bun run codegen:prompts
```

**New PromptKind** (e.g., "Lemma"):
1. Add to `PromptKind` enum in `codegen/consts.ts`
2. Create Zod schemas in `schemas/lemma.ts`
3. Register in `SchemasFor`
4. Create prompt-parts for each language pair
5. Run codegen

### 10.9 API Integration

**API Service** (`src/stateless-helpers/api-service.ts`):
- Model: `gemini-2.5-flash-lite`
- Provider: Google (via OpenAI SDK compatibility layer)
- Temperature: 0 (deterministic)
- **Prompt caching**: system prompts > 2048 tokens get 7-day cached content
- **Structured output**: `zodResponseFormat()` for type-safe JSON responses

---

## 11. Textfresser Commander Internals

**Source**: `src/commanders/textfresser/textfresser.ts`

### 11.1 State

```typescript
type TextfresserState = {
  attestationForLatestNavigated: Attestation | null;  // from last wikilink click
  recentLemmaResults: LemmaResult[];                   // last 5-10 Lemma results (ring buffer)
  languages: LanguagesConfig;                          // { known, target }
  promptRunner: PromptRunner;                          // LLM interface
};
```

`recentLemmaResults` holds the last 5–10 Lemma command outputs. Generate consumes the latest one, but the buffer also lets the user review/undo recent lookups and gives context for future UX (e.g., "recent words" panel).

### 11.2 Command Execution Flow

```
Textfresser.executeCommand(commandName, context)
  ↓
Validate activeFile exists
  ↓
Build CommandInput { commandContext, resultingActions, textfresserState }
  ↓
commandFnForCommandKind[commandName](input)
  ↓
ResultAsync<VaultAction[], CommandError>
  ↓
dispatchActions(actions) → vam.dispatch()
  ↓
Log errors via mapErr
```

### 11.3 Wikilink Click Handler

The Textfresser registers an `EventHandler<WikilinkClickPayload>` with the UserEventInterceptor:

```typescript
createHandler(): EventHandler<WikilinkClickPayload> {
  return {
    doesApply: () => true,  // always listen
    handle: (payload) => {
      // Extract attestation from the click context
      const attestation = buildAttestationFromWikilinkClickPayload(payload);
      if (attestation.isOk()) {
        this.state.attestationForLatestNavigated = attestation.value;
      }
      return { outcome: HandlerOutcome.Passthrough }; // don't consume the event
    },
  };
}
```

This is how context flows from reading to the Lemma command: the user clicks a wikilink → attestation is stored → user triggers Lemma → the command uses the stored attestation.

---

## 12. Design Principles

### Prompts Know Specifics, System Thinks in Generics

The separation of concerns:

| Layer | Knows about | Doesn't know about |
|-------|------------|-------------------|
| **Prompts** | German grammar, Russian translations, specific POS rules | How DictEntries are merged, how Notes are structured |
| **Section configs** | Which DictEntrySections exist for Noun vs Verb, which for Phrasem vs Lexem | Content of those sections |
| **Merge logic** | DictEntry structure, DictEntrySection diffing, block IDs | What language, what POS |
| **Propagation rules** | SubSection inversions (synonym↔synonym, meronym↔holonym) | Specific words or meanings |
| **Note format** | Markdown structure, CSS markers, separators | Linguistic semantics |

### Language Extension

To add support for a new target language (e.g., Japanese):
1. **Linguistics**: Add enums if the language needs categories not yet modeled
2. **Section config**: Define which DictEntrySections/SubSections apply per unit/POS
3. **Prompts**: Create prompt-parts for each (known-lang, prompt-kind) combination
4. **Titles**: Add Japanese titles to `TitleReprFor`
5. **No changes** to: Note format, merge logic, propagation rules, command pipeline

---

## 13. Key File Index

| File | Purpose |
|------|---------|
| `src/commanders/textfresser/textfresser.ts` | Commander: state, command dispatch, wikilink handler |
| `src/commanders/textfresser/commands/types.ts` | CommandFn, CommandInput, TextfresserCommandKind |
| `src/commanders/textfresser/commands/generate/generate-command.ts` | Generate pipeline |
| `src/commanders/textfresser/commands/translate/translate-command.ts` | Translate pipeline |
| `src/commanders/textfresser/prompt-runner.ts` | PromptRunner: LLM call wrapper |
| `src/commanders/textfresser/common/attestation/types.ts` | Attestation type |
| `src/commanders/textfresser/common/attestation/builders/` | Attestation construction |
| `src/commanders/textfresser/errors.ts` | CommandError, AttestationParsingError |
| `src/stateless-helpers/dict-note/` | Parse/serialize dictionary notes |
| `src/stateless-helpers/api-service.ts` | Gemini API wrapper |
| `src/linguistics/enums/core.ts` | LinguisticUnitKind, SurfaceKind |
| `src/linguistics/enums/linguistic-units/lexem/pos.ts` | POS, PosTag |
| `src/linguistics/enums/linguistic-units/phrasem/phrasem-kind.ts` | PhrasemeKind |
| `src/linguistics/enums/linguistic-units/morphem/morpheme-kind.ts` | MorphemeKind |
| `src/linguistics/sections/section-kind.ts` | DictSectionKind, TitleReprFor |
| `src/linguistics/old-enums.ts` | Inflectional dimensions, theta roles, tones |
| `src/prompt-smith/index.ts` | PROMPT_FOR registry (generated) |
| `src/prompt-smith/schemas/` | Zod I/O schemas per PromptKind |
| `src/prompt-smith/codegen/skript/run.ts` | Codegen orchestrator |
| `src/prompt-smith/prompt-parts/` | Human-written prompt sources |
| `src/types.ts` | LanguagesConfig, KnownLanguage, TargetLanguage |
