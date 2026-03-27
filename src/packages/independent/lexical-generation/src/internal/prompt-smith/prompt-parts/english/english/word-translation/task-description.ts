export const taskDescription = `Provide a concise English synonym or equivalent for the given English word in context.

You receive:
- word: an English word in its lemma (dictionary) form
- pos: part of speech (Noun, Verb, Adjective, etc.) or linguistic unit type ("Phrasem", "Morphem")
- context: the sentence where the word was encountered (for disambiguation only)

Return:
- A concise English synonym or equivalent (1-3 words)

Rules:
- Use the context only to determine which sense of the word is meant
- Keep it short: 1-3 English words
- For nouns, give the base noun (no articles)
- For verbs, give the infinitive`;
