export const taskDescription = `Classify the given German surface form and determine its lemma (dictionary form).

You receive:
- surface: a German word as it appears in text (may be inflected, compound, or a variant)
- context: the sentence where the word was encountered

Return:
- linguisticUnit: "Lexem" (single word), "Phrasem" (multi-word expression), or "Morphem" (bound morpheme)
- phrasemeKind: required only when linguisticUnit is "Phrasem". One of: Idiom, Collocation, DiscourseFormula, Proverb, CulturalQuotation.
- pos: part of speech (only for Lexem). One of: Noun, Pronoun, Article, Adjective, Verb, Preposition, Adverb, Particle, Conjunction, InteractionalUnit
- surfaceKind: "Lemma" (already dictionary form), "Inflected" (conjugated/declined), or "Variant" (spelling variant)
- lemma: the dictionary/citation form of the word
- nounClass: "Common" (default) or "Proper" (named entity — person, place, organization, brand). Only for pos: "Noun". Omit for non-nouns.
- genus: grammatical gender for nouns — one of "Maskulinum", "Femininum", "Neutrum". Only for pos: "Noun". Omit for non-nouns.
- fullSurface: the full proper noun as it appears in the text, only when it extends beyond the selected surface. Omit when the surface already covers the full proper noun or when the noun is Common.
- emojiDescription: 1-3 emojis that capture the core semantic concept of the word's meaning in context. Used to visually distinguish between different senses of the same word (e.g., Schloss-castle ["🏰"] vs Schloss-lock ["🔒"]). For polysemous words, choose emojis that distinguish this sense from other common senses.
- ipa: the IPA pronunciation of the lemma form (without slashes or brackets, just the transcription). Use narrow IPA transcription reflecting standard High German (Hochdeutsch) pronunciation.
- contextWithLinkedParts: when the lemma consists of multiple parts in the context (e.g., separable prefix verb in separated position, or phrasem words), re-emit the full context with ALL parts of the lemma wrapped in [square brackets]. The originally marked surface must remain marked. Omit when the surface already covers the full lemma (single contiguous word, or fullSurface handles it).

Rules:
- For nouns: lemma is nominative singular (e.g., "Häuser" → "Haus")
- Diminutives (-chen, -lein) and other derivational forms are independent lemmas — do NOT reduce to the base noun (e.g., "Turteltäubchen" → "Turteltäubchen", NOT "Turteltaube")
- For verbs: lemma is infinitive (e.g., "ging" → "gehen")
- For adjectives: lemma is base form without endings (e.g., "schönes" → "schön")
- For separable verbs: include prefix in lemma (e.g., "fing...an" → "anfangen")
- Phrasem: multi-word fixed expression (e.g., "auf jeden Fall" → lemma: "auf jeden Fall")
- When linguisticUnit is "Phrasem", always return phrasemeKind
- If the surface IS the lemma, surfaceKind is "Lemma"
- pos is omitted for Phrasem and Morphem
- For proper nouns: articles are NOT part of the lemma ("der Rhein" → lemma: "Rhein"). The lemma is the proper name itself.
- fullSurface must match the exact text span in the context sentence (case-sensitive)
- For separable verbs in separated position: return contextWithLinkedParts with both the conjugated verb stem and the separated prefix marked.
- For phrasems where the user selected only one word: return contextWithLinkedParts with ALL words of the phrasem marked.
- contextWithLinkedParts text (with brackets stripped) must be identical to the input context text (with brackets stripped).`;
