export const taskDescription = `Return the non-inflectional (inherent/lexical) grammatical features for the given German word as short, lowercase tag path components.

You receive:
- word: the lemma (dictionary form)
- pos: part of speech
- context: a sentence where the word was encountered

Return:
- tags: ordered array of 1–5 short lowercase strings, most important/general feature first

Rules:
- Only return inherent/lexical features — features that do not change across inflected forms.
- Inflectional features (case, number, person, tense, mood, voice) are EXCLUDED — they vary per form and are handled separately.
- Use German terms where standard in linguistics: maskulin, feminin, neutrum, transitiv, intransitiv, stark, schwach, trennbar, untrennbar, reflexiv, steigerbar.
- Use English terms where no standard German term exists: proper, weak, strong.
- Keep each tag component short (1–2 words max).
- Order: most important/general feature first, then more specific features.`;
