# Post-Migration Smoke Test Findings

**Date**: 2026-02-18
**Branch**: `codex/remove-v1-runtime-import`
**Build**: commit `6929d943` (Complete propagation v2 deferred work and doc sync)
**API**: Real Gemini calls (no stubs)
**Test vault**: `cli-e2e-test-vault`

## Test Setup

Source file `Outside/Migration-Smoke-Test.md` with 5 sentences:

```
Der Fahrer fährt mit der Fahrkarte zur Abfahrt. ^0
Sie unterschreibt das Formular, und ihre Unterschrift steht schon unten. ^1
Die Bauarbeiter bauen heute einen Neubau am Stadtrand. ^2
Ich stelle mich kurz vor, und meine Vorstellung ist sehr knapp. ^3
Wir arbeiten im Team, und die Zusammenarbeit verbessert unsere Arbeit. ^4
```

## Per-Word Results

| # | Surface | Lemma cmd | Wikilink | Entry created | Entry path | Notes |
|---|---------|-----------|----------|---------------|------------|-------|
| 0 | Fahrer | OK | `[[Fahrer]]` | Y | `lexem/lemma/f/fah/fahre/Fahrer.md` | Full entry with IPA, inflection, morpheme (fahr+er) |
| 0 | Abfahrt | OK | `[[Abfahrt]]` | Y | `lexem/lemma/a/abf/abfah/Abfahrt.md` | Full entry, `derived_from: fahren` |
| 1 | Unterschrift | OK | `[[unterschreiben\|Unterschrift]]` | Y | `lexem/inflected/u/.../unterschreiben.md` | **ISSUE-1**: classified as inflected verb, not standalone noun |
| 1 | unterschreibt | OK | `[[unterschreiben\|unterschreibt]]` | N (re-encounter) | — | Re-encounter on entry from Unterschrift; propagation targets created |
| 2 | Bauarbeiter | OK | `[[Bauarbeiter]]` | Y | `lexem/lemma/b/bau/bauar/Bauarbeiter.md` | Full entry, `consists_of: Bau + Arbeiter` |
| 2 | Neubau | OK | `[[Neubau]]` | Y | `lexem/lemma/n/neu/neuba/Neubau.md` | Full entry, **ISSUE-2**: morpheme has spurious `b` interfix |
| 3 | Vorstellung | OK | `[[Vorstellung]]` | Y | `lexem/lemma/v/vor/vorst/Vorstellung.md` | Full entry, `derived_from: vorstellen`, morpheme (vor+stell+ung) |
| 4 | Zusammenarbeit | OK | `[[Zusammenarbeit]]` | Y | `lexem/lemma/z/zus/zusam/Zusammenarbeit.md` | Full entry, `derived_from: Arbeit`, `consists_of: Zusammen + Arbeit` |
| 4 | Arbeit | OK | `[[Arbeit]]` | N | — | **ISSUE-3**: Propagation stub blocks full entry generation |

## Final Source File

```
Der [[Fahrer]] fährt mit der Fahrkarte zur [[Abfahrt]]. ^0

Sie [[unterschreiben|unterschreibt]] das Formular, und ihre [[unterschreiben|Unterschrift]] steht schon unten. ^1

Die [[Bauarbeiter]] bauen heute einen [[Neubau]] am Stadtrand. ^2

Ich stelle mich kurz vor, und meine [[Vorstellung]] ist sehr knapp. ^3

Wir arbeiten im Team, und die [[Zusammenarbeit]] verbessert unsere [[Arbeit]]. ^4
```

All 9 wikilinks inserted correctly. No nested wikilinks. Second lemma in same sentence works after first modifies source.

## Statistics

- **Lemma commands**: 9/9 succeeded (100%)
- **Wikilinks inserted**: 9/9 (100%)
- **Full entries created**: 7/9 (Fahrer, Abfahrt, Unterschrift-as-unterschreiben, Bauarbeiter, Neubau, Vorstellung, Zusammenarbeit)
- **Re-encounters**: 1 (unterschreibt → existing unterschreiben entry)
- **Propagation stubs hit**: 1 (Arbeit)
- **Total new files**: 65 (entries + inflections + propagation targets + morphemes)
- **Propagation targets created**: ~50 (semantic relations, morphological relations, inflected forms, morphemes)
- **No crashes, no hard errors**

## Issues Found

### ISSUE-1: "Unterschrift" classified as inflected form of "unterschreiben"

**Severity**: Medium
**Type**: LLM classification

"Unterschrift" is linguistically a derived noun (Nomen deverbale from "unterschreiben"), not an inflected form. However, the LLM classified it as `surfaceKind: "Inflected"` with `posLikeKind: "Verb"`.

**Observed**:
- Entry path: `lexem/inflected/u/unt/unter/unterschreiben.md`
- Meta: `"surface": "Unterschrift", "surfaceKind": "Inflected", "posLikeKind": "Verb"`
- Wikilink: `[[unterschreiben|Unterschrift]]`

**Expected**:
- Entry path: `lexem/lemma/u/unt/unter/Unterschrift.md`
- POS: Noun, Femininum
- `surfaceKind: "Lemma"` (it IS the lemma of the noun "Unterschrift")

