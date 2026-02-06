export const taskDescription = `Decompose the given German word into its morphemes and classify each one.

You receive:
- word: a German word in its lemma (dictionary) form
- context: the sentence where the word was encountered

Return an array of morphemes in left-to-right order as they appear in the word.
Each morpheme has:
- surf: the morpheme surface string (lowercase)
- kind: one of Root, Prefix, Suffix, Suffixoid, Infix, Circumfix, Interfix, Transfix, Clitic, ToneMarking, Duplifix
- lemma (optional): the dictionary form of the morpheme, only when surf is inflected (e.g., surf: "sang", lemma: "sing")
- tags (optional): array of language-specific properties. Only applies to Prefix-kind morphemes:
  - "Separable" — the prefix detaches in main clauses (trennbar): ab-, an-, auf-, aus-, bei-, ein-, mit-, nach-, vor-, zu-, etc.
  - "Inseparable" — the prefix stays attached (untrennbar): be-, emp-, ent-, er-, ge-, miss-, ver-, zer-
  - Dual-use prefixes (context-dependent): über-, unter-, um-, durch-, wider-, wieder-

Rules:
- Every word must have at least one Root.
- Interfixes (Fugenelemente like -s-, -n-, -es-, -er-, -e-, -ens-) connect compound parts — mark them as Interfix.
- For compound words, each independent stem is a separate Root.
- Derivational affixes (un-, ver-, be-, -keit, -ung, -lich, -bar, etc.) are Prefix or Suffix.
- Inflectional suffixes should NOT be included — analyze the lemma form only.
- The concatenation of all surf strings must exactly reconstruct the original word (case-insensitive).
- Only Prefix-kind morphemes should have Separable/Inseparable tags.`;
