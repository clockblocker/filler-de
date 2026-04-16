# `@textfresser/linguistics`

Typesafe schemas and types for practical, learner-facing segmentation of text.

The package models a layered analysis:

- `Selection`: what the user actually highlighted
- `Surface`: the normalized full form that highlight belongs to
- `Lemma`: the normalized dictionary form assigned to that surface

It currently exposes curated registries for `German` and `English`, plus a small relations API for lexical and morphological links.

## Core idea

A learner reads:

```text
Mark gave up on it
```

They select only part of the expression:

```text
Mark gave [up] on it
```

That is still a valid classification. The selection is partial, but the deeper layers stay intact: the full surface is the inflected form `gave up`, and the lemma is `give up`.

<!-- README_BLOCK:core-simple-selection -->

And the assigned lemma can be validated independently:

`meaningInEmojis` is part of lemma identity and should describe the sense itself, not the literal imagery of the written form.

<!-- README_BLOCK:core-simple-lemma -->

This gives you three orthogonal axes of strictness:

- `orthographicStatus`: whether the spelling is standard, a recognized typo, or unknown
- `spellingRelation`: whether a known spelling is the canonical one or an accepted variant
- `selectionCoverage`: whether the user highlighted the whole surface or only part of it

A recognized typo does not need to break deeper classification if the surface is still recognizable, and a partial selection does not need to discard the full surface or its lemma.

Selection-level `spellingRelation` is separate from the UD feature `variant`. The former links obvious spelling alternants such as `armor` / `armour`; the latter stays a lexical feature where UD needs it.

Although mainly based on the work of UD, this model has a human student of a new language in mind and hence differs from UD in compounded linguistic units.

For example, the same separation also allows classifying the idiom in

```text
This game was a [walk] in the park
```

as part of the idiom "a walk in the park", directly at the lemma-surface layer:

<!-- README_BLOCK:core-idiom-selection -->

Here, `surfaceKind: "Lemma"` is appropriate because the selection is attached directly to the idiom lemma instead of to a separate inflected surface.

Spelling variants now live on the selection, not on `surfaceKind`. The surface stays structural (`Lemma` or `Inflection`), while the selection records whether the observed spelling is canonical or an accepted variant.

For plain spelling alternants such as `armor` / `armour`:

<!-- README_BLOCK:core-spelling-variant-selection -->

And the same mechanism works for inflected Hebrew forms, including pointed vs unpointed spellings:

<!-- README_BLOCK:core-hebrew-pointed-variant-selection -->

The DTO keeps the learner-facing selection separate from the deeper linguistic layers:

- the language shared by the selection, surface, and lemma: `language`
- the actual highlighted text in the note: `spelledSelection`
- whether that spelling is canonical or an accepted variant: `spellingRelation`
- whether the user highlighted the whole surface or only part of it: `selectionCoverage`
- the full orthographically normalized surface that the highlighted text belongs to: `normalizedFullSurface`
- the lexical target that the surface resolves to: `target.canonicalLemma`

In the examples below, the user highlights only one piece of an inflected multi-token surface, but the model still preserves the full surface and lemma.

The selections target the lemmas `give up` and `aufpassen`, while the realized normalized surfaces are `gave up` and `pass auf`.

<!-- README_BLOCK:core-lemma-surface-distinction -->

This allows for both:

1. pointing the user to the most meaningful target in the actual sentences:

```text
(text reading mode on)
Hans, [Pass] auf dich auf! -> aufpassen (VERB | separable | with governed prep)
Hans, Pass [auf] dich auf! -> aufpassen (VERB | separable | with governed prep)
Hans, Pass auf [dich] auf! -> du (PRON)
Hans, Pass auf dich [auf]! -> aufpassen (VERB | separable | with governed prep)
```

2. drilling down for the actual linguistics:

```text
(linguistic investigation mode on)
Hans, [Pass] auf dich auf! -> `aufpassen` (VERB | separable | with governed prep)
Hans, Pass [auf] dich auf! -> `auf` (ADP)
Hans, Pass auf [dich] auf! -> `du` (PRON)
Hans, Pass auf dich [auf]! -> `auf` (PRT)
```
