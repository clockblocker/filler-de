# Textfresser Vocabulary System — Architecture

> **Scope**: This document covers the vocabulary/dictionary half of the plugin (the "Textfresser" commander). For the tree/healing/codex half, see the Librarian docs. For E2E testing, see `e2e-architecture.md`.
>
> **Compatibility Policy (Dev Mode, 2026-02-20)**:
> - Textfresser is treated as green-field. Breaking changes are allowed; no backward-compatibility guarantees for Textfresser note formats, schemas, or intermediate contracts.
> - Librarian and VAM are stability-critical infrastructure. Changes there require conservative rollout, migration planning when persisted contracts change, and explicit regression coverage.

---

## 1. Vision

Textfresser builds a **personal, encounter-driven dictionary** for language learners.

**Core premise**: A dictionary that only contains words the user has actually encountered, in contexts they've actually read, is more useful than a generic one.

The flow (two commands: **Lemma** → **Generate**, automated):

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
  Phase A: resolve/create safe pre-target and insert clickable wikilink immediately
  LLM classifies minimal target: lemma + linguisticUnit (Lexem/Phrasem) + posLikeKind + surfaceKind
  Optionally returns contextWithLinkedParts for multi-span/separable linking
  Phase B: resolve final target by policy, rewrite source link(s), move/cleanup placeholder
  Stores classification + attestation in state
  ↓
Background Generate fires automatically (user stays on source text):
  Uses latest resolved lemma target path as primary destination
  Reads existing content (empty if new file)
  Runs full Generate pipeline: resolve existing entries, LLM sections, propagation
  Dispatches all actions via VAM (ProcessMdFile auto-detects open/closed file)
  Notifies user of success/failure
  ↓
User clicks the wikilink → navigates to the dictionary note
  If Generate still running: handler awaits completion, then scrolls to entry
  If Generate already done: scrolls to entry immediately
  ↓
User gets a tailor-made dictionary that grows with their reading
```

> **Core scope**: German target, 6 generated sections (Header, Morphem, Relation, Inflection, Translation, Attestation), re-encounter detection (append attestation vs new entry), cross-reference propagation for relations, noun inflection propagation in inflected-form notes, user-facing notices.

> **V3 scope**: Polysemy disambiguation — new Disambiguate prompt in Lemma command, enriched note metadata per entry ID for fast lookup without note parsing, VAM API expansion (`getSplitPathsToExistingFilesWithBasename`), Lemma-side sense matching before Generate.

> **V5 scope**: Pipeline hardening — tighter LLM output schemas (`genus` for grammatical gender, length caps on `emoji`/`inflection` fields), Disambiguate prompt hardening (bounds-check `matchedIndex` against valid indices, log parse failures), scroll-to-entry after Generate dispatch, 37 unit tests covering formatters + disambiguate-sense + propagation steps.

> **V7 scope**: Polysemy quality fixes — Header emoji prompt changed to reflect the specific sense in context (not "primary/most common meaning"). Disambiguate gloss rule added: must be context-independent (e.g., "Schließvorrichtung" not "Fahrradschloss"). New polysemous examples in Header and Disambiguate prompts (Schloss castle vs lock).

> **V10 scope**: Emoji-as-semantic-differentiator — **Definition section dropped entirely** (along with `PromptKind.Semantics`). Homonym disambiguation now uses **emoji arrays** instead of text glosses. Header prompt returns `senseEmojis: string[]` (1-3 emojis capturing the sense, e.g., `["🏰"]` vs `["🔒","🔑"]` for *Schloss*). Disambiguate prompt receives `senseEmojis` + `unitKind` + `pos` + `genus` (+ optional `phrasemeKind`) per sense (richer context than the old text gloss). `meta.semantics` replaced by canonical `meta.entity.senseEmojis`. `LemmaResult.precomputedSemantics` replaced by `precomputedSenseEmojis: string[]`. Entries without `senseEmojis` are treated as new-sense candidates. CORE_SECTIONS reduced to `[Header, Translation, Attestation, FreeForm]`.

> **V11 scope**: Kill Header Prompt — `PromptKind.Header` eliminated. `senseEmojis` (1-3 emojis) and `ipa` (IPA pronunciation) moved into Lemma prompt output. Header line built from LemmaResult fields (`formatHeaderLine()` takes `{ senseEmojis, ipa }` instead of `AgentOutput<"Header">`). Header emoji display uses the full `senseEmojis` sequence in order. `genus` and article (der/die/das) dropped from header line. `buildLinguisticUnit()` removed — `meta.linguisticUnit` no longer populated during Generate. One fewer API call per new entry.

> **V12 scope**: POS features as tags + custom header formatting — New `PromptKind.Features` returns non-inflectional grammatical features (e.g., maskulin, transitiv, stark) as tag path components. Tags rendered as `DictSectionKind.Tags` section (`#pos/feature1/feature2`). Lemma prompt now returns `genus` ("Maskulinum"/"Femininum"/"Neutrum") for nouns. Header formatting split per-POS: `dispatchHeaderFormatter()` routes Noun+genus to `de/lexem/noun/header-formatter` (prepends der/die/das), all other POS to common formatter. `CORE_SECTIONS` expanded to include Tags.

> **V13 scope**: Phraseme-kind threading + linguisticUnit metadata restore — Lemma output now includes `phrasemeKind` for `linguisticUnit: "Phrasem"`. `generateSections` restores `meta.linguisticUnit` for `Lexem` and `Phrasem` entries. Disambiguate senses now forward optional `phrasemeKind` hints extracted from `meta.linguisticUnit`.

> **V14 scope**: Minimal Lemma + Generate enrichment cutover — `PromptKind.Lemma` now returns only classifier fields (`lemma`, `linguisticUnit`, `posLikeKind`, `surfaceKind`, optional `contextWithLinkedParts`). Core metadata (`senseEmojis`, `ipa`, noun-only `genus` + `nounClass`) moved to Generate via enrichment prompts. Features prompt is now POS-specific (`FeaturesNoun` ... `FeaturesInteractionalUnit`), and legacy `PromptKind.Features` is removed. Proper-noun/separable span expansion relies on `contextWithLinkedParts`; legacy `fullSurface` is removed. Noun enrichment metadata (`genus`, `nounClass`) is treated as best-effort at parse time; header formatting first falls back to noun-inflection genus, then degrades to common header when genus is still missing.

> **V15 scope**: Lemma safe-linking + deterministic target routing — Lemma now runs in two dispatch phases: pre-prompt safe link insertion (with optional temporary `Worter/.../unknown/...` working note) and post-prompt final routing rewrite. Closed-set Lexem POS still rewrite attestation links to `Library` leaves, but Generate target routing is surface-host-first in `Worter` (mixed-role note model). Post-prompt phase can rename/delete temporary working notes, retarget temporary links (including multi-span expansion), and navigate from temporary note to final note when needed. Background Generate now uses the latest resolved target path as its primary source of truth.

> **V16 scope**: Prompt-stability + pipeline hardening — Lemma adds runtime output guardrails with one controlled retry for suspicious same-surface outputs (separable inflected verbs, comparative/superlative-like inflected adjectives). Unsafe `contextWithLinkedParts` rewrites are dropped when stripped text does not match source context. Background Generate cleanup is now ownership-aware: empty targets are auto-trashed only when invocation-owned (or truly newly created in this run). Disambiguate senses now include optional `senseGloss` (short text gloss) alongside emoji signals.

> **V17 scope**: Morphological relations — Morphem output now supports optional top-level `derived_from` (single base) and `compounded_from` (immediate constituents). New DictSectionKind `Morphology` (`Morphologische Relationen`) is generated for Lexem entries (except proper nouns), ordered right after Morphem. Generate now enforces a 3-phase model (`lemma -> generation -> propagation`) by waiting for `WordTranslation` before all propagation steps. Propagation is split: `propagateMorphologyRelations` owns Lexem-side morphology backlinks (localized relation markers, e.g. German `Verwendet in:`) plus verb-prefix equations on prefix Morphem notes; `propagateMorphemes` owns bound-morpheme localized `used in` aggregation on Morphem notes (including non-verb prefixes and separable prefixes that are not covered by an equation). Relation propagation shares append/dedupe utilities and skips when source lemma is already referenced.

> **V9 scope**: LinguisticUnit DTO — Zod-schema-based type system as source of truth for DictEntries. German + Noun fully featured (`genus`, `nounClass`); all other POS/unit kinds have stubs. `GermanLinguisticUnit` built during Generate and stored in `meta.linguisticUnit`. Header prompt now returns `genus` ("Maskulinum"/"Femininum"/"Neutrum") instead of `article` ("der"/"die"/"das"); formatter derives article via `articleFromGenus`. New files: `surface-factory.ts`, `genus.ts`, `noun.ts`, `pos-features.ts`, `lexem-surface.ts`, `phrasem-surface.ts`, `morphem-surface.ts`, `linguistic-unit.ts`. 21 new DTO tests.

