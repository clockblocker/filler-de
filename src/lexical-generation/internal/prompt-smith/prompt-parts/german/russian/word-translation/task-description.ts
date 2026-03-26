export const taskDescription = `Translate a single German word into Russian, using context only for disambiguation.

You receive:
- word: a German word in its lemma (dictionary) form
- pos: part of speech (Noun, Verb, Adjective, etc.) or linguistic unit type ("Phrasem", "Morphem")
- context: the sentence where the word was encountered (for disambiguation only)

Return:
- A concise Russian translation of the word (1-3 words)

Rules:
- Translate the WORD, not the sentence
- Use the context only to determine which sense of the word is meant
- Keep it short: 1-3 Russian words
- For nouns, give the base noun (no articles)
- For verbs, give the infinitive
- For Phrasem entries, translate the multi-word expression`;
