# Synthetic Morph Lemma Pass (Prompt/Propagation Check)

- Date: 2026-02-21
- Time window: 11:21-11:34 (+0100)
- Vault: `cli-e2e-test-vault`
- Source: `textfresser/0_Synthetic_Test_To_Check_Morhp.md`
- Branch: `codex/prompt-improvements`
- Build/reload: `bun run build`, copied `main.js` to vault plugin dir, `reload-plugin`
- Note: `bun run build` ran `biome --write` and reformatted 13 source files in this branch

## First-lemma gate (targeted-fix trigger check)

1. Fired lemma for `Fahrer`
2. Result: `fired (textfresser)`
3. Source updated (`Der [[Fahrer]] ...`)
4. `check-no-nested`: `OK: no nested wikilinks`

No immediate break after first lemma, so no targeted hotfix was required before continuing.

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
15. `fange`
16. `Anfang`
17. `steht`
18. `Aufstehen`
19. `räumen`
20. `Aufräumen`
21. `tritt`
22. `Beitritt`
23. `ziehst`
24. `Umzug`

All calls returned `fired (textfresser)`.

## Source outcome

```md
Der [[Fahrer]] [[fährt]] mit der [[Fahrkarte]] zur [[Abfahrt]]. ^0

Sie [[unterschreibt]] das Formular, und ihre [[Unterschrift]] [[steht]] schon unten. ^1

Die [[Bauarbeiter]] [[bauen]] heute einen [[Neubau]] am Stadtrand. ^2

Ich [[stelle]] mich kurz vor, und meine [[Vorstellung]] ist sehr knapp. ^3

Wir [[arbeiten]] im Team, und die [[Zusammenarbeit]] verbessert unsere [[Arbeit]]. ^4



---

Ich [[fange]] morgen früher an, und der [[Anfang]] fällt mir leicht. ^5

Sie steht jeden Tag um sechs auf, aber das [[Aufstehen]] bleibt schwer. ^6

Wir [[räumen]] nach dem Essen sofort auf, damit das [[Aufräumen]] schneller geht. ^7

Er [[tritt]] im Sommer dem Verein bei, und der [[Beitritt]] wird gefeiert. ^8

Du [[ziehst]] heute in Berlin um, und der [[Umzug]] dauert bis abends. ^9
```

## Integrity checks

1. `check-no-nested`: `OK: no nested wikilinks`
2. `scan-empty`: failed
3. Result: 24 linked entries checked, all 24 are empty (0 words)
4. `Worter/de` entries: 24 total
5. `Worter/de/unknown` entries: 24 total

## Systemic findings

1. All linked targets resolved into `Worter/de/unknown/...` (no POS-specific routing).
2. Linked dictionary files are created but remain empty (`wordcount = 0`).
3. Lemma linking is mostly surface echo (`[[surface]]`) rather than normalized lemma links.
4. Duplicate-surface selection issue in runbook flow: firing `steht` linked the first occurrence in line `^1`, leaving line `^6` untouched.

## Problem statement for prompt/propagation architecture

Current runtime behavior indicates a likely systemic failure mode in the prompt->classification->generation chain:
1. lemma classification appears to degrade to unknown routing,
2. generation/propagation does not materialize entry content after note creation,
3. the runbook invocation layer still has first-match ambiguity for repeated surfaces.

## Next focused probes

1. Capture and persist per-surface lemma payload (`lemma`, `posLikeKind`, `linguisticUnit`, `surfaceKind`) directly after each call.
2. Add a diagnostic marker when generation bails after file creation to distinguish prompt parse failures vs propagation early-return.
3. Patch runbook lemma invocation to support block-id constrained selection (avoid first-occurrence ambiguity for repeated tokens).
