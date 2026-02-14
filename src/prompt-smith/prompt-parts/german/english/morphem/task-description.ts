export const taskDescription = `Decompose the given German word into its morphemes and classify each one.

You receive:
- word: a German word in its lemma (dictionary) form
- context: the sentence where the word was encountered

Return an array of morphemes in left-to-right order as they appear in the word.
Each morpheme has:
- surf: the morpheme surface string (lowercase)
- kind: one of Root, Prefix, Suffix, Suffixoid, Infix, Circumfix, Interfix, Transfix, Clitic, ToneMarking, Duplifix
- lemma (optional): the dictionary form of the morpheme, when it differs from surf.
  Use for: inflected roots (surf: "sang", lemma: "sing"), noun roots in compounds
  where capitalization differs (surf: "küche", lemma: "Küche")
- separability (optional, Prefix-kind only): "Separable" or "Inseparable"
  - "Separable" — prefix detaches in main clauses (trennbar): ab-, an-, auf-, aus-, bei-, ein-, etc.
  - "Inseparable" — prefix stays attached (untrennbar): be-, emp-, ent-, er-, ge-, miss-, ver-, zer-
  - Dual-use prefixes (context-dependent): über-, unter-, um-, durch-, wider-, wieder-

Rules:
- Every word must have at least one Root.
- Interfixes (Fugenelemente like -s-, -n-, -es-, -er-, -e-, -ens-) connect compound parts — mark them as Interfix.
- For compound words, each independent stem is a separate Root.
- Derivational affixes (un-, ver-, be-, -keit, -ung, -lich, -bar, etc.) are Prefix or Suffix.
- Inflectional suffixes should NOT be included — analyze the lemma form only.
- The concatenation of all surf strings must exactly reconstruct the original word (case-insensitive).
- Only Prefix-kind morphemes should have the separability field.`;
