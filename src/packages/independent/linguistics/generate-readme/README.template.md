# `@textfresser/linguistics`

Typesafe schemas and types for classifying linguistic units in text.

The package models two closely related things:

- `Selection`: a concrete surface form selected in text
- `Lemma`: the normalized dictionary form assigned to that selection

It currently exposes curated registries for `German` and `English`, plus a small relations API for lexical and morphological links.

## Core idea

User reads:

```text
I walk in the park
```

They select:

```text
I [walk] in the park
```

That selection can be represented as a typed surface form:

<!-- README_BLOCK:core-simple-selection -->

And the assigned lemma can be validated independently:

`meaningInEmojis` is part of lemma identity and should describe the sense itself, not the literal imagery of the written form.

<!-- README_BLOCK:core-simple-lemma -->

Although mainly based on the work of UD, this model has a human student of a new language in mind and hence differs from UD in compounded linguistic units.

For example, the model allows classifying the idiom in

```text
This game was a [walk] in the park
```

as part of the idiom "a walk in the park":

<!-- README_BLOCK:core-idiom-selection -->

The DTO separates three distinct things:

- the actual highlighted text in the note: `spelledSelection`
- whether the user highlighted the whole surface or only part of it: `selectionCoverage`
- for standard partial selections, the normalized highlighted fragment: `normalizedSelectedSurface`
- the full orthographically normalized surface that the highlighted text belongs to: `normalizedFullSurface`
- the lexical target that the surface resolves to: `target.canonicalLemma`

In the examples below, the selections target the lemmas `give up` and `aufpassen`, while the realized normalized surfaces are `gave up` and `pass auf`.

`surfaceKind: "Lemma"` means that the selection resolves directly to a lemma target. It does not mean that `normalizedFullSurface` itself is a lemma string.

<!-- README_BLOCK:core-lemma-surface-distinction -->

This allows for both:

1. pointing the user to the most meaningful target in the actual sentences:

```text
(text reading mode on)
Hans, [Pass] auf dich auf! -> aufpassen (VERB)
Hans, Pass [auf] dich auf! -> aufpassen (VERB)
Hans, Pass auf [dich] auf! -> du (PRON)
Hans, Pass auf dich [auf]! -> aufpassen
```

2. drilling down for the actual linguistics:

```text
(linguistic investigation mode on)
Hans, [Pass] auf dich auf! -> `passen` (VERB)
Hans, Pass [auf] dich auf! -> `auf` (ADP)
Hans, Pass auf [dich] auf! -> `du` (PRON)
Hans, Pass auf dich [auf]! -> `auf` (PRT)
```

## Ling IDs

The package serializes stable surface-shaped Ling IDs. Lemma input is normalized into a resolved-surface identity, so there is no separate top-level lemma ID format.

### Observed Surface IDs

<!-- README_BLOCK:ling-id-resolved-walk -->

Observed-surface identity still includes inherent lemma features:

<!-- README_BLOCK:ling-id-resolved-see -->

### Full Surface IDs

Full surface IDs preserve target richness.

<!-- README_BLOCK:ling-id-full-walk -->

If the target is shallow, the full surface ID changes:

<!-- README_BLOCK:ling-id-full-canonical-target -->

### Shallow Surface IDs

Use shallow surface IDs when you want to compare form identity while ignoring target richness. Shallow IDs accept surface inputs such as selections, resolved surfaces, and shallow shells, but not bare lemmas.

<!-- README_BLOCK:ling-id-shallow-see -->

### Parsing IDs

`buildToLingConverters()` also exposes language-bound parsers. `parseSurface()` returns either a `Selection` for full surface IDs or a `ResolvedSurface` for resolved lemma IDs. `parseShallowSurface()` returns the shallow shell payload.

<!-- README_BLOCK:ling-id-parse -->
