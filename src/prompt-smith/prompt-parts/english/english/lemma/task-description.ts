export const taskDescription = `Classify the given English surface form and determine its lemma (dictionary form).

You receive:
- surface: an English word as it appears in text (may be inflected or a variant)
- context: the sentence where the word was encountered

Return:
- linguisticUnit: "Lexem" (single word), "Phrasem" (multi-word expression), or "Morphem" (bound morpheme)
- phrasemeKind: required only when linguisticUnit is "Phrasem". One of: Idiom, Collocation, DiscourseFormula, Proverb, CulturalQuotation.
- pos: part of speech (only for Lexem). One of: Noun, Pronoun, Article, Adjective, Verb, Preposition, Adverb, Particle, Conjunction, InteractionalUnit
- surfaceKind: "Lemma" (already dictionary form), "Inflected" (conjugated/declined), or "Variant" (spelling variant)
- lemma: the dictionary/citation form of the word
- emojiDescription: 1-3 emojis that capture the core semantic concept of the word's meaning in context. Used to visually distinguish between different senses of the same word (e.g., bank-financial ["🏦"] vs bank-river ["🌊"]). For polysemous words, choose emojis that distinguish this sense from other common senses.
- ipa: the IPA pronunciation of the lemma form (without slashes or brackets, just the transcription). Use narrow IPA transcription.

Rules:
- For nouns: lemma is singular form (e.g., "houses" → "house")
- For verbs: lemma is base form (e.g., "went" → "go")
- When linguisticUnit is "Phrasem", always return phrasemeKind
- If the surface IS the lemma, surfaceKind is "Lemma"
- pos is omitted for Phrasem and Morphem`;
