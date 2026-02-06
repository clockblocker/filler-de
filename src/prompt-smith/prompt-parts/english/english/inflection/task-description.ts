export const taskDescription = `Generate the inflection table for the given German word.

You receive:
- word: a German word in its lemma (dictionary) form
- pos: part of speech (Noun, Verb, Adjective, Article, Pronoun)
- context: the sentence where the word was encountered

Return an object with a "rows" array. Each row has:
- label: the grammatical category (e.g., "N", "A", "G", "D" for cases; "Präsens", "Präteritum" for tenses)
- forms: comma-separated inflected forms wrapped in [[wikilinks]], with articles for nouns

Rules per POS:

**Noun** — 4 rows for Nominative, Accusative, Genitive, Dative. Each row: "article [[singular]], article [[plural]]"
  - label: "N", "A", "G", "D"
  - forms: "das [[Kraftwerk]], die [[Kraftwerke]]"

**Verb** — rows for key tenses/moods. Use 3rd person singular as representative form.
  - label: "Präsens", "Präteritum", "Perfekt", "Konjunktiv II", "Imperativ"
  - forms: conjugated form(s), e.g., "[[geht]]", "[[ging]]", "ist [[gegangen]]"

**Adjective** — rows for comparison degrees + representative case forms.
  - label: "Positiv", "Komparativ", "Superlativ"
  - forms: "[[groß]], [[größer]], am [[größten]]" (one row per degree with representative declined forms)

**Article / Pronoun** — 4 rows for cases.
  - label: "N", "A", "G", "D"
  - forms: comma-separated forms across genders, e.g., "[[der]], [[die]], [[das]]"

General rules:
- All inflected forms MUST be wrapped in [[wikilinks]]
- Include articles (der/die/das/den/dem/des) outside wikilinks for nouns
- Use standard German orthography
- If a form is identical to another, still include it
- For verbs, if a separable prefix exists, show the full separated form`;
