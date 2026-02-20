# Synthetic Morph Lemma Pass

- Date: 2026-02-20
- Time window: 10:23-10:26 (+0100)
- Vault: `cli-e2e-test-vault`
- Source: `textfresser/0_Synthetic_Test_To_Check_Morhp.md`
- Invocation: `scripts/runbook-cli/textfresser-runbook lemma <surface>`
- Spacing policy: 4 seconds between calls

## Scope

Lemma called in sequence for:
1. `Fahrer`
2. `fährt`
3. `Fahrkarte`
4. `Abfahrt`
5. `unterschreibt`
6. `Unterschrift`
7. `Bauarbeiter`
8. `bauen`
9. `Neubau`
10. `stelle`
11. `Vorstellung`
12. `arbeiten`
13. `Zusammenarbeit`
14. `Arbeit`

All calls returned `fired (textfresser)`.

## Source outcome

Resulting source note:

```md
Der [[Fahrer]] [[Fahren|fährt]] mit der [[Fahrkarte]] zur [[Abfahrt]]. ^0

Sie [[unterschreiben|unterschreibt]] das Formular, und ihre [[Unterschrift]] steht schon unten. ^1

Die [[Bauarbeiter]] [[bauen]] heute einen [[Neubau]] am Stadtrand. ^2

Ich [[vorstellen|stelle]] mich kurz vor, und meine [[vorstellen|Vorstellung]] ist sehr knapp. ^3

Wir [[arbeiten]] im Team, und die [[Zusammenarbeit]] verbessert unsere [[Arbeit]]. ^4
```

## Quirks

1. Mixed target kinds for similar verbs:
   - `fährt` linked as `[[Fahren|fährt]]` (lemma target).
   - `bauen`/`arbeiten` linked as `[[bauen]]`/`[[arbeiten]]` (inflected bucket path).
2. `Vorstellung` was normalized to verb lemma target `[[vorstellen|Vorstellung]]` instead of a noun lemma target.
3. Case behavior varies by resolved target (`Fahren` capitalized vs `unterschreiben` lowercase).

## Problems

1. Potential POS drift on verb forms:
   - `fährt` appears to resolve to `Fahren` (capitalized target), which can collide with noun interpretation.
2. Potential over-normalization on derivational nouns:
   - `Vorstellung` mapped to `vorstellen`, reducing noun-level specificity in links.
3. Storage policy looks inconsistent to operators:
   - some resolved links go to `Worter/de/lexem/lemma/...`,
   - others go to `Worter/de/lexem/inflected/...`.

## Proposals

1. Add explicit POS guardrails in lemma linking:
   - if model POS is verb, prefer lowercase infinitive target;
   - avoid noun-case canonicalization unless POS is noun.
2. Add configurable noun-derivation policy:
   - either keep noun lemma (`Vorstellung`) or map to base verb (`vorstellen`), but make it explicit and stable.
3. Add a post-link consistency check:
   - flag when same POS family is split between `lemma` and `inflected` paths in one run.
4. Extend runbook output with per-surface trace:
   - surface, resolved lemma, POS, chosen path kind (`lemma|inflected`) to make quirks visible immediately.

## Integrity checks

- `check-no-nested`: `OK: no nested wikilinks`
- `scan-empty`: 13 linked entries checked, all non-empty
