export const taskDescription = `Classify the given German surface form and determine its lemma (dictionary form).

You receive:
- surface: a German word as it appears in text (may be inflected, compound, or a variant)
- context: the sentence where the word was encountered

Return:
- linguisticUnit: "Lexem" (single word), "Phrasem" (multi-word expression), or "Morphem" (bound morpheme)
- pos: part of speech (only for Lexem). One of: Noun, Pronoun, Article, Adjective, Verb, Preposition, Adverb, Particle, Conjunction, InteractionalUnit
- surfaceKind: "Lemma" (already dictionary form), "Inflected" (conjugated/declined), or "Variant" (spelling variant)
- lemma: the dictionary/citation form of the word
- nounClass: "Common" (default) or "Proper" (named entity — person, place, organization, brand). Only for pos: "Noun". Omit for non-nouns.
- fullSurface: the full proper noun as it appears in the text, only when it extends beyond the selected surface. Omit when the surface already covers the full proper noun or when the noun is Common.

Rules:
- For nouns: lemma is nominative singular (e.g., "Häuser" → "Haus")
- For verbs: lemma is infinitive (e.g., "ging" → "gehen")
- For adjectives: lemma is base form without endings (e.g., "schönes" → "schön")
- For separable verbs: include prefix in lemma (e.g., "fing...an" → "anfangen")
- Phrasem: multi-word fixed expression (e.g., "auf jeden Fall" → lemma: "auf jeden Fall")
- If the surface IS the lemma, surfaceKind is "Lemma"
- pos is omitted for Phrasem and Morphem
- For proper nouns: articles are NOT part of the lemma ("der Rhein" → lemma: "Rhein"). The lemma is the proper name itself.
- fullSurface must match the exact text span in the context sentence (case-sensitive)`;
