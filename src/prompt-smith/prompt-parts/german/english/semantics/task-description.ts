export const taskDescription = `Produce a short distinguishing gloss for the given German word in context.

You receive:
- word: a German word in its lemma (dictionary) form
- pos: part of speech (Noun, Verb, Adjective, etc.) or linguistic unit type ("Phrasem" for multi-word expressions, "Morphem" for sub-word units)
- context: the sentence where the word was encountered

Return:
- semantics: a 1-3 word German gloss that uniquely identifies this particular sense of the word

Rules:
- The gloss must be in German
- Keep it as short as possible (1-3 words), like a dictionary sense label
- It should distinguish this sense from other common senses of the same word
- Use a hypernym, synonym, or defining characteristic — whichever is most concise and clear
- For words with only one common sense, still provide a distinguishing label`;
