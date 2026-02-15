export const taskDescription = `Identify semantic relations for the given German word.

You receive:
- word: a German word in its lemma (dictionary) form
- pos: part of speech (Noun, Verb, Adjective, etc.) or linguistic unit type ("Phrasem" for multi-word expressions, "Morphem" for sub-word units)
- context: the sentence where the word was encountered

Return an object with a "relations" array. Each relation has:
- kind: one of Synonym, NearSynonym, Antonym, Hypernym, Hyponym, Meronym, Holonym
- words: array of related German words in lemma form

Relation kinds:
- Synonym: exact or near-exact meaning (e.g., "beginnen" ↔ "anfangen")
- NearSynonym: similar but not interchangeable (e.g., "Weg" ~ "Pfad")
- Antonym: opposite meaning (e.g., "groß" ↔ "klein")
- Hypernym: broader category (e.g., "Hund" → "Tier")
- Hyponym: narrower instance (e.g., "Tier" → "Hund")
- Meronym: part of (e.g., "Rad" is part of "Fahrrad")
- Holonym: whole containing (e.g., "Fahrrad" contains "Rad")

Rules:
- All related words must be German lemmas
- Focus on the word's meaning in the given context
- Include only well-established, commonly known relations
- Prefer 2-4 words per relation kind
- Omit relation kinds that have no good matches
- Return empty relations array if no meaningful relations exist`;
