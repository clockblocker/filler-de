export const taskDescription = `Return inherent (non-inflectional) lexical features for a German verb.

You receive:
- word: lemma
- context: sentence where the word occurred

Return:
- conjugation: one of "Irregular" | "Regular"
- valency:
  - separability: one of "Separable" | "Inseparable" | "None"
  - reflexivity: one of "NonReflexive" | "ReflexiveOnly" | "OptionalReflexive"
  - governedPreposition?: optional preposition string (for lexically governed prepositions only)

Rules:
- Return only stable lexical features, not inflectional values.
- Choose exactly one separability value (never "Both").
- Provide governedPreposition only when the verb lexically requires it.
- Do not include extra keys.`;
