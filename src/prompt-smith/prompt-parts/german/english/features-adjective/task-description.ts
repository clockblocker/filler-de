export const taskDescription = `Return inherent (non-inflectional) lexical features for a adjective as short lowercase tag parts.

You receive:
- word: lemma
- context: sentence where the word occurred

Return:
- tags: ordered array of 1-5 short lowercase strings

Rules:
- Return only stable lexical features, not inflectional values.
- Keep tags concise (1-2 words).
- Most general feature first, then more specific ones.`;
