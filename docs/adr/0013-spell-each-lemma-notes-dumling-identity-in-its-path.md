---
status: superseded by ADR-0015
---

# Spell each Lemma note's dumling identity in its path

A Lemma note lives at `Worter/<language>/<Family>/<Kind>/<slot1>/<slot2>/…/<Canonical Form>.md`. Each Core Feature of a route (language, Family and Kind) has a fixed slot position, so der See and die See differ by their gender folder. Language, Family, Kind and feature values use dumling literals verbatim, and `Worter/` stays at the vault root. The note's metadata is authoritative and the path is its canonical projection, so the path never needs to carry anything the metadata lacks.

```
Worter/de/Lexeme/PRON/Prs/3/Masc/Sing/Dat/ihm.md
Worter/de/Lexeme/PRON/Prs/3/~/Sing/Dat/ihm.md          (Syncretism)
Worter/de/Lexeme/PRON/Prs/3/_/Plur/Nom/_/Form/Sie.md
Worter/de/Lexeme/DET/Art/_/Masc/Sing/Nom/der.md
Worter/de/Lexeme/DET/Dem/dieser.md
Worter/de/Lexeme/NOUN/Masc/See.md
Worter/de/Lexeme/NOUN/Masc+Neut/Balg.md
Worter/de/Lexeme/VERB/über/übersetzen.md
Worter/de/Lexeme/VERB/übersetzen.md
Worter/de/Lexeme/ADJ/comparable/schön.md
Worter/de/Lexeme/ADP/mit.md
```

## Considered Options

- `name=Value` pairs joined by `,` in one Core folder, such as `gender=Masc`. Rejected: positional slots give shorter, browsable folders, and appending a new feature moves only the Lemmas that get a value for it.
- Core Features in the basename, such as `See (Masc).md`. Rejected: identity folders keep basenames readable and partition notes without sharding.
- Sharding by first letters under `<Kind>`. Rejected for now: the identity folders already partition notes. Revisit only if a measured slowdown appears.

## Consequences

- Each route has a fixed slot order, from coarse to fine. The plugin authors the table, and a test checks it against dumling's Core Feature keys per route, so a new dumling Core Feature fails the build.
- German slot orders:
  - PRON and DET: pronType, person, gender, number, case, then poss and polite.
  - NOUN: gender.
  - VERB: hasSepPrefix, lexicallyReflexive.
  - ADJ and ADV: comparable.
  - PROPN: article, gender.
  - INTJ and PART: their type.
  - Foreign: sourceLang.
  - Morpheme PREFIX: hasSepPrefix.
- A null slot in the middle is written `_`, and trailing null slots are dropped. New features are always appended to a route's order.
- Flag features, whose only value is `Yes` (`comparable`, `poss`), are written as the feature name when set. Every other value is written verbatim: `lexicallyReflexive` takes `Acc` or `Dat` in dumling, so a reflexive verb sits at `VERB/_/Acc/`. `hasSepPrefix` is written as its value, which is the prefix itself (`über`).
- A feature value set, such as a noun's `{mixed: [Masc, Neut]}`, is written with `+` (`Masc+Neut`). A Syncretism (batteries ADR 0046) puts `~` in each slot named in its `syncretic` list.
- `<Canonical Form>` keeps display casing. Identity folds case, so `LOL` and `lol` share one file and the first writer's casing wins.
- The basename percent-encodes `% * " \ / < > : | ? # ^ [ ] ~`, `%` first, so the encoding is reversible. It also encodes control characters, a leading `.`, which Obsidian hides and which could leave the folder as `.` or `..`, and leading or trailing whitespace, which file systems and sync trim. Every other Unicode character, `…` included, is kept. Encoding `~` keeps it unambiguous as the shortening mark below. Text slots such as `hasSepPrefix` use the same encoding.
- An encoded basename longer than 100 characters becomes its first 80 characters, then `~`, then an 8-hex hash of the full Canonical Form. The metadata still holds the full identity, so nothing is lost.
- A Shadow note (ADR-0012) carries no Core Features, so it lives at `Worter/<language>/Shadow/<Family>/<Kind>/<Canonical Form>.md`, with the same basename rules.
- The dictionary store (`@textfresser/dictionary`) heals Lemma and Shadow notes whose path disagrees with their metadata. The Librarian does not, because `Worter/` is outside the Library.
- Links the plugin writes are path-qualified to the Reading block (ADR-0012). `+`, `~` and `_` are legal in Obsidian names and links.
