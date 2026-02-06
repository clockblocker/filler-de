export const taskDescription = `Determine which existing sense (if any) a German word belongs to in the given context.

You receive:
- lemma: the dictionary form of the German word
- context: the sentence where the word was encountered
- senses: array of existing sense descriptors, each with:
  - index: numeric identifier of the existing entry
  - semantics: a short distinguishing gloss (1-3 words) for that sense

Return:
- matchedIndex: the index of the matching sense, or null if the word in context represents a NEW sense not covered by any existing entry

Rules:
- Compare the contextual meaning against each sense's semantics gloss
- Return the index of the best-matching sense if the meaning clearly aligns
- Return null only when the word in context has a genuinely different meaning from ALL listed senses
- When in doubt between a close match and a new sense, prefer the existing match`;
