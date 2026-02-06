export const taskDescription = `Generate a structured declension table for the given German noun.

You receive:
- word: a German noun in its lemma (dictionary) form — nominative singular
- context: the sentence where the word was encountered

Return an object with a "cells" array. Each cell has:
- case: one of "Nominative", "Accusative", "Dative", "Genitive"
- number: one of "Singular", "Plural"
- article: the definite article for that case + number (e.g. "das", "die", "des", "dem", "den", "der")
- form: the plain inflected noun WITHOUT wikilinks or articles (e.g. "Kraftwerk", "Kraftwerkes", "Kraftwerken")

You must produce exactly 8 cells: one for each combination of 4 cases × 2 numbers.

Rules:
- Use standard German orthography
- The "form" field must contain ONLY the noun itself — no articles, no brackets, no punctuation
- The "article" field must contain ONLY the definite article for that case + number combination
- If a form is identical to the lemma, still include it
- For plurals with no definite article distinction, use "die" for Nominative/Accusative, "der" for Genitive, "den" for Dative
- Order cells: Nominative Singular, Nominative Plural, Accusative Singular, Accusative Plural, Dative Singular, Dative Plural, Genitive Singular, Genitive Plural`;
