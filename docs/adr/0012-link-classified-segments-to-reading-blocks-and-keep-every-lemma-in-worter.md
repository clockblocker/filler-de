---
status: accepted
---

# Link classified Segments to Reading blocks and keep every Lemma in Worter

Each dumling Lemma has one note whose path spells its identity, so der See and die See are different notes with one basename. The plugin writes its own links: Classify on a selection segments it through dumgen and links each Segment to its unit's Reading with a path-qualified link to that Reading's block, such as `[[Worter/de/Lexeme/NOUN/gender=Masc/See#^r-<hash>|See]]`. A bare `[[See]]` typed by hand is a side case, and its ambiguity is accepted: Obsidian resolves it case-insensitively to a note in or under the source note's folder, else to the shortest path. This supersedes ADR-0008.

## Consequences

- There are no Crossroad notes for now. A Crossroad would hold no data, so it can be added later as a pure projection with no migration.
- A Shadow, a dumrel Unit Shadow with language, Family, Kind and Canonical Form but no Lemma yet, gets a note under `Worter/<lang>/Shadow/…`. It holds no records. When the Lemma is created, dumdict resolves the Pending Semantic Relation and the store removes the Shadow note.
- Closed-class Lemmas (dumcorpus Authored Inventories) live under `Worter/` like other Lemmas, each created on first click. They no longer go to Library leaves, and no surface host or membership Entry exists.