**Impact**: Users looking up "Unterschrift" won't find a proper noun entry with article, gender, noun inflection table. Instead they get a verb entry for "unterschreiben".

**Root cause**: Gemini Lemma step resolved "Unterschrift" as an inflected surface of the verb rather than recognizing it as a standalone noun lemma. This is a prompt/schema issue — the LLM needs stronger guidance to distinguish derivation (→ new lemma) from inflection (→ same lemma, different form).

**Possible fix**: Tighten the Lemma prompt to explicitly state that derived nouns (e.g., Unterschrift from unterschreiben, Vorstellung from vorstellen) should be classified as independent lemmas with `surfaceKind: "Lemma"`, not as inflected forms. This is a prompt-smith change, not a pipeline change.

### ISSUE-2: Neubau morpheme includes spurious "b" interfix

**Severity**: Low
**Type**: LLM output quality

Neubau's morphemes are listed as: `[[neu]]|[[b]]|[[Bauen|bau]]`
A morpheme entry `b.md` was created at `morphem/lemma/b/b/b/b.md` with tag `#interfix`.

**Expected**: `[[neu]]|[[Bau]]` — Neubau = Neu + Bau, no interfix.

**Impact**: Spurious morpheme entry clutters the dictionary. Minor — the morpheme analysis is supplementary.

**Root cause**: LLM hallucinated a morpheme segmentation splitting "bau" into "b" + "au". Prompt-smith morpheme schema could constrain minimum morpheme length.

### ISSUE-3: Propagation stub blocks full entry generation for "Arbeit"

**Severity**: Medium-High
**Type**: Pipeline logic

When "Zusammenarbeit" was generated, propagation created a stub for "Arbeit" at `lexem/lemma/a/arb/arbei/Arbeit.md` containing only:

```
<span class="entry_section_title entry_section_title_morphologie">Morphologische Relationen</span>
<used_in>
[[Zusammenarbeit]] *(cooperation)*
```

Subsequently, when the user ran lemma for "Arbeit", the system:
1. Correctly resolved "Arbeit" as a lemma
2. Found the existing `Arbeit.md` file
3. Treated it as a re-encounter → skipped LLM generation
4. Did NOT append attestation or enrich the entry

**Result**: `Arbeit.md` remains a bare propagation stub — no header, no IPA, no article, no inflection table, no translation, no attestation.

**Expected**: Either:
- (a) Recognize that the existing file is a propagation stub (no `textfresser_meta` section) and run full generation anyway, OR
- (b) The re-encounter path should detect that the entry is incomplete and trigger enrichment

**Impact**: Any word that appears first as a propagation target and then as a direct user lookup will be permanently stuck as a stub. This affects common root words (Arbeit, Bau, Arbeiter, etc.) that are likely to be propagation targets before they're directly looked up.

**Possible fix**: In `resolve-existing-entry.ts`, check for the presence of `textfresser_meta` section. If absent, treat the file as "no existing entry" and proceed with full generation, merging in any existing propagation content.

### ISSUE-4 (informational): Same entries from different derivation paths

Not a bug, but notable: "Arbeiter" was created as a propagation target from "Bauarbeiter" with just semantic + morphological relations. If the user later looks up "Arbeiter" directly, it will hit the same ISSUE-3 (stub blocks full generation).

Similarly, propagation targets like "Bau", "Zusammen", "Neu", "vorstellen", "schreiben" are all stubs that would need full generation if the user encounters them.

## Cross-Sentence Observations

1. **Second lemma in same sentence**: Works correctly. After "Fahrer" inserts `[[Fahrer]]`, the "Abfahrt" lemma correctly finds the surface in the modified content.
2. **Compound morpheme propagation**: Working well. Bauarbeiter propagates to Bau, Arbeiter, en. Zusammenarbeit propagates to Zusammen, Arbeit. Neubau propagates to Neu, Bau (+ spurious b).
3. **Semantic relation propagation**: Working correctly and bidirectionally. All synonym/antonym/hypernym/hyponym targets get backlink entries.
4. **Inflection propagation**: Working. Plural/genitive forms get proper inflection entries (e.g., Abfahrten, Bauarbeiters, Neubauten, Vorstellungen, Zusammenarbeiten).

## Verdict

The pipeline is **functionally working** post-migration. All lemma commands succeed, wikilinks are inserted correctly, entries are generated with full content, and propagation creates bidirectional cross-references.

**Critical fix needed**: ISSUE-3 (propagation stubs blocking full generation) affects the most common use case — root words that are compound parts. This should be fixed before heavy use.

**Nice-to-fix**: ISSUE-1 (Unterschrift classification) is an LLM prompt quality issue that will affect other derived nouns (Bewegung, Erfahrung, Bedeutung, etc.).

## Runner Script

The smoke test runner is at `tests/cli-e2e/textfresser/smoke-test-runner.ts`. Can be re-run with:

```bash
CLI_E2E_VAULT=cli-e2e-test-vault CLI_E2E_VAULT_PATH=/Users/annagorelova/work/obsidian/cli-e2e-test-vault \
  bun run tests/cli-e2e/textfresser/smoke-test-runner.ts
```
