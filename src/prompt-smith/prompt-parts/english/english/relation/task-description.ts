export const taskDescription = `Identify semantic relations for the given English word.

You receive:
- word: an English word in its lemma (dictionary) form
- pos: part of speech (Noun, Verb, Adjective, etc.)
- context: the sentence where the word was encountered

Return an object with a "relations" array. Each relation has:
- kind: one of Synonym, NearSynonym, Antonym, Hypernym, Hyponym, Meronym, Holonym
- words: array of related English words in lemma form

Rules:
- All related words must be English lemmas
- Focus on the word's meaning in the given context
- Include only well-established, commonly known relations
- Prefer 2-4 words per relation kind
- Omit relation kinds with no good matches`;
