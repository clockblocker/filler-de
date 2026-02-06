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
  LLM classifies: LinguisticUnitKind + POS + SurfaceKind + lemma form
  Wraps the selected word in a [[wikilink]] in the source text
  Stores classification + attestation in state
  ↓
User clicks the wikilink → navigates to the dictionary note
  ↓
User calls "Generate"
  ↓
Generate (heavy lifting):
  Reads Lemma result from state
  Resolves existing entries (re-encounter detection)
  If re-encounter: appends attestation ref, skips LLM
  If new: LLM request PER section (Header, Morphem, Relation, Inflection, Translation)
  Adds Attestation section (no LLM — uses source ref from Lemma)
  Propagates inverse relations to referenced notes
  Builds full DictEntry, serializes to note, moves to Wörter folder
  Notifies user of success/failure
  Single vam.dispatch()
  ↓
User gets a tailor-made dictionary that grows with their reading
```

> **V2 scope**: German target, 6 generated sections (Header, Morphem, Relation, Inflection, Translation, Attestation), re-encounter detection (append attestation vs new entry), cross-reference propagation for relations, user-facing notices.

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
│  ├─ morpheme-formatter — morpheme → wikilink display    │
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
│  ├─ enums/.../morpheme-tag  — MorphemeTag (Sep/Insep)  │
│  ├─ sections/section-kind   — DictSectionKind           │
│  ├─ sections/section-css-kind — DictSectionKind → CSS suffix │
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

### 4.5 Morpheme Tags

Language-specific properties for morphemes (currently: prefix separability in German):

```
MorphemeTag = "Separable" | "Inseparable"
```

| Tag | Meaning | German examples |
|-----|---------|----------------|
| **Separable** | Prefix detaches in main clauses (trennbar) | *auf-*, *an-*, *ein-*, *mit-*, *vor-*, *zu-* |
| **Inseparable** | Prefix stays attached (untrennbar) | *be-*, *emp-*, *ent-*, *er-*, *ge-*, *ver-*, *zer-* |

Some prefixes (*über-*, *unter-*, *um-*, *durch-*) are dual-use — separable or inseparable depending on context.

**Source**: `src/linguistics/enums/linguistic-units/morphem/morpheme-tag.ts`

### 4.6 DictEntrySection Kinds

Each DictEntry is divided into **DictEntrySections**, categorized by `DictSectionKind`:

```
DictSectionKind = "Relation" | "FreeForm" | "Attestation" | "Morphem"
               | "Header" | "Deviation" | "Inflection" | "Translation"
