export const taskDescription = `Decompose the given German word into its morphemes and classify each one.

You receive:
- word: a German word in its lemma (dictionary) form
- context: the sentence where the word was encountered

Return an array of morphemes in left-to-right order as they appear in the word.
Return object shape:
- morphemes: array of morphemes in left-to-right order
- derived_from (optional): one immediate derivational base
  - { lemma: string, derivation_type: string }
- compounded_from (optional): immediate compound constituents in order (array of lemmas)

Each morpheme item has:
- surf: the morpheme surface string (lowercase)
- kind: one of Root, Prefix, Suffix, Suffixoid, Circumfix, Interfix, Duplifix
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
- Do NOT invent one-letter morphemes or interfixes to force segmentation.
- Interfix is valid only when it is a real German Fugenelement between two roots (e.g., s, n, en, es, er, e, ens). Never split a root just to create an interfix.
- Example constraint: "Neubau" = "neu" + "bau" (no extra "b" interfix token).
- derived_from must contain at most one immediate base lemma.
- compounded_from must contain only immediate constituents (no deep decomposition).
- Use canonical lemma forms in lemma, derived_from.lemma, and compounded_from.
- If relation is uncertain or non-obvious, set derived_from and/or compounded_from to null.
- Inflectional morphology is out of scope — analyze lemma form only.
- The concatenation of all surf strings must exactly reconstruct the original word (case-insensitive).
- Only Prefix-kind morphemes should have the separability field.`;
