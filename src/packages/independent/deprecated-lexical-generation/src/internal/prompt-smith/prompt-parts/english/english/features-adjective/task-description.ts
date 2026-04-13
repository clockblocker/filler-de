export const taskDescription = `Return inherent (non-inflectional) lexical features for an English adjective.

You receive:
- word: lemma
- context: sentence where the word occurred

Return:
- classification: one of "Qualitative" | "Relational" | "Participial"
- gradability: one of "Gradable" | "NonGradable"
- distribution: one of "AttributiveAndPredicative" | "AttributiveOnly" | "PredicativeOnly"
- valency:
  - governedPattern: one of "None" | "Dative" | "Accusative" | "Genitive" | "Prepositional" | "ZuInfinitive" | "DassClause"
  - governedPreposition?: optional preposition string; required only when governedPattern is "Prepositional"

Rules:
- Return only stable lexical features, not inflectional values.
- Choose exactly one value for each enum field.
- Do not include extra keys.`;
