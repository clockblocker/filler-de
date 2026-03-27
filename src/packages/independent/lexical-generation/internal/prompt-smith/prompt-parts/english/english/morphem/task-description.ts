export const taskDescription = `Decompose the given English word into its morphemes and classify each one.

You receive:
- word: an English word in its lemma (dictionary) form
- context: the sentence where the word was encountered

Return an array of morphemes in left-to-right order as they appear in the word.
Each morpheme has:
- surf: the morpheme surface string (lowercase)
- kind: one of Root, Prefix, Suffix, Suffixoid, Circumfix, Interfix, Duplifix
- lemma (optional): the dictionary form of the morpheme, only when surf is inflected (e.g., surf: "sang", lemma: "sing")
- tags (optional): array of language-specific properties. Not used for English — omit this field.

Rules:
- Every word must have at least one Root.
- For compound words, each independent stem is a separate Root.
- Derivational affixes (un-, re-, dis-, -ness, -tion, -able, -ly, etc.) are Prefix or Suffix.
- Inflectional suffixes should NOT be included — analyze the lemma form only.
- The concatenation of all surf strings must exactly reconstruct the original word (case-insensitive).`;