> **V8 scope**: Eigenname (proper noun) support — Lemma LLM returns `nounClass` ("Common" | "Proper") and `fullSurface` (when proper noun extends beyond selected text, e.g., selecting "Bank" in "Deutsche Bank"). Wikilink wrapping expands to cover full proper noun via `expandOffsetForFullSurface()` with verification fallback. Section config: proper nouns get reduced sections (core only — no Inflection, Morphem, Relation) via `sectionsForProperNoun`. `nounClass` threaded through `LemmaResult` → `buildSectionQuery()` → `getSectionsFor()`.

> **V6 scope**: Translation now uses dedicated `PromptKind.WordTranslation` (translates the lemma word, not the attestation sentence; uses context only for disambiguation). Definition section upgraded from 1-3 word gloss to 5-15 word German dictionary-style definition. Attestation refs now separated by blank lines (`\n\n`) for visual spacing. Dict note cleanup on file open: reorders entries (LM first, IN last), normalizes attestation spacing, reorders sections within each entry by `SECTION_DISPLAY_WEIGHT`. Generate pipeline also sorts sections by weight before serializing. Entry separator widened to `\n\n\n---\n---\n\n\n`.

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
│     ├─ domain/     — dict-note, dict-entry-id, morpheme │
│     ├─ targets/de/ — section config + CSS/title mapping │
│     └─ llm/        — prompt catalog + prompt runner      │
├─────────────────────────────────────────────────────────┤
│  Stateless Helpers (Pure functions)                     │
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
│  Linguistics (Type system + DTO)                        │
│  ├─ common/enums/core.ts        — LinguisticUnitKind, SurfaceKind │
│  ├─ common/enums/.../pos.ts     — POS, PosTag           │
│  ├─ common/enums/.../phrasem-kind  — PhrasemeKind       │
│  ├─ common/enums/.../morpheme-kind — MorphemeKind       │
│  ├─ common/dto/surface-factory  — makeSurfaceSchema()   │
│  ├─ common/dto/phrasem-surface  — PhrasemSurfaceSchema  │
│  ├─ german/enums/genus          — GermanGenus + articleFromGenus │
│  ├─ german/features/noun        — Noun Full/Ref features │
│  ├─ german/features/pos-features — all POS feature unions │
│  ├─ german/schemas/             — GermanLinguisticUnitSchema │
│  ├─ commanders/textfresser/targets/de/sections/section-kind   — DictSectionKind    │
│  ├─ commanders/textfresser/targets/de/sections/section-css-kind — kind → CSS suffix │
│  └─ german/inflection/noun      — NounInflectionCell    │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Linguistic Type System

**Location**: `src/packages/independent/linguistics/src/` for shared schemas, with public primitives re-exported from `src/packages/independent/lexical-generation/`

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

**Source**: `src/packages/independent/lexical-generation/primitives.ts` (public) and `src/packages/independent/linguistics/src/common/enums/core.ts` (workspace)

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

**Source**: `src/packages/independent/lexical-generation/primitives.ts` (public) and `src/packages/independent/linguistics/src/common/enums/linguistic-units/lexem/pos.ts` (workspace)

### 4.4 Phraseme Kinds

```
PhrasemeKind = "Idiom" | "Collocation" | "DiscourseFormula" | "Proverb" | "CulturalQuotation"
```

Each kind has further sub-classifications (e.g., collocation strength: `Free | Bound | Frozen`, collocation type: `ADJ+NOUN`, `VERB+NOUN`, etc.).

**Source**: `src/packages/independent/linguistics/src/common/enums/linguistic-units/phrasem/phrasem-kind.ts`

### 4.5 Morpheme Tags

Prefix separability for German morphemes (kind-specific field, only on Prefix-kind morphemes):

```
Separability = "Separable" | "Inseparable"
```

| Value | Meaning | German examples |
|-----|---------|----------------|
| **Separable** | Prefix detaches in main clauses (trennbar) | *auf-*, *an-*, *ein-*, *mit-*, *vor-*, *zu-* |
| **Inseparable** | Prefix stays attached (untrennbar) | *be-*, *emp-*, *ent-*, *er-*, *ge-*, *ver-*, *zer-* |

Some prefixes (*über-*, *unter-*, *um-*, *durch-*) are dual-use — separable or inseparable depending on context.

**Source**: `src/packages/independent/linguistics/src/de/morphem/prefix/features.ts`

### 4.6 DictEntrySection Kinds

Each DictEntry is divided into **DictEntrySections**, categorized by `DictSectionKind`:

```
DictSectionKind = "Relation" | "FreeForm" | "Attestation" | "Morphem" | "Morphology"
               | "Header" | "Deviation" | "Inflection" | "Translation" | "Tags"
```

| Kind | German title | Purpose | Has SubSections? |
|------|-------------|---------|-----------------|
| `Header` | Formen | Lemma display, pronunciation. Emoji sequence derived from `senseEmojis` (from Lemma output). No LLM call — built from LemmaResult. | No |
| `Attestation` | Kontexte | User's encountered contexts (`![[File#^blockId\|^]]`) | No |
| `Relation` | Semantische Beziehungen | Lexical relations | **Yes** (see below) |
| `Morphem` | Morpheme | Word decomposition. LLM returns structured data (`surf`/`lemma`/`tags`/`kind`), `morphemeFormatterHelper` converts to wikilink display (`[[auf\|>auf]]\|[[passen]]`) | No |
| `Morphology` | Morphologische Relationen | Derivation/compounding structure (localized relation markers, e.g. German `Abgeleitet von:`, `Besteht aus:`, `Verwendet in:`), verb-prefix equations | No |
| `Inflection` | Flexion | Declension/conjugation tables | No |
| `Deviation` | Abweichungen | Irregular forms, exceptions | No |
| `Tags` | Tags | POS feature tags (`#noun/maskulin`, `#verb/transitiv/stark`). Generated from POS-specific Features prompts; tag parts are trim/lowercase-normalized and deduplicated when composing `#pos/...`. | No |
| `FreeForm` | Notizen | Catch-all for unstructured content (see below) | No |

Section titles are localized per `TargetLanguage` via `TitleReprFor`.

**FreeForm — the catch-all section**: Any content in a DictEntry that doesn't match our structured format (i.e., doesn't belong to a recognized DictEntrySection) gets collected into the FreeForm section. This keeps the structured sections clean while preserving user-written or unrecognized content. **Auto-cleanup** happens on Note open/close — the system scans the DictEntry, moves stray content into FreeForm, and re-serializes.

**Dict note cleanup on open (V6+)**: When a dict note is opened (`file-open` event in `main.ts`), `cleanupDictNote()` runs three normalizations: (1) normalize attestation ref spacing to `\n\n`-separated, (2) reorder sections within each entry by `SECTION_DISPLAY_WEIGHT` (Attestation → Relation → Translation → Morphem → Morphology → Tags → Inflection → Deviation → FreeForm), and (3) reorder entries so LM (lemma) entries come before IN (inflected) entries. Returns `null` if no changes needed (skips write). Uses VAM `ProcessMdFile` dispatch with self-event tracking to prevent feedback loops. Detection: checks note content for `noteKind: "DictEntry"` metadata string. The Generate pipeline also applies section weight sorting in `serializeEntry` before writing.

**Source**: `src/commanders/textfresser/targets/de/sections/section-kind.ts`

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

> **Deleted**: The legacy `src/linguistics/old-enums.ts` that previously defined detailed grammatical categories (Person, Number, Case, Tense, Verb Mood, Noun Class, Comparison Degree, Theta Roles, Stylistic Tone, Scalar Degree) has been removed as dead code. The surviving linguistic enum/schema layer now lives under `src/packages/independent/linguistics/src/`, with only selected shared primitives re-exported from `src/packages/independent/lexical-generation/`.

---

## 5. Note & DictEntry Format

**Location**: `src/commanders/textfresser/domain/dict-note/`

A Note is an Obsidian markdown file named after a Surface. It contains one or more **DictEntries** — each representing a distinct semantic/grammatical meaning of that Surface.

### 5.1 DictEntry Structure

