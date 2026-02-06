export const taskDescription = `Decompose the given German word into its morphemes and classify each one.

You receive:
- word: a German word in its lemma (dictionary) form
- context: the sentence where the word was encountered

Return an array of morphemes in left-to-right order as they appear in the word.
Each morpheme has:
- morpheme: the morpheme string (lowercase)
- kind: one of Root, Prefix, Suffix, Suffixoid, Infix, Circumfix, Interfix, Transfix, Clitic, ToneMarking, Duplifix

Rules:
- Every word must have at least one Root.
- Interfixes (Fugenelemente like -s-, -n-, -es-, -er-, -e-, -ens-) connect compound parts — mark them as Interfix.
- For compound words, each independent stem is a separate Root.
- Derivational affixes (un-, ver-, be-, -keit, -ung, -lich, -bar, etc.) are Prefix or Suffix.
- Inflectional suffixes should NOT be included — analyze the lemma form only.
- The concatenation of all morpheme strings must exactly reconstruct the original word (case-insensitive).`;
