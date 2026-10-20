---
status: accepted
---

# Segment Sentences lazily into a content-addressed cache

When Classify touches a Sentence, the plugin segments that Sentence through dumgen and caches the result under a hash of the segmenter version and the Sentence text. The cache holds no Scroll ID, path or position, so renames, Healing, moves, SplitToPages and edits to other Sentences leave it valid, and an edited Sentence misses because its hash changes. dumgen's `splitText` is the only sentence splitter, and the plugin's `^N` blocks group its Sentences. The plugin persists no Segment index, because it points at `^N` blocks, so a segmentation is derived data and losing it costs one re-segmentation.

This ADR covers storage only. Whether Classify also resolves right away or defers resolution to the click is an open research ticket on the map.

## Considered Options

- A sidecar JSON per Scroll, keyed by a Scroll ID in frontmatter. Rejected: Obsidian has no stable file ID. A frontmatter ID is copied with a duplicated file, can be stripped, and must be re-minted when SplitToPages replaces a Scroll. Edits still need a hash per Sentence, so the ID only adds failure modes.
- A hidden metadata Block inside the Scroll. Rejected: it puts kilobytes of JSON per Sentence into a note that Sync merges as Markdown, and every segmentation becomes a background write that races with editing.
- Eager segmentation of the whole Scroll. Rejected as the storage model: jev cost grows with Sentences, and most Sentences are never classified.

## Consequences

- The plugin's `Intl.Segmenter` sentence splitter is retired, and block grouping consumes dumgen Sentences. Later `^N` breaks therefore change position; blocks already written keep their IDs (ADR-0011).
- Multiword units, such as separable verbs and Locutions, are highlighted only after Classify has segmented their Sentence.
- The cache sits in a hidden vault folder that Obsidian Sync skips, so each device re-segments, at about $0.6 per 1,000 Sentences.
- Failed segmentations are not cached, so the next Classify retries them.
- If the plugin ever persists Segment indices, segmentation becomes durable data and this decision must be revisited.