```markdown
🏭 [[Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k](https://youglish.com/pronounce/Kohlekraftwerk/german) ^l-nom-n-m1

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
- **Header line**: emoji sequence (from `senseEmojis`) + `[[Surface]]` + pronunciation link + ` ^blockId`
- **DictEntryId format** (validated by `DictEntryIdSchema`): `^{LinguisticUnitKindTag}-{SurfaceKindTag}(-{PosTag}-{index})` — the PosTag+index suffix is Lexem-only. E.g., `^lx-lm-nom-1` (Lexem, Lemma surface, Noun, 1st meaning). Final format TBD.
- **DictEntrySections**: marked with `<span class="entry_section_title entry_section_title_{kind}">Title</span>`
- **Multiple DictEntries** (different meanings of the same Surface) separated by `\n\n\n---\n---\n\n\n`

### 5.2 Parsed Representation

```typescript
type DictEntryMeta = {
  entity?: DeEntity;                        // canonical DTO for generation/propagation
  linguisticUnit?: GermanLinguisticUnit;  // V9: typed DTO (see section 15)
} & Record<string, unknown>;

type DictEntry = {
  id: string;                       // "l-nom-n-m1"
  headerContent: string;            // header line without ^blockId
  sections: DictEntrySection[];     // (code type: EntrySection)
  meta: DictEntryMeta;              // typed fields + extensible
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
{"entries":{"LX-LM-NOUN-1":{"entity":{"senseEmojis":["🏭","⚡"],"ipa":"ˈkoːləˌkraftvɛɐ̯k","language":"German","lemma":"Kohlekraftwerk","linguisticUnit":"Lexem","posLikeKind":"Noun","surfaceKind":"Lemma","features":{"inflectional":{},"lexical":{"genus":"Neutrum","nounClass":"Common","pos":"Noun"}}}}}}
</section>
```

### 5.4 Parse / Serialize

`dictNoteHelper` provides round-trip-stable parse and serialize:

```typescript
import { dictNoteHelper } from "src/commanders/textfresser/domain/dict-note";

const entries = dictNoteHelper.parse(noteText);      // string → DictEntry[]
const { body, meta } = dictNoteHelper.serialize(entries); // DictEntry[] → { body, meta }
```

**Source**: `src/commanders/textfresser/domain/dict-note/internal/parse.ts`, `serialize.ts`

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
    surface: string;       // the word as it appears in text
    lemma?: string;        // if wikilink is [[lemma|surface]], the lemma
    offsetInBlock?: number; // char offset of surface within textRaw (for positional replacement)
  };
};
```

### 6.1 Attestation from Wikilink Click

Stored in `TextfresserState.attestationForLatestNavigated`:

```
User clicks [[Kohlekraftwerk]] in a text paragraph
  ↓
UserEventInterceptor fires `PayloadFor<"WikilinkClicked">`
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
Uses selection.text as surface, selection.surroundingRawBlock for context,
selection.selectionStartInBlock for positional offset (avoids wrong-occurrence bugs)
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
| `Lemma` | V3 | Recon: classify word via LLM, disambiguate sense against existing entries (metadata `senseEmojis` lookup + Disambiguate prompt), wrap in wikilink, store result, notify user, fire background Generate. V5: bounds-check. V8: proper noun detection (nounClass), fullSurface expansion for multi-word proper nouns. V10: emoji-based disambiguation |
| `Generate` | V3 | Build DictEntry: LLM-generated sections (Morphem, Relation, Inflection, Translation) + header from Lemma output + Attestation; re-encounter detection (via Lemma's disambiguationResult); cross-ref propagation; serialize, move to Wörter, notify user. Fires automatically in background after Lemma (user stays on source text); also callable manually. V5: scroll-to-entry (deferred via wikilink click handler when running in background) |
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

The dictionary pipeline is split into two commands — **Lemma** (user-facing) and **Generate** (fires automatically in background after Lemma):

**V15/V16 update**: Lemma is now a two-phase flow with guarded prompt handling:
1. **Phase A (pre-prompt)**: reuse an existing `Worter` surface note when available for single-token selection; otherwise create a temporary working note under `Worter/.../unknown/...`, then insert a clickable wikilink immediately (`[[surface]]` or `[[target|surface]]`).
2. **Prompt guardrail stage**: run `PromptKind.Lemma`, validate output, and retry once on core guardrail violations.
3. **Phase B (post-prompt)**: disambiguate, resolve final generation target in `Worter` (surface host), resolve attestation rewrite target (closed-set may point to `Library`), rewrite source links (including temporary-link retarget + multi-span), then rename/delete temporary `unknown` note.

```
     Lemma (recon + disambiguation)                Generate (background, automatic)
┌───────────────────────────────────┐    ┌──────────────────────────────────────────┐
│ 1. Resolve attestation             │    │ 1. Check attestation + lemma result      │
│    (wikilink click or              │    │ 2. Resolve existing entries (uses Lemma's │
│     text selection)                │    │    disambiguationResult — no re-parsing)  │
│ 2. LLM classification             │    │ 3. If re-encounter: append attestation   │
│    → LinguisticUnit + POS         │───→│    If new: LLM request PER section:      │
│    → SurfaceKind + lemma          │ bg │      Header → dispatchHeaderFormatter()  │
│ 3. Disambiguate (V3):             │    │      Morphem → morphemeFormatterHelper() │
│    Find existing note for lemma    │    │      Relation → formatRelationSection()  │
│    (vam.getSplitPathsToExisting    │    │      Inflection → formatInflectionSection│
│     FilesWithBasename)             │    │      Translation → PromptKind.WordTranslation │
│    Read metadata → match POS       │    │      Attestation → source ref (no LLM)  │
│    If entries exist for this POS:  │    │ 4. Store senseEmojis in metadata   │
│      Call Disambiguate prompt      │    │ 5. Propagate inverse relations to targets│
│      → matchedIndex or null        │    │                                          │
│    Else: null (new sense)          │    │ 6. Propagate noun inflections            │
│ 4. Wrap surface in wikilink        │    │ 7. Serialize (+ noteKind) → moveToWörter│
│ 5. Store result in state           │    │ 8. Single vam.dispatch()                 │
│ 6. Notify: "✓ lemma (POS)"        │    │                                          │
│ 7. Fire background Generate ──────│───→│ User stays on source text.               │
│    (fire-and-forget)               │    │ Deferred scroll on wikilink click.       │
└───────────────────────────────────┘    └──────────────────────────────────────────┘
```

### 8.1 Lemma Command (V3)

The user selects a word and calls "Lemma". This is the classification + disambiguation step.

**Source**: `src/commanders/textfresser/commands/lemma/lemma-command.ts`

#### V15 Safe-Linking Flow

Lemma now runs in two dispatch phases to avoid dead links:

1. **Phase A (pre-prompt)**:
   - If single-token surface resolves to existing `Worter` note, reuse it.
   - Otherwise create temporary working note at `Worter/.../unknown/.../{surface}.md`.
   - Dispatch: optional `UpsertMdFile(unknown-working-note)` + source `ProcessMdFile` with temporary wikilink.
2. **Phase B (post-prompt)**:
   - Run `PromptKind.Lemma` and apply guardrails:
     - reject same-surface `lemma` for `Lexem + Verb + Inflected` when separable-prefix evidence exists in context;
     - reject same-surface `lemma` for `Lexem + Adjective + Inflected` when comparative/superlative-like surface is detected;
     - drop `contextWithLinkedParts` if stripped text differs from source context.
   - If core guardrail fails, run exactly one retry; if still invalid, continue with best-effort output and warning logs.
   - Run `disambiguateSense` (preferred path = resolved final target).
   - Resolve final target with deterministic policy:
     - Generation target note always resolves to a `Worter` surface host path.
     - Closed-set Lexem POS (`Pronoun`, `Article`, `Preposition`, `Conjunction`, `Particle`, `InteractionalUnit`) still resolve attestation rewrite links to `Library` leaves.
   - If placeholder exists and final differs:
     - rename placeholder to final when final does not exist;
     - for `unknown` temporary notes, delete placeholder when final already exists.
   - Track `latestLemmaTargetOwnedByInvocation` for the resolved final target and pass it into background-generate cleanup policy.
   - Rewrite source wikilink(s) to final target, including second-pass temporary-link retargeting and multi-span expansion.
   - If user is currently on placeholder note and final target differs, navigate to final target.

#### Attestation Resolution

Lemma tries two sources (in order):
1. `state.attestationForLatestNavigated` — from a prior wikilink click
2. `buildAttestationFromSelection(selection)` — from the current text selection

#### Lemma Idempotence Cache (10s)

Before running Phase A/Phase B, Lemma builds an invocation key from:
- source file path
- source ref (`![[file#^block|^]]`)
- selected surface
- target offset in block

If the same key was processed successfully in the last 10 seconds, Lemma does not re-run source rewrites or LLM classification. Instead it:
1. hydrates `latestLemmaResult` + `latestResolvedLemmaTargetPath` from cache
2. reads the target dict note and checks expected V3 sections on the matched entry
3. if complete: silently no-op
4. if incomplete: silently re-trigger background Generate to backfill missing sections

The cooldown starts only after successful Lemma completion.

#### LLM Classification

**Input** (via `PromptKind.Lemma`): `{ surface: string, context: string }`

**Structured output** (Zod schema in `schemas/lemma.ts`):
```typescript
{
  linguisticUnit: LinguisticUnitKind,  // "Lexem" | "Phrasem" | "Morphem"
  pos?: POS | null,                    // only for Lexem
  surfaceKind: SurfaceKind,            // "Lemma" | "Inflected" | "Variant"
  lemma: string,                       // dictionary form
  nounClass?: "Common" | "Proper" | null, // V8: only for pos: "Noun"
  genus?: "Maskulinum" | "Femininum" | "Neutrum" | null, // V12: only for pos: "Noun"
  fullSurface?: string | null,         // V8: full proper noun span when it extends beyond selected surface
  senseEmojis: string[],          // V11: 1-3 emojis for sense disambiguation
  ipa: string,                         // V11: IPA pronunciation of lemma
}
```

#### Wikilink Wrapping

After classification, Lemma wraps the surface in a wikilink in the source block:
- Same lemma: `Schuck` → `[[Schuck]]`
- Different lemma: `lief` → `[[laufen|lief]]`
- V8 proper noun expansion: `Bank` (selected) in "Deutsche Bank" → `[[Deutsche Bank]]` (wraps full proper noun)

When `attestation.target.offsetInBlock` is available (selection-based attestation), uses **positional slice-based replacement** (`rawBlock.slice(0, offset) + wikilink + rawBlock.slice(offset + surface.length)`) to avoid replacing the wrong occurrence when the same word appears multiple times in a line. Falls back to `String.replace()` when offset is unavailable (wikilink-click attestation).

**V8 fullSurface expansion**: When the LLM returns `fullSurface` (proper noun extending beyond selected surface), `expandOffsetForFullSurface()` computes the expanded offset by finding the surface position within `fullSurface`, then verifies the expanded span matches in the raw block. On verification failure (e.g., text mismatch), gracefully falls back to wrapping just the selected surface.

Uses `ProcessMdFile` with a transform function: exact `rawBlock` replacement first, then block-ID/surface fallbacks to avoid losing wikilink insertion when the captured raw line differs slightly from current file content.

#### State Update

Result stored as `TextfresserState.latestLemmaResult`:
```typescript
type LemmaResult = ResolvedLemma & {
  attestation: Attestation;           // command-local context
  disambiguationResult: {             // V3: sense matching outcome
    matchedIndex: number;             // index of existing entry (re-encounter)
  } | null;                           // null = new sense or first encounter
  precomputedSenseEmojis?: string[];  // V10: emoji description from Disambiguate when new sense detected
};
```

`ResolvedLemma` is the semantic DTO from lexical generation. `LemmaResult` is now just that DTO plus command-local attestation/disambiguation state.

#### Polysemy Disambiguation (V3)

After LLM classification, Lemma checks whether this sense is already covered by an existing entry:

```
LLM classification → lemma + POS
  ↓
vam.getSplitPathsToExistingFilesWithBasename(lemma) → find existing note(s)
  (vault-wide by default; pass { folder } to narrow scope)
  ↓
If no note → disambiguationResult = null (first encounter, done)
  ↓
Read note content → noteMetadataHelper.parse() → extract entries metadata
  ↓
Filter entries by matching unitKind + POS (ignoring surfaceKind, so LX-LM-NOUN-* and LX-IN-NOUN-* both match)
  (V5: parse failures are logged: `[disambiguate] Failed to parse entry ID: "..."`)
  ↓
If no entries for this POS → disambiguationResult = null (new sense, skip Disambiguate call)
  ↓
Build senses: Array<{ index, senseEmojis, ipa?, senseGloss?, unitKind, pos?, genus? }> from metadata + parsed entry IDs
  (source of truth: `meta.entity`; no top-level mirror fallbacks)
  (`senseGloss` fallback order: `meta.entity.senseGloss` → first non-empty Translation line)
  (V10+: entries without senseEmojis are treated as new-sense candidates)
  ↓
Call PromptKind.Disambiguate with { lemma, context, senses }
  ↓
Returns { matchedIndex: number | null, senseEmojis?: string[] | null }
  ↓
V5 bounds check: if matchedIndex is not in validIndices → treat as new sense
  ↓
  matchedIndex (in range) → re-encounter (disambiguationResult = { matchedIndex })
  null (or out of range) → new sense (disambiguationResult = null)
    + if senseEmojis returned → store as LemmaResult.precomputedSenseEmojis
```

**Key optimizations**:
- The Disambiguate LLM call is skipped entirely when no note exists (first encounter) or no entries with matching POS exist (first sense for this POS)
- **V10**: When Disambiguate returns `matchedIndex: null` (new sense), it also returns an `senseEmojis` (1-3 emojis). This is stored as `LemmaResult.precomputedSenseEmojis` and used by Generate as the source for `meta.entity.senseEmojis`.
- **V5**: `matchedIndex` is bounds-checked against `validIndices` — out-of-range values are treated as new sense (prevents LLM hallucinating invalid indices)

The disambiguation result is stored in `LemmaResult.disambiguationResult` and consumed by Generate's `resolveExistingEntry` step, which no longer needs to re-parse or re-match.

**VAM API (V3 addition)**: `vam.getSplitPathsToExistingFilesWithBasename(basename: string, opts?: { folder?: SplitPathToFolder }): SplitPath[]` — returns `SplitPath[]` for files matching the basename. Vault-wide by default; pass `{ folder }` to narrow scope (typically the Wörter sharded tree: `Worter/Ordered/{target_lang}/...`).

### 8.2 Generate Command (V3)

Generate fires automatically in the background after a successful Lemma command. The user stays on the source text — no manual navigation or command invocation needed. The Textfresser commander finds (or creates) the target dict note via `vam.findByBasename()`, reads its content, builds a synthetic `CommandInput`, and runs the Generate pipeline. Generate can also be called manually for standalone use.

**Source**: `src/commanders/textfresser/commands/generate/generate-command.ts`

#### Pipeline

```
checkAttestation → checkEligibility → checkLemmaResult
  → resolveExistingEntry (parse existing entries, use Lemma's disambiguationResult for re-encounter detection)
  → generateSections (async: LLM calls, or attestation append for re-encounters)
  → propagateGeneratedSections (core propagation + source-note separability decoration)
  → serializeEntry (includes noteKind + entity metadata in single metadata upsert)
  → moveToWorter
  → addWriteAction
```

`moveToWorter` keeps dict-entry generation in `Worter` surface-host notes (including closed-set encounters). It skips rename when the active file is already at destination.

Sync `Result` checks transition to async `ResultAsync` at `generateSections`.

`checkEligibility` accepts `noteKind: DictEntry` and missing `noteKind` as before, and also allows Textfresser-structured propagation notes even when a foreign `noteKind` is present. Structured-note detection now uses real parsers (`dictNoteHelper.parse()` and `parsePropagationNote()`) rather than marker-string heuristics, so entry-shaped propagation notes are eligible while marker-only stubs without an entry block id are rejected.

#### Re-Encounter Detection (V3)

`resolveExistingEntry` parses the active file via `dictNoteHelper.parseWithLinguisticWikilinks()` (wired with Librarian lookup + basename parser when available) and uses `lemmaResult.disambiguationResult` (set during Lemma's disambiguation step) to determine the path:

- **`disambiguationResult.matchedIndex` set** → find entry by unitKind + POS + index (ignoring surfaceKind), set `matchedEntry`, take `isExistingEntry` path in `generateSections`
- **`disambiguationResult` is null** → new sense; `nextIndex` computed via `dictEntryIdHelper.nextIndex()` for the new entry

Matching ignores surfaceKind so that inflected encounters (e.g., "Schlosses" → `LX-IN-NOUN-`) correctly resolve to the existing lemma entry (`LX-LM-NOUN-`).

For parse-time linguistic link DTO consumers, `dictNoteHelper.parseWithLinguisticWikilinks()` returns the same entries augmented with section-context-classified wikilink DTOs (source/intent/target-kind and target-ref classification) while leaving note serialization unchanged.

Propagation-only stubs are explicitly excluded from re-encounter matching: if the matched entry has propagation sections (e.g., Morphology/Relation/Tags/Inflection) but lacks both Attestation and Translation, `resolveExistingEntry` drops that stub and forces full Generate path. This prevents propagation targets from getting stuck as permanent stubs.

#### Section Generation

`generateSections` has two paths:

**Path A (re-encounter)**: If `matchedEntry` exists, append attestation ref (deduped), then check expected V3 sections. If sections are complete, keep fast path (no LLM). If some V3 sections are missing, Generate calls only the missing section generators and merges only those missing sections into the existing entry.

**Path B (new entry)**: Determines applicable sections via `getSectionsFor()`, filtered to the **V3 set**: Header, Tags, Morphem, Morphology, Relation, Inflection, Translation, Attestation. Header is built from LemmaResult fields (no LLM call).
For closed-set Lexem entries, Generate ensures a non-LLM lightweight membership DictEntry under the same `Worter` surface-host note. That entry gets its own block ID and contains a `closed_set_membership` section with a Library pointer plus a closed-set tag. Library target selection is POS-aware from Library suffix hierarchy and deterministic (lexical basename tie-break).
Section-level wikilink behavior assumptions are centralized in `linguistic-wikilink-context.ts` (source/intent/target-kind/propagation eligibility), and propagation surface-kind routing reads from that policy instead of hardcoded per-step checks.

All LLM calls are fired in parallel via `Promise.allSettled` (none depend on each other's results). Enrichment now has a fallback metadata path, and section prompts degrade gracefully (including Translation): failures are logged, recorded in `failedSections`, and entry creation continues. This prevents empty-note outcomes when upstream API calls fail. Results are assembled in correct section order after all promises settle. Applicable sections:

| Section | LLM? | PromptKind | Formatter | Output |
|---------|------|-----------|-----------|--------|
| **Header** | No | — | `dispatchHeaderFormatter()` | `{emoji} [[lemma]], [{ipa}](youglish_url)` → `DictEntry.headerContent`. For nouns, article genus priority is: NounEnrichment genus, then noun-inflection genus fallback; when resolved, output is `{emoji} {article} [[lemma]], [{ipa}](youglish_url)` via `de/lexem/noun/header-formatter`. Dispatch routes by POS; common formatter for non-nouns or unresolved noun genus. `emoji` is rendered from the full `senseEmojis` sequence in order. No LLM call. Sense signals are stored on canonical `meta.entity` (`senseEmojis`, `ipa`). |
| **Morphem** | Yes | `Morphem` | `morphemeFormatterHelper.formatSection()` | `[[kohle]]\|[[kraft]]\|[[werk]]` → `EntrySection` |
| **Morphology** | No extra LLM call (reuses `Morphem` output) | — | `generateMorphologySection()` | Localized `derived_from`/`consists_of` markers (German: `Abgeleitet von:`, `Besteht aus:`) and verb-prefix equation lines (verbs only); `derived_from` remains explicit even when an equation is present unless it is equivalent to the equation base. Structured payload is also captured for propagation. |
| **Relation** | Yes | `Relation` | `formatRelationSection()` | `= [[Synonym]], ⊃ [[Hypernym]]` → `EntrySection`. Raw output also stored for propagation. |
| **Inflection** | Yes | `NounInflection` (nouns) or `Inflection` (other POS) | `formatInflection()` / `formatInflectionSection()` | `N: das [[Kohlekraftwerk]], die [[Kohlekraftwerke]]` → `EntrySection`. Nouns use structured cells (case×number with article+form); other POS use generic rows. Noun cells also feed `propagateInflections`. |
| **Translation** | Yes | `WordTranslation` | — (string pass-through) | Translates the lemma word (using attestation context for disambiguation only) → `EntrySection`. Optional at runtime: failures are recorded and generation continues to avoid empty notes. V6: changed from `PromptKind.Translate` (which translated the full sentence) to `WordTranslation` (input: `{word, pos, context}`, output: concise 1-3 word translation). |
| **Attestation** | No | — | — | `![[file#^blockId\|^]]` from `lemmaResult.attestation.source.ref` → `EntrySection` |
| **Tags** | Yes | POS-specific `Features*` prompt (`FeaturesNoun`, `FeaturesVerb`, ...) | — (compound tag string) | `#pos/feature1/feature2` → `EntrySection`. Non-inflectional grammatical features (e.g., maskulin, transitiv/stark), with trim/lowercase normalization and global dedupe of path parts. Optional — entry still created if Features prompt fails. Only for Lexem POS. |

Each `EntrySection` gets:
- `kind`: CSS suffix from `cssSuffixFor[DictSectionKind]` (e.g., `"definition"`, `"synonyme"`, `"morpheme"`, `"flexion"`, `"translations"`)
- `title`: Localized from `TitleReprFor[sectionKind][targetLang]`

#### Entry ID

Built via `dictEntryIdHelper.build()`. Generate uses `nextIndex` computed from existing entries:
- Lexem: `LX-{SurfaceTag}-{PosTag}-{nextIndex}` (e.g., `LX-LM-NOUN-1`, `LX-LM-NOUN-2`)
- Phrasem/Morphem: `{UnitTag}-{SurfaceTag}-{nextIndex}`

#### Serialization & Dispatch

`serializeEntry` → `dictNoteHelper.serialize(allEntries)` → note body (serializes ALL entries, existing + new), then merges `noteKind` into the entry metadata and calls `noteMetadataHelper.upsert(fullMeta)` in a **single** upsert (avoids metadata overwrite bug where a second `upsert` call would discard the `entries` key written by the first).
`moveToWorter` → `RenameMdFile` action to sharded Wörter folder
Final `ProcessMdFile` writes the content → all actions (including propagation actions) dispatched via `vam.dispatch()`

### 8.3 Prompt Configuration Matrix

Different prompts are needed depending on:

| Dimension | Values | Effect |
|-----------|--------|--------|
| **TargetLanguage** | German, English, ... | Language of the dictionary |
| **KnownLanguage** | Russian, English, ... | User's native language |
| **PromptKind** | Lemma, LexemEnrichment, NounEnrichment, PhrasemEnrichment, Disambiguate, Morphem, Relation, Inflection, NounInflection, Translate, WordTranslation, Features* | What task the LLM performs |

Section applicability (which sections a DictEntry gets) is determined by `LinguisticUnitKind` + `POS` + optional `nounClass` via `getSectionsFor()` in `src/commanders/textfresser/targets/de/sections/section-config.ts`:
- **Lexem**: POS-dependent with `Morphology` enabled for all POS (e.g., Nouns get Morphem + Morphology + Inflection + Relation; Conjunctions get core + Morphology)
- **Lexem + Noun + Proper** (V8): Core sections only (Header, Translation, Attestation, FreeForm) — no Inflection, Morphem, Morphology, Relation
- **Phrasem**: Header, Translation, Attestation, Relation, FreeForm
- **Morphem**: Header, Attestation, FreeForm

For non-Lexem units, `pos` is passed to LLM prompts as the `linguisticUnit` name (e.g., `"Phrasem"`) so the LLM understands the input is a multi-word expression rather than a single word.

### 8.4 Future Enhancements (Not in V3)

- ~~**Full meaning resolution**~~: Implemented in V3 as Disambiguate prompt. V10: replaced text-based `semantics` with emoji-based differentiation (`senseEmojis`).
- **Multi-word selection**: Lemma handling phrasem attestations from multi-word selections
- **Deviation section**: Additional LLM-generated section for irregular forms and exceptions
- ~~**Scroll to latest updated entry**~~: Implemented in V5. `scrollToTargetBlock()` finds `^{blockId}` line and calls `ActiveFileService.scrollToLine()`. For background Generate: deferred via wikilink click handler — `awaitGenerateAndScroll()` waits for the in-flight promise, then scrolls if user is on the target note.
- ~~**Disambiguate prompt returning semantic info for new senses**~~: V5: returned text `semantics` gloss. V10: replaced with `senseEmojis` (1-3 emoji array). V11: `senseEmojis` moved to Lemma prompt output (Header prompt eliminated), now persisted in canonical `meta.entity`.

---

## 9. Cross-Reference Propagation

> **Status**: implemented.

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
- **Morphem**: `propagateMorphemes` maintains localized `used in` backlinks on Morphem notes (German marker: `Verwendet in:`) for bound morphemes (`Suffix`, `Interfix`, `Suffixoid`, etc.) and prefixes not covered by a generated verb-prefix equation.
- **Morphology**: `propagateMorphologyRelations` writes localized morphology backlinks to Lexem targets (German markers: `Abgeleitet von:`, `Besteht aus:`, `Verwendet in:`) and writes verb-prefix equations to prefix Morphem notes.
- **Attestation**: No propagation — contexts are per-encounter.
- **Inflection**: **Noun propagation** via `propagateInflections` — creates/updates one inflection entry per form with merged tags in inflected-form notes (see section 9.5). Other POS: no propagation.
- **Header, FreeForm, Deviation**: No propagation.

### 9.4 Implementation

**Source**: `src/commanders/textfresser/commands/generate/steps/propagate-generated-sections.ts`, `src/commanders/textfresser/commands/generate/steps/propagate-relations.ts`, `src/commanders/textfresser/commands/generate/steps/propagate-morphology-relations.ts`, `src/commanders/textfresser/commands/generate/steps/propagate-morphemes.ts`, `src/commanders/textfresser/commands/generate/steps/decorate-attestation-separability.ts`, `src/commanders/textfresser/commands/generate/steps/propagate-inflections.ts`, `src/commanders/textfresser/common/target-path-resolver.ts`

The propagation facade (`propagateGeneratedSections`) runs after `generateSections` in the Generate pipeline. Runtime path is core-only: `propagateCore`, then `decorateAttestationSeparability` as a shared post-propagation source-note step. `propagateRelations` uses the raw `relations` output captured during section generation (not re-parsed from markdown).

`propagateCore` folds all scoped propagation actions to one write per target note. The fold contract accepts `ProcessMdFile` in both payload shapes (`transform` and `before/after`) and accepts non-null `UpsertMdFile` content as deterministic transform input, preserving original action order per target path.

Propagation note-adapter warning logs are sampled (`first-N + periodic`) for repeated cases (embedded/unparseable wikilinks) to keep logs actionable on large notes.
Relation-section `targetLemma` extraction in the propagation note-adapter now reuses linguistic wikilink parsing policy. Explicit `Worter/...` path tokens are collapsed to semantic lemma keys, and explicit `Library/...` tokens are collapsed when `parseLibraryBasename` is provided; otherwise Library tokens stay conservative/unresolved while preserving original rendered wikilink tokens for roundtrip safety.
Morphology equation parsing applies the same policy for basic wikilinks, collapsing known-root path targets to semantic lemma parts (`lhsParts`/`rhs`) to keep equation identity deterministic across legacy full-path and basename forms.
Morphology backlink parsing also canonicalizes basic known-root wikilinks (`Worter/...` and `Library/...`) to compact targets while preserving alias text; anchor/exotic backlink tokens remain passthrough-preserved for roundtrip safety.
`parsePropagationNote()` accepts optional linguistic-parse deps (`lookupInLibraryByCoreName`, `parseLibraryBasename`) so bare Library basenames (for example `[[wir-personal-pronomen-de]]`) can resolve semantically during propagation parse when Librarian utilities are available.

Both `propagateRelations` and `propagateInflections` use a **shared path resolver** (`resolveTargetPath`) that performs two-source lookup with healing:

```
resolveTargetPath(word, desiredSurfaceKind, vamLookup, librarianLookup):
  1. vamLookup(word)         → if found, use existing path
  2. librarianLookup(word)   → if found, use as-is (Library has own invariants)
  3. computeShardedFolderParts(word) → fallback: compute new sharded path

  Healing (Worter paths only):
    If existing is in inflected/ but desired is lemma → RenameMdFile to lemma path
    If existing is in lemma/ but desired is inflected → use as-is (lemma files can hold both)
```

Librarian resolvers are wired in `main.ts` after Librarian init via `Textfresser.setLibrarianResolvers()`, providing both core-name lookup (`LeafMatch[]` → `SplitPathToMdFile[]`) and basename decomposition (`parseLibraryBasename`). Before Librarian init, state defaults are `lookupInLibrary = () => []`, `parseLibraryBasename = () => null`, and `TextfresserState.isLibraryLookupAvailable = false`; library-dependent routing paths degrade to Worter-only behavior until resolvers are available.

```
generateSections captures raw relation output (ParsedRelation[])
  ↓
propagateRelations:
  For each relation { kind, words[] }:
    Compute inverseKind via INVERSE_KIND map
    For each target word (skip self-references):
      1. resolveTargetPath(word) → { splitPath, healingActions }
      2. Emit healingActions (RenameMdFile if inflected→lemma healing needed)
      3. buildPropagationActionPair(splitPath, transform) → [UpsertMdFile, ProcessMdFile]
         transform function:
           a. Finds existing relation section marker in target note
           b. Appends inverse relation line (deduped)
           c. Or creates new relation section if none exists
  ↓
Propagation VaultActions (including healing) added to ctx.actions
  ↓
All dispatched in single vam.dispatch() alongside source note actions
```

**Key design decisions**:
- Uses `ProcessMdFile` with `transform` function for atomic read-then-write on target notes
- `UpsertMdFile` with `content: null` ensures target file exists before processing
- Skips propagation for re-encounters (no new relations generated)
- Deduplicates: won't add `= [[Schuck]]` if it already exists in the target's relation section
- **Two-source lookup**: VAM → Librarian → computed path. Reuses existing file location instead of blindly computing sharded paths
- **inflected→lemma healing**: If a target word is found in `inflected/` but needs a lemma entry (e.g., relation propagation), the file is renamed to the lemma path. The invariant: `inflected/` folders contain ONLY inflection entries

### 9.5 Inflection Propagation (Nouns)

**Source**: `src/commanders/textfresser/commands/generate/steps/propagate-inflections.ts`

When Generate processes a noun, the `NounInflection` prompt returns noun `genus` plus structured cells (case × number × article × form). After formatting the Inflection section, `propagateInflections` creates or updates **one inflection entry per target form** in inflected-form notes.

```
generateSections captures NounInflection output { genus, cells[] } (8 cells: 4 cases × 2 numbers)
  ↓
propagateInflections:
  Group cells by form word
  For each form:
    If form === lemma → skip (main entry already lives on that note)
    If form !== lemma:
      Build one header: "#Inflection/Noun/<genusLabel?> for: [[lemma]]"
      (fallback to "#Inflection/Noun for: [[lemma]]" when genus is missing)
      Build deduped/sorted tags: "#Nominativ/Plural #Akkusativ/Plural ..."
      1. resolveTargetPath(form, desiredSurfaceKind: Inflected) → { splitPath, healingActions }
      2. Emit healingActions (if any)
      3. buildPropagationActionPair(splitPath, transform) → [UpsertMdFile, ProcessMdFile]
         transform:
           a. merge tags into existing new-format entry (same header)
           b. ensure/update Tags section with normalized tag line
  ↓
Propagation VaultActions (including healing) added to ctx.actions
```

**Propagated entry format**: Single DictEntry per target form:
```markdown
#Inflection/Noun/Maskulin for: [[Kraftwerk]] ^LX-IN-NOUN-1
<span class="entry_section_title entry_section_title_tags">Tags</span>
#Nominativ/Plural #Akkusativ/Plural #Genitiv/Plural
```

**Key design decisions**:
- **One entry per form/POS**: All case/number combos are represented as tags in one entry
- **Genus source + fallback**: propagation prefers genus from `NounInflection` output, falls back to `NounEnrichment` when needed, and still degrades to `#Inflection/Noun for: [[lemma]]` if both are missing
- **Same-note skip**: When form === lemma, cells are skipped entirely (the main entry already covers this note)
- Deterministic tag ordering: case order + number order, with dedup + localization normalization
- Same UpsertMdFile + ProcessMdFile pattern as relation propagation
- Skipped for re-encounters and non-noun POS

---

## 10. Prompt-Smith System

**Location**: `src/packages/independent/lexical-generation/internal/prompt-smith/`

### 10.1 Overview

Prompt-smith is a **build-time prompt management system** that:
- Composes prompts from modular parts (agent role, task description, examples)
- Validates examples against Zod schemas at build time
- Generates type-safe TypeScript exports
- Supports multi-language prompt lookup with fallback

### 10.2 Directory Layout

```
src/packages/independent/lexical-generation/internal/prompt-smith/
├── prompt-parts/                    # Human-written source prompts
│   └── [target-lang]/[known-lang]/[prompt-kind]/
│       ├── agent-role.ts            # LLM persona instruction
│       ├── task-description.ts      # Task specification
│       └── examples/
│           ├── to-use.ts            # Examples embedded in prompt
│           └── to-test.ts           # Extra examples for validation only
│
├── codegen/
│   ├── consts.ts                    # PromptKind enum (includes Lemma, LexemEnrichment, NounEnrichment, PhrasemEnrichment, Disambiguate, Relation, Inflection, WordTranslation, Features*)
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
│   ├── lemma.ts                     # Lemma: {surface,context} → {linguisticUnit,pos?,surfaceKind,lemma,nounClass?,fullSurface?}
│   ├── disambiguate.ts              # Disambiguate: {lemma,context,senses[{index,senseEmojis,unitKind,pos?,genus?}]} → {matchedIndex:number|null, senseEmojis?:string[]|null}
│   ├── word-translation.ts          # WordTranslation: {word,pos,context} → string
│   ├── relation.ts                  # Relation: {word,pos,context} → {relations[{kind,words[]}]}
│   ├── inflection.ts                # Inflection: {word,pos,context} → {rows[{label,forms}]}
│   └── noun-inflection.ts           # NounInflection: {word,context} → {cells[{case,number,article,form}]}
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
// src/commanders/textfresser/llm/prompt-runner.ts
class PromptRunner {
  generate<K extends PromptKind>(kind: K, input: UserInput<K>): ResultAsync<AgentOutput<K>, ApiServiceError> {
    const prompt = PROMPT_FOR[this.languages.target][this.languages.known][kind];
    const schema = SchemasFor[kind].agentOutputSchema;
    return this.apiService.generate({ schema, systemPrompt: prompt.systemPrompt, userInput: input })
      .map(result => result as AgentOutput<K>);
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
| **Bilingual** | Translate, WordTranslation | Yes — output language varies by user's known language |
| **Target-language-only** | Morphem, Lemma, Disambiguate, Relation, Inflection, NounInflection | No — linguistic analysis is purely about target language structure |

For **target-language-only** prompts, only the mandatory `english/` known-language path is created. The codegen fallback mechanism automatically reuses this English prompt for other known languages (e.g., Russian), since the prompt content is identical regardless of the user's native language.

### 10.8 Adding a New Language or PromptKind

**New language pair** (e.g., French→English):
```bash
mkdir -p src/packages/independent/lexical-generation/internal/prompt-smith/prompt-parts/french/english/translate/examples
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
- **Returns** `ResultAsync<T, ApiServiceError>` — no throwing; callers chain with `.mapErr()`
- **Retry with exponential backoff** (`src/stateless-helpers/retry.ts`): 3 attempts, 1s base delay, 2× multiplier, ±20% jitter. Retries on `APIConnectionError`, HTTP 429 (rate limit), and 5xx (server errors). Cache lookup runs once before the retry loop. Non-retryable errors (e.g., 400, 401) fail immediately.

---

## 11. Textfresser Commander Internals

**Sources**:
- `src/commanders/textfresser/textfresser.ts` (thin public orchestrator)
- `src/commanders/textfresser/state/textfresser-state.ts` (state types + initialization)
- `src/commanders/textfresser/orchestration/` (Lemma flow, background generate, handlers)

### 11.1 Thin Orchestrator Split

`Textfresser` now keeps only public API wiring:

- constructor creates state via `createInitialTextfresserState(...)`
- `executeCommand(...)`:
  - `Lemma` delegates to `executeLemmaFlow(...)`
  - `Generate` / `TranslateSelection` delegate to `actionCommandFnForCommandKind`
- `createHandler()` delegates to `createWikilinkClickHandler(...)`
- `getState()` + `setLibrarianResolvers(...)` + `clearLibrarianLookup()`
- private `scrollToTargetBlock()` UX helper

State is owned by `TextfresserState` in `state/textfresser-state.ts`:

- `latestLemmaResult`
- `latestResolvedLemmaTargetPath`
- `latestLemmaTargetOwnedByInvocation`
- `latestLemmaPlaceholderPath`
- `latestLemmaInvocationCache`
- `inFlightGenerate` / `pendingGenerate`
- `targetBlockId`
- `latestFailedSections`
- `isLibraryLookupAvailable`

### 11.2 Unified Lemma Path

There is one Lemma execution path:

```
Textfresser.executeCommand("Lemma", ...)
  -> executeLemmaFlow(...)
     -> cache key / idempotence check (lemma-cache.ts)
     -> runLemmaTwoPhase(...) (run-lemma-two-phase.ts)
       Phase A: pre-prompt safe link + optional placeholder
       Phase B: final target rewrite + placeholder rename/delete
     -> persist cache entry
     -> requestBackgroundGenerate(...)
```

Legacy command-map Lemma execution was removed from `commands/index.ts`; the action command map now includes only:

- `Generate`
- `TranslateSelection`

### 11.3 Background Generate Coordinator

Background generation is encapsulated in:

- `orchestration/background/background-generate-coordinator.ts`

Key behavior:

- single in-flight Generate
- latest-only pending queue slot
- **state snapshot**: `PendingGenerate` captures `lemmaResult` at request time; `runBackgroundGenerate` creates a shallow copy of `TextfresserState` with the frozen `latestLemmaResult`, preventing the next Lemma from overwriting state before the current Generate reads it. Output side-effects (`targetBlockId`, `latestFailedSections`) are propagated back to live state after execution.
- postcondition: generated note must be non-empty
- rollback empty targets via `TrashMdFile` only when cleanup policy allows it (`targetOwnedByInvocation || !targetExistedBefore`)
- propagate generated entry id back into `latestLemmaInvocationCache`
- deferred-scroll support via `awaitGenerateAndScroll(...)`

### 11.4 Wikilink Click Handler

Wikilink click handling moved to:

- `orchestration/handlers/wikilink-click-handler.ts`

Behavior is unchanged:

- update `attestationForLatestNavigated`
- if clicked target matches in-flight background Generate target, trigger deferred `awaitGenerateAndScroll(...)`
- return `HandlerOutcome.Passthrough`

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

## 13. Work in Progress

### Current Focus

**V10 — Emoji-as-Semantic-Differentiator**: Replaced text-based `semantics`/`Definition` with emoji-based differentiation.

- Dropped `DictSectionKind.Definition` and `PromptKind.Semantics` entirely
- V11: Header prompt eliminated — `senseEmojis` and `ipa` moved to Lemma prompt output
- Disambiguate prompt uses emoji-based senses (senseEmojis + unitKind + pos + genus)
- `meta.entity.senseEmojis: string[]` replaces `meta.semantics: string`
- `LemmaResult.precomputedSenseEmojis` replaces `precomputedSemantics`
- Entries without `senseEmojis` are treated as new-sense candidates

### Deferred Items

- **Deviation section**: Additional LLM-generated section for irregular forms and exceptions
- **PhrasemeKind enrichment**: Sub-classification of phrasemes (collocation strength, type)
- **Multi-word selection**: Lemma handling phrasem attestations from multi-word selections
- **Other POS inflection propagation**: Extend inflection propagation beyond nouns

---

## 15. LinguisticUnit DTO — Source of Truth Type System

> **Path note**: This section still shows some pre-migration example paths from the old standalone `src/linguistics/` layout. The current implementation lives under `src/packages/independent/linguistics/src/`, and public app-facing primitives come from `src/packages/independent/lexical-generation/`.

> **Status**: V9+ — implemented (German + Noun/Verb/Adjective full features; remaining POS/unit kinds are stubs). Canonical DTO is `DictEntry.meta.entity` (`Entity<L,U,S,P>` with `features.lexical` + `features.inflectional`). `meta.linguisticUnit` is auxiliary typed surface metadata.

### 15.1 Problem

The `DictEntry` type was originally a **serialization artifact**, not a domain model:

```typescript
// Before V9 — stringly typed, no structure
type DictEntry = {
  id: string;                       // has ParsedDictEntryId... but it's string here
  headerContent: string;            // emoji + article + [[lemma]] + IPA — all flattened
  sections: EntrySection[];         // kind: string, content: string — all structure lost
  meta: Record<string, unknown>;    // no schema
};
```

LLM outputs are typed (e.g., `AgentOutput<"Morphem">` → `{ morphemes[] }`), but formatters convert them to strings, and all structure is lost. V9 introduces a Zod-schema-based DTO as the source of truth for what a DictEntry represents. (V11: Header is no longer an LLM call — built from LemmaResult fields.)

### 15.2 Architecture: Symmetric Discriminated Unions

Every DictEntry describes a **LinguisticUnit**. The type system is built on three levels of discrimination:

```
LinguisticUnit<L>
  ├── kind (1st discriminant: "Lexem" | "Phrasem" | "Morphem")
  │    └── surface
  │        ├── surfaceKind (2nd discriminant: "Lemma" | "Inflected" | "Variant")
  │        │    └── features
  │        │        └── (3rd discriminant: pos | phrasemeKind | morphemeKind)
  │        │             └── language-specific feature fields
```

All three unit kinds follow the **same structural pattern**:

| UnitKind | 3rd discriminant | Example Full features | Example Ref features |
|----------|-----------------|----------------------|---------------------|
| **Lexem** | `pos` | `{ pos: "Noun", genus: "Neutrum", nounClass: "Common" }` | `{ pos: "Noun" }` |
| **Phrasem** | `phrasemeKind` | `{ phrasemeKind: "Collocation", strength: "Bound" }` | `{ phrasemeKind: "Collocation" }` |
| **Morphem** | `morphemeKind` | `{ morphemeKind: "Prefix", separability: "Inseparable" }` | `{ morphemeKind: "Prefix" }` |

### 15.3 SurfaceKind Controls Feature Depth

`surfaceKind` determines whether `features` is **Full** (all fields) or **Ref** (just the discriminant):

- **Lemma** → Full features: `{ pos: "Noun", genus: "Neutrum", nounClass: "Common" }`
- **Inflected** → Ref features: `{ pos: "Noun" }` (genus/nounClass live on the lemma entry)
- **Variant** → Ref features: `{ pos: "Noun" }` (same as Inflected)

### 15.4 Language Scoping

**TargetLanguage** is the outermost scope. It defines:

1. **What feature fields exist per POS/morphemeKind** — German Noun has `genus`, English Noun does not
2. **What feature values are available** — German `genus`: `"Maskulinum"|"Femininum"|"Neutrum"`
3. **What morpheme kinds exist** — Hebrew has vowel patterns, German has separable prefixes

**Phrasem is language-independent** — `phrasemeKind` and its features (e.g., collocation `strength`) are universal. No `L` param needed.

Layer structure (implemented):
```
src/packages/independent/lexical-generation/
├── primitives.ts                    ← public language-independent lexical primitives for textfresser
└── internal/
    ├── contracts/de/                ← runtime DE lemma/generation contracts
    └── linguistics/                 ← internal schema layer, not consumed directly by textfresser
        ├── common/
        │   ├── enums/core.ts            — LinguisticUnitKind, SurfaceKind
        │   ├── enums/.../pos.ts         — POS, PosTag (10 parts of speech)
        │   ├── enums/.../phrasem-kind   — PhrasemeKind (5 kinds)
        │   ├── enums/.../morpheme-kind  — MorphemeKind
        │   └── dto/
        │       ├── surface-factory.ts   — makeSurfaceSchema(Full, Ref)
        │       └── phrasem-surface.ts   — language-independent PhrasemSurface
        └── de/
            ├── lexem/                   — German lexem features + surface schema
            ├── morphem/                 — German morpheme features + surface schema
            ├── phrasem/                 — phrasem surface barrel
            └── index.ts                 — GermanLinguisticUnitSchema barrel
```

### 15.5 Zod Schema Design

Everything is **Zod-schema-based** — types derived via `z.infer<>`. The same schemas are reused by:
- **Prompt-smith** — LLM output schemas reference the feature enums directly
- **Dict-note serialization** — parse/serialize validates against the schemas
- **Runtime validation** — anywhere a LinguisticUnit crosses a boundary

#### Noun features (Full vs Ref)

```typescript
// src/packages/independent/linguistics/src/de/lexem/noun/features.ts
const GermanNounFullFeaturesSchema = z.object({
  pos: z.literal("Noun"),
  genus: GermanGenusSchema,      // "Maskulinum"|"Femininum"|"Neutrum"
  nounClass: NounClassSchema,    // "Common"|"Proper"
});
const GermanNounRefFeaturesSchema = z.object({ pos: z.literal("Noun") });
```

#### POS features assembly (stubs for non-specialized POS)

```typescript
// src/packages/independent/linguistics/src/de/lexem/index.ts
// POS literals re-declared in v3 to avoid v4 import trap from pos.ts
const fullStubs = ["Pronoun", "Article", "Preposition", ...].map(pos => z.object({ pos: z.literal(pos) }));

const GermanLexemFullFeaturesSchema = z.discriminatedUnion("pos", [
  GermanNounFullFeaturesSchema,
  GermanVerbFullFeaturesSchema,
  GermanAdjectiveFullFeaturesSchema,
  ...fullStubs,
]);
const GermanLexemRefFeaturesSchema = z.discriminatedUnion("pos", [
  GermanNounRefFeaturesSchema,
  GermanVerbRefFeaturesSchema,
  GermanAdjectiveRefFeaturesSchema,
  ...refStubs,
]);
```

#### Surface factory

```typescript
// src/packages/independent/linguistics/src/common/dto/surface-factory.ts
function makeSurfaceSchema<F extends z.ZodTypeAny, R extends z.ZodTypeAny>(
  fullFeatures: F, refFeatures: R,
) {
  return z.discriminatedUnion("surfaceKind", [
    z.object({ surfaceKind: z.literal("Lemma"),     lemma: z.string(), features: fullFeatures }),
    z.object({ surfaceKind: z.literal("Inflected"),  surface: z.string(), lemma: z.string(),
               lemmaRef: z.string(), features: refFeatures }),
    z.object({ surfaceKind: z.literal("Variant"),    surface: z.string(), lemma: z.string(),
               lemmaRef: z.string(), features: refFeatures }),
  ]);
}
```

#### Assembly

```typescript
// src/packages/independent/linguistics/src/de/lexem/index.ts
const GermanLexemSurfaceSchema = makeSurfaceSchema(
  GermanLexemFullFeaturesSchema, GermanLexemRefFeaturesSchema,
);

// src/packages/independent/linguistics/src/common/dto/phrasem-surface.ts (language-independent)
const PhrasemSurfaceSchema = makeSurfaceSchema(PhrasemFullFeatures, PhrasemRefFeatures);

// src/packages/independent/linguistics/src/de/morphem/index.ts
const GermanMorphemSurfaceSchema = makeSurfaceSchema(
  GermanMorphemFullFeatures, GermanMorphemRefFeatures,
);

// src/packages/independent/linguistics/src/de/index.ts
const GermanLinguisticUnitSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("Lexem"),   surface: GermanLexemSurfaceSchema }),
  z.object({ kind: z.literal("Phrasem"), surface: PhrasemSurfaceSchema }),
  z.object({ kind: z.literal("Morphem"), surface: GermanMorphemSurfaceSchema }),
]);
type GermanLinguisticUnit = z.infer<typeof GermanLinguisticUnitSchema>;
```

### 15.6 Pipeline Integration

In `generateSections` (Path B — new entry), after LLM calls resolve, the header line is built via `dispatchHeaderFormatter(lemmaResult, targetLang)` which routes to the appropriate per-POS formatter (noun with genus → noun formatter with article, everything else → common formatter). V13 restores `meta.linguisticUnit` for Lexem/Phrasem entries (Morphem remains deferred).

```typescript
// generate-sections.ts
const newEntry: DictEntry = {
  headerContent,
  id: entryId,
  meta: {
    ...(entity ? { entity } : {}),
    ...(linguisticUnit ? { linguisticUnit } : {}),
  },
  sections,
};
```

### 15.7 Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| `article` field on Noun | **No** — store `genus` ("Maskulinum"\|"Femininum"\|"Neutrum") | `der/die/das` is a surface representation; `genus` is the linguistic property. Noun header-formatter derives article via `articleFromGenus`. |
| Morpheme "tags" | **No** — store `features` like `separability` | Tags are a representation abstraction. Features are named key-value linguistic properties. |
| `features` field naming | Uniform `features` across all unit kinds | Factory pattern produces `surface.features` uniformly. The discriminant inside (`pos`/`phrasemeKind`/`morphemeKind`) provides domain-specific naming. |
| Feature depth by surfaceKind | Full (Lemma) vs Ref (Inflected/Variant) | Inflected entries don't duplicate genus/nounClass — that data lives on the lemma entry. Ref carries just enough to identify the classification. |
| Phrasem language scoping | **Language-independent** | PhrasemeKind and its features (collocation strength, etc.) are universal. No `L` param. |
| Schema technology | **Zod v3** with `z.infer<>` | Single source of truth consumed by prompt-smith, serialization, and runtime validation. All DTO schemas use `import { z } from "zod/v3"`. POS literals re-declared in v3 to avoid v4 import trap from `pos.ts`. |
| Non-specialized POS | **Stubs** — `{ pos: z.literal("Pronoun") }` etc. | Stubs ensure the discriminated union covers all POS values without forcing speculative feature models. |

### 15.8 Out of Scope (Phase 2+)

- Remaining POS real features beyond Noun/Verb/Adjective
- Hebrew/English language schemas
- `lemmaRef` resolution logic for Inflected entries
- Replacing `DictEntry.headerContent` string with DTO-derived formatting
- Replacing `DictEntry.sections[].content` strings with structured section DTOs
- Query layer ("find all Neutrum nouns")
