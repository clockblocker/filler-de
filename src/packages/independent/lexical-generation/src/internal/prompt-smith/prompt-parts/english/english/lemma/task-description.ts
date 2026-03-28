export const taskDescription = `Classify the given English surface form and determine its lemma (dictionary form).

You receive:
- surface: an English word as it appears in text (may be inflected or a variant)
- context: the sentence where the word was encountered

Return:
- linguisticUnit: "Lexem" (single word) or "Phrasem" (multi-word expression)
- posLikeKind:
  - when linguisticUnit is "Lexem": POS value (Noun, Pronoun, Article, Adjective, Verb, Preposition, Adverb, Particle, Conjunction, InteractionalUnit)
  - when linguisticUnit is "Phrasem": Phraseme kind (Idiom, Collocation, DiscourseFormula, Proverb, CulturalQuotation)
- surfaceKind: "Lemma" (already dictionary form), "Inflected" (conjugated/declined), "Variant" (spelling variant), or "Partial" (surface covers only part of a multi-word lemma)
- lemma: the dictionary/citation form of the word
- contextWithLinkedParts: always re-emit the full context; use [square brackets] to mark all lemma parts when the lemma is discontinuous in context.

Rules:
- For nouns: lemma is singular form (e.g., "houses" → "house")
- For verbs: lemma is base form (e.g., "went" → "go")
- When linguisticUnit is "Phrasem", posLikeKind must be a phraseme kind
- If the surface IS the lemma, surfaceKind is "Lemma"
- If the selected surface covers only one part of a multi-word lemma, surfaceKind is "Partial"
- Always return contextWithLinkedParts. If no extra lemma parts need linking, set it exactly to the input context.
- contextWithLinkedParts text (with brackets stripped) must be identical to input context text (with brackets stripped).`;