```

| Kind | German title | Purpose | Has SubSections? |
|------|-------------|---------|-----------------|
| `Header` | Formen | Lemma display, pronunciation, article | No |
| `Attestation` | Kontexte | User's encountered contexts (`![[File#^blockId\|^]]`) | No |
| `Relation` | Semantische Beziehungen | Lexical relations | **Yes** (see below) |
| `Morphem` | Morpheme | Word decomposition. LLM returns structured data (`surf`/`lemma`/`tags`/`kind`), `morphemeFormatterHelper` converts to wikilink display (`[[auf\|>auf]]\|[[passen]]`) | No |
| `Inflection` | Flexion | Declension/conjugation tables | No |
| `Deviation` | Abweichungen | Irregular forms, exceptions | No |
| `FreeForm` | Notizen | Catch-all for unstructured content (see below) | No |

Section titles are localized per `TargetLanguage` via `TitleReprFor`.

**FreeForm — the catch-all section**: Any content in a DictEntry that doesn't match our structured format (i.e., doesn't belong to a recognized DictEntrySection) gets collected into the FreeForm section. This keeps the structured sections clean while preserving user-written or unrecognized content. **Auto-cleanup** happens on Note open/close — the system scans the DictEntry, moves stray content into FreeForm, and re-serializes.

**Source**: `src/linguistics/sections/section-kind.ts`

### 4.7 DictEntrySubSections

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

### 4.8 Detailed Inflectional Enums

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

When a user encounters a word, the system captures the **attestation** — the context in which the word appeared. Attestations can be built from two sources:

```typescript
type Attestation = {
  source: {
    ref: string;                    // "![[Atom#^13|^]]" — embed reference
    textRaw: string;                // raw paragraph/line content
    textWithOnlyTargetMarked: string; // stripped, only [target] marked
    path: SplitPathToMdFile;        // path to the source file
  };
  target: {
    surface: string;  // the word as it appears in text
    lemma?: string;   // if wikilink is [[lemma|surface]], the lemma
  };
};
```

### 6.1 Attestation from Wikilink Click

Stored in `TextfresserState.attestationForLatestNavigated`:

```
User clicks [[Kohlekraftwerk]] in a text paragraph
  ↓
UserEventInterceptor fires WikilinkClickPayload
  ↓
Textfresser.createHandler() → buildAttestationFromWikilinkClickPayload()
  ↓
Stored in state.attestationForLatestNavigated
```

### 6.2 Attestation from Text Selection

Built on-demand by the Lemma command when no wikilink attestation exists:

```
User selects "Kohlekraftwerk" in a text paragraph and calls Lemma
  ↓
Lemma command resolves attestation:
  1. Check state.attestationForLatestNavigated → null
  2. Fall back to buildAttestationFromSelection(commandContext.selection)
  ↓
Uses selection.text as surface, selection.surroundingRawBlock for context
```

**Builder**: `src/commanders/textfresser/common/attestation/builders/build-from-selection.ts`

Both flows extract block IDs from the source line for embed references (`![[file#^blockId|^]]`).

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
| `Lemma` | V2 | Recon: classify word via LLM, wrap in wikilink, store result, notify user |
| `Generate` | V2 | Build DictEntry: LLM-generated sections (Header, Morphem, Relation, Inflection, Translation) + Attestation; re-encounter detection; cross-ref propagation; serialize, move to Wörter, notify user |
| `TranslateSelection` | V1 | Translate selected text via LLM |

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

The dictionary pipeline is split into two user-facing commands with distinct responsibilities:

```
         Lemma (recon)                          Generate (heavy lifting)
┌─────────────────────────────┐    ┌──────────────────────────────────────────┐
│ 1. Resolve attestation       │    │ 1. Check attestation + lemma result      │
│    (wikilink click or        │    │ 2. Resolve existing entries (re-encounter│
│     text selection)          │    │    detection via ID prefix match)        │
│ 2. LLM classification       │    │ 3. If re-encounter: append attestation   │
│    → LinguisticUnit + POS   │───→│    If new: LLM request PER section:      │
│    → SurfaceKind + lemma    │    │      Header → formatHeaderLine()         │
│ 3. Wrap surface in wikilink  │    │      Morphem → morphemeFormatterHelper() │
│ 4. Store result in state     │    │      Relation → formatRelationSection()  │
│ 5. Notify: "✓ lemma (POS)"  │    │      Inflection → formatInflectionSection│
│                              │    │      Translation → PromptKind.Translate  │
│ Light, single LLM call       │    │      Attestation → source ref (no LLM)  │
└─────────────────────────────┘    │ 4. Propagate inverse relations to targets│
                                   │ 5. Serialize ALL entries + apply meta     │
                                   │ 6. Move to Wörter, notify user            │
                                   │ 7. Single vam.dispatch()                  │
                                   └──────────────────────────────────────────┘
```

### 8.1 Lemma Command (V1)

The user selects a word and calls "Lemma". This is the lightweight classification step.

**Source**: `src/commanders/textfresser/commands/lemma/lemma-command.ts`

#### Attestation Resolution

Lemma tries two sources (in order):
1. `state.attestationForLatestNavigated` — from a prior wikilink click
2. `buildAttestationFromSelection(selection)` — from the current text selection

#### LLM Classification

**Input** (via `PromptKind.Lemma`): `{ surface: string, context: string }`

**Structured output** (Zod schema in `schemas/lemma.ts`):
```typescript
{
  linguisticUnit: LinguisticUnitKind,  // "Lexem" | "Phrasem" | "Morphem"
  pos?: POS | null,                    // only for Lexem
  surfaceKind: SurfaceKind,            // "Lemma" | "Inflected" | "Variant"
  lemma: string,                       // dictionary form
}
```

#### Wikilink Wrapping

After classification, Lemma wraps the surface in a wikilink in the source block:
- Same lemma: `Schuck` → `[[Schuck]]`
- Different lemma: `lief` → `[[laufen|lief]]`

Uses `ProcessMdFile` with `before: rawBlock` / `after: blockWithWikilink`.

#### State Update

Result stored as `TextfresserState.latestLemmaResult`:
```typescript
type LemmaResult = {
  linguisticUnit: LinguisticUnitKind;
  pos?: POS;
  surfaceKind: SurfaceKind;
  lemma: string;
  attestation: Attestation;  // captured context
};
```

### 8.2 Generate Command (V2)

The user navigates to the dictionary note (via the wikilink Lemma created) and calls "Generate".

**Source**: `src/commanders/textfresser/commands/generate/generate-command.ts`

#### Pipeline

```
checkAttestation → checkEligibility → checkLemmaResult
  → resolveExistingEntry (parse existing entries, detect re-encounter)
  → generateSections (async: LLM calls or attestation append)
  → propagateRelations (cross-ref inverse relations to target notes)
  → serializeEntry → applyMeta → moveToWorter → addWriteAction
```

Sync `Result` checks transition to async `ResultAsync` at `generateSections`.

#### Re-Encounter Detection

`resolveExistingEntry` parses the active file via `dictNoteHelper.parse()`, builds an ID prefix from the lemma result, and searches for a matching entry:

- **Match found** → `matchedEntry` set, `isExistingEntry` path in `generateSections`
- **No match** → `nextIndex` computed via `dictEntryIdHelper.nextIndex()` for the new entry

#### Section Generation (V2)

`generateSections` has two paths:

**Path A (re-encounter)**: If `matchedEntry` exists, skip all LLM calls. Find or create the Attestation section in the matched entry, append the new attestation ref (deduped). Returns existing entries unchanged except for the appended ref.

**Path B (new entry)**: Determines applicable sections via `getSectionsFor()`, filtered to the **V2 set**: Header, Morphem, Relation, Inflection, Translation, Attestation.

For each applicable section:

| Section | LLM? | PromptKind | Formatter | Output |
|---------|------|-----------|-----------|--------|
| **Header** | Yes | `Header` | `formatHeaderLine()` | `{emoji} {article} [[lemma]], [{ipa} ♫](youglish_url)` → `DictEntry.headerContent` |
| **Morphem** | Yes | `Morphem` | `morphemeFormatterHelper.formatSection()` | `[[kohle]]\|[[kraft]]\|[[werk]]` → `EntrySection` |
| **Relation** | Yes | `Relation` | `formatRelationSection()` | `= [[Synonym]], ⊃ [[Hypernym]]` → `EntrySection`. Raw output also stored for propagation. |
| **Inflection** | Yes | `Inflection` | `formatInflectionSection()` | `N: das [[Kohlekraftwerk]], die [[Kohlekraftwerke]]` → `EntrySection`. POS-adaptive (case table for nouns, tenses for verbs, degrees for adjectives). |
| **Translation** | Yes | `Translate` | — (string pass-through) | Translates the attestation sentence context → `EntrySection` |
| **Attestation** | No | — | — | `![[file#^blockId\|^]]` from `lemmaResult.attestation.source.ref` → `EntrySection` |

Each `EntrySection` gets:
- `kind`: CSS suffix from `cssSuffixFor[DictSectionKind]` (e.g., `"synonyme"`, `"morpheme"`, `"flexion"`, `"translations"`)
- `title`: Localized from `TitleReprFor[sectionKind][targetLang]`

#### Entry ID

Built via `dictEntryIdHelper.build()`. V2 uses `nextIndex` computed from existing entries:
- Lexem: `LX-{SurfaceTag}-{PosTag}-{nextIndex}` (e.g., `LX-LM-NOUN-1`, `LX-LM-NOUN-2`)
- Phrasem/Morphem: `{UnitTag}-{SurfaceTag}-{nextIndex}`

#### Serialization & Dispatch

`serializeEntry` → `dictNoteHelper.serialize(allEntries)` → note body (serializes ALL entries, existing + new)
`applyMeta` → `noteMetadataHelper.upsert(meta)` → metadata section
`moveToWorter` → `RenameMdFile` action to sharded Wörter folder
Final `ProcessMdFile` writes the content → all actions (including propagation actions) dispatched via `vam.dispatch()`

### 8.3 Prompt Configuration Matrix

Different prompts are needed depending on:

| Dimension | Values | Effect |
|-----------|--------|--------|
| **TargetLanguage** | German, English, ... | Language of the dictionary |
| **KnownLanguage** | Russian, English, ... | User's native language |
| **PromptKind** | Lemma, Header, Morphem, Relation, Inflection, Translate | What task the LLM performs |

Section applicability (which sections a DictEntry gets) is determined by `LinguisticUnitKind` + `POS` via `getSectionsFor()` in `src/linguistics/sections/section-config.ts`.

### 8.4 Future Enhancements (Not in V2)

- **Full meaning resolution**: Current re-encounter detection matches by ID prefix (unit+surface+POS). Future: LLM query to distinguish polysemy within the same prefix (e.g., "Bank" as financial institution vs bench).
- **Multi-word selection**: Lemma handling phrasem attestations from multi-word selections
- **Deviation section**: Additional LLM-generated section for irregular forms and exceptions

---

## 9. Cross-Reference Propagation

> **Status**: V2 implemented.

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

### 9.4 Implementation

**Source**: `src/commanders/textfresser/commands/generate/steps/propagate-relations.ts`

The `propagateRelations` step runs after `generateSections` in the Generate pipeline. It uses the raw `relations` output captured during section generation (not re-parsed from markdown).

```
generateSections captures raw relation output (ParsedRelation[])
  ↓
propagateRelations:
  For each relation { kind, words[] }:
    Compute inverseKind via INVERSE_KIND map
    For each target word (skip self-references):
      1. Build target SplitPath via computeShardedFolderParts(word)
      2. Create UpsertMdFile action (ensures target note exists)
      3. Create ProcessMdFile with transform function that:
         a. Finds existing relation section marker in target note
         b. Appends inverse relation line (deduped)
         c. Or creates new relation section if none exists
  ↓
Propagation VaultActions added to ctx.actions
  ↓
All dispatched in single vam.dispatch() alongside source note actions
```

**Key design decisions**:
- Uses `ProcessMdFile` with `transform` function for atomic read-then-write on target notes
- `UpsertMdFile` with `content: null` ensures target file exists before processing
- Skips propagation for re-encounters (no new relations generated)
- Deduplicates: won't add `= [[Schuck]]` if it already exists in the target's relation section

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
│   ├── consts.ts                    # PromptKind enum ("Translate","Morphem","Lemma","Header","Relation","Inflection")
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
│   ├── translate.ts                 # Translate: string → string
│   ├── morphem.ts                   # Morphem: {word,context} → {morphemes[]}
│   ├── lemma.ts                     # Lemma: {surface,context} → {linguisticUnit,pos?,surfaceKind,lemma}
│   ├── header.ts                    # Header: {word,pos,context} → {emoji,article?,ipa}
│   ├── relation.ts                  # Relation: {word,pos,context} → {relations[{kind,words[]}]}
│   └── inflection.ts                # Inflection: {word,pos,context} → {rows[{label,forms}]}
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

| Category | PromptKinds | Depends on known language? |
|----------|-------------|---------------------------|
| **Bilingual** | Translate | Yes — output language varies by user's known language |
| **Target-language-only** | Morphem, Lemma, Header, Relation, Inflection | No — linguistic analysis is purely about target language structure |

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
  latestLemmaResult: LemmaResult | null;              // from last Lemma command
  languages: LanguagesConfig;                          // { known, target }
  promptRunner: PromptRunner;                          // LLM interface
};
```

`latestLemmaResult` holds the most recent Lemma command output. Generate reads it for classification + attestation data. Both fields are checked when validating attestation availability (wikilink click OR prior Lemma).

### 11.2 Command Execution Flow

```
Textfresser.executeCommand(commandName, context, notify)
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
On success: notify("✓ {lemma} ({pos})" or "✓ Entry created for {lemma}")
On error: notify("⚠ {reason}") + logger.warn
```

The `notify` callback is injected from `createCommandExecutor` (which creates an Obsidian `Notice`).

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

This is one of two ways context flows to commands. The other: user selects text → calls Lemma → `buildAttestationFromSelection()` creates attestation on-the-fly from the selection (see section 6.2).

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
| **Textfresser Commander** | |
| `src/commanders/textfresser/textfresser.ts` | Commander: state, command dispatch, wikilink handler |
| `src/commanders/textfresser/commands/types.ts` | CommandFn, CommandInput, TextfresserCommandKind |
| `src/commanders/textfresser/prompt-runner.ts` | PromptRunner: LLM call wrapper |
| `src/commanders/textfresser/errors.ts` | CommandError, AttestationParsingError |
| **Commands** | |
| `src/commanders/textfresser/commands/lemma/lemma-command.ts` | Lemma pipeline: classify + wrap in wikilink |
| `src/commanders/textfresser/commands/lemma/types.ts` | LemmaResult type |
| `src/commanders/textfresser/commands/generate/generate-command.ts` | Generate pipeline orchestrator |
| `src/commanders/textfresser/commands/generate/steps/check-attestation.ts` | Sync check: attestation available |
| `src/commanders/textfresser/commands/generate/steps/check-lemma-result.ts` | Sync check: lemma result available |
| `src/commanders/textfresser/commands/generate/steps/resolve-existing-entry.ts` | Parse existing entries, detect re-encounter by ID prefix |
| `src/commanders/textfresser/commands/generate/steps/generate-sections.ts` | Async: LLM calls per section (or append attestation for re-encounters) |
| `src/commanders/textfresser/commands/generate/steps/propagate-relations.ts` | Cross-ref: compute inverse relations, generate actions for target notes |
| `src/commanders/textfresser/commands/generate/steps/serialize-entry.ts` | Serialize ALL DictEntries to note body |
| `src/commanders/textfresser/commands/generate/section-formatters/header-formatter.ts` | Header LLM output → header line |
| `src/commanders/textfresser/commands/generate/section-formatters/relation-formatter.ts` | Relation LLM output → symbol notation |
| `src/commanders/textfresser/commands/generate/section-formatters/inflection-formatter.ts` | Inflection LLM output → `{label}: {forms}` lines |
| `src/commanders/textfresser/commands/translate/translate-command.ts` | Translate pipeline |
| **Attestation** | |
| `src/commanders/textfresser/common/attestation/types.ts` | Attestation type |
| `src/commanders/textfresser/common/attestation/builders/build-from-wikilink-click-payload.ts` | Build from wikilink click |
| `src/commanders/textfresser/common/attestation/builders/build-from-selection.ts` | Build from text selection |
| **Stateless Helpers** | |
| `src/stateless-helpers/dict-note/` | Parse/serialize dictionary notes |
| `src/stateless-helpers/morpheme-formatter.ts` | Morpheme → wikilink display formatter |
| `src/stateless-helpers/api-service.ts` | Gemini API wrapper |
| **Linguistics** | |
| `src/linguistics/enums/core.ts` | LinguisticUnitKind, SurfaceKind |
| `src/linguistics/enums/linguistic-units/lexem/pos.ts` | POS, PosTag |
| `src/linguistics/enums/linguistic-units/phrasem/phrasem-kind.ts` | PhrasemeKind |
| `src/linguistics/enums/linguistic-units/morphem/morpheme-kind.ts` | MorphemeKind |
| `src/linguistics/enums/linguistic-units/morphem/morpheme-tag.ts` | MorphemeTag (Separable/Inseparable) |
| `src/linguistics/sections/section-kind.ts` | DictSectionKind, TitleReprFor |
| `src/linguistics/sections/section-css-kind.ts` | DictSectionKind → CSS suffix mapping |
| `src/linguistics/sections/section-config.ts` | getSectionsFor(): applicable sections per unit+POS |
| `src/linguistics/dict-entry-id/dict-entry-id.ts` | DictEntryId builder/parser |
| `src/linguistics/old-enums.ts` | Inflectional dimensions, theta roles, tones |
| **Prompt-Smith** | |
| `src/prompt-smith/index.ts` | PROMPT_FOR registry (generated) |
| `src/prompt-smith/schemas/` | Zod I/O schemas: translate, morphem, lemma, header, relation, inflection |
| `src/prompt-smith/codegen/consts.ts` | PromptKind enum |
| `src/prompt-smith/codegen/skript/run.ts` | Codegen orchestrator |
| `src/prompt-smith/prompt-parts/` | Human-written prompt sources (3 kinds × 2 lang pairs) |
| **Types** | |
| `src/types.ts` | LanguagesConfig, KnownLanguage, TargetLanguage |
