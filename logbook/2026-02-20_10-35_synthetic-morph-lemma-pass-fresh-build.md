# Synthetic Morph Lemma Pass (Fresh Build)

- Date: 2026-02-20
- Time window: 10:31-10:35 (+0100)
- Vault: `cli-e2e-test-vault`
- Source: `textfresser/0_Synthetic_Test_To_Check_Morhp.md`
- Build status: `bun run build` completed before run (`main.js` rebuilt)
- Plugin reload: executed before lemma run
- Spacing policy: 4 seconds between calls

## Execution sequence

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

```md
Der [[Fahrer]] [[Worter/de/lexem/lemma/f/fah/fahre/Fahren|fährt]] mit der [[Fahrkarte]] zur [[Abfahrt]]. ^0

Sie [[unterschreiben|unterschreibt]] das Formular, und ihre [[Unterschrift]] steht schon unten. ^1

Die [[Bauarbeiter]] [[bauen]] heute einen [[Neubau]] am Stadtrand. ^2

Ich [[vorstellen|stelle]] mich kurz vor, und meine [[vorstellen|Vorstellung]] ist sehr knapp. ^3

Wir [[arbeiten]] im Team, und die [[Zusammenarbeit]] verbessert unsere [[Arbeit]]. ^4
```

## Quirks

1. `reset-source` command currently recreates this path with a generic fixture text, not the synthetic morph fixture; source had to be restored manually before run.
2. `fährt` linked with explicit full path alias (`[[Worter/de/.../Fahren|fährt]]`) while most other links used short wiki targets.
3. Verb and derivational-noun normalization behavior remains mixed (`vorstellen|Vorstellung`, but noun lemmas retained for others).

## Problems

1. Fixture reset mismatch makes repeatable CLI e2e passes error-prone for this specific file.
2. Link target formatting is not canonicalized (mix of short targets and full-path target aliases).
3. POS/lemma policy is still ambiguous for cases like `fährt -> Fahren` and `Vorstellung -> vorstellen`.

## Proposals

1. Fix `reset-source` to support named fixtures and ensure `textfresser/0_Synthetic_Test_To_Check_Morhp.md` restores exact canonical synthetic content.
2. Add canonical wikilink output rule: either always short target or always full path, but not mixed in one note.
3. Add explicit POS policy checks in lemma pipeline and surface them in runbook output (`surface`, `lemma`, `pos`, `targetPath`, `targetKind`).

## Integrity checks

- `check-no-nested`: `OK: no nested wikilinks`
- `scan-empty`: 13 linked entries checked, all non-empty
