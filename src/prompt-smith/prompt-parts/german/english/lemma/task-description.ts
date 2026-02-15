export const taskDescription = `Classify the given German surface form and determine its lemma (dictionary form).

You receive:
- surface: a German word as it appears in text (may be inflected, compound, or a variant)
- context: the sentence where the word was encountered

Return:
- linguisticUnit: "Lexem" (single word) or "Phrasem" (multi-word expression)
- posLikeKind:
  - when linguisticUnit is "Lexem": POS value (Noun, Pronoun, Article, Adjective, Verb, Preposition, Adverb, Particle, Conjunction, InteractionalUnit)
  - when linguisticUnit is "Phrasem": Phraseme kind (Idiom, Collocation, DiscourseFormula, Proverb, CulturalQuotation)
- surfaceKind: "Lemma" (already dictionary form), "Inflected" (conjugated/declined), or "Variant" (spelling variant)
- lemma: the dictionary/citation form of the word
- contextWithLinkedParts: when the lemma consists of multiple parts in the context (e.g., separable prefix verb in separated position, or phrasem words), re-emit the full context with ALL parts of the lemma wrapped in [square brackets]. The originally marked surface must remain marked. Omit when the surface already covers the full lemma (single contiguous word).

Rules:
- For nouns: lemma is nominative singular (e.g., "Häuser" → "Haus")
- Diminutives (-chen, -lein) and other derivational forms are independent lemmas — do NOT reduce to the base noun (e.g., "Turteltäubchen" → "Turteltäubchen", NOT "Turteltaube")
- For verbs: lemma is infinitive (e.g., "ging" → "gehen")
- For adjectives: lemma is base form without endings (e.g., "schönes" → "schön")
- For separable verbs: include prefix in lemma (e.g., "fing...an" → "anfangen")
- Phrasem: multi-word fixed expression (e.g., "auf jeden Fall" → lemma: "auf jeden Fall")
- When linguisticUnit is "Phrasem", posLikeKind must be a phraseme kind
- If the surface IS the lemma, surfaceKind is "Lemma"
- For separable verbs in separated position: return contextWithLinkedParts with both the conjugated verb stem and the separated prefix marked.
- For phrasems where the user selected only one word: return contextWithLinkedParts with ALL words of the phrasem marked.
- contextWithLinkedParts text (with brackets stripped) must be identical to the input context text (with brackets stripped).`;
