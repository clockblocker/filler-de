# Book Of Work

## Deferred Follow-Ups (Morphological Relations V1)

### 1) Prefix derivations: avoid redundant `<derived_from>` with equation
- Status: Deferred by request.
- Current behavior: prefix cases can render both:
  - `<derived_from>` `[[base]]`
  - `[[prefix|decorated]] + [[base]] = [[source]] *(gloss)*`
- Follow-up decision to implement later: for inferred prefix derivations, render only the equation and skip `<derived_from>`.

### 2) Architecture doc table sync for Lexem POS section coverage
- Status: Deferred by request.
- Gap: `sectionsForLexemPos` in code includes `Morphology` for all Lexem POS, but the table in `/Users/annagorelova/work/Textfresser_vault/.obsidian/plugins/textfresser/src/documentaion/linguistics-and-prompt-smith-architecture.md` is only partially updated.
- Follow-up to implement later: update all POS rows in the table so docs exactly match `section-config.ts`.
