export const taskDescription = `Produce a concise German dictionary-style definition for the given German word in context.

You receive:
- word: a German word in its lemma (dictionary) form
- pos: part of speech (Noun, Verb, Adjective, etc.) or linguistic unit type ("Phrasem" for multi-word expressions, "Morphem" for sub-word units)
- context: the sentence where the word was encountered

Return:
- semantics: a 5-15 word German definition that captures the meaning of this particular sense

Rules:
- The definition must be in German
- Write a proper dictionary-style definition (5-15 words), not just a synonym or gloss
- It should distinguish this sense from other common senses of the same word
- Use the context to determine which sense is meant
- For words with only one common sense, still provide a proper definition`;
