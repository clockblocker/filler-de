# Propagation Migration - Post-migration Book of Work

Track intentionally deferred work here after propagation v2 migration lands.

## Items

1. Replace strict fail-fast with scoped partial-success policy once recovery model is designed.
2. Remove single-writer assumption by adding collision-safe ID allocation/retry.
3. Retire `byHeader` fallback after legacy/invalid notes are healed.
4. Increase typed section coverage and reduce raw passthrough reliance.
5. Add optional transitive propagation as explicit extra pass (never implicit recursion).
6. Add additional section mutation kinds with explicit merge policy entries.
7. Add per-target error remediation UX (quick-open failing target, suggested fix path).
8. Replace VAM string read errors with typed error kinds to remove message-substring classification in propagation adapters (tracked in [`error-contract-book-of-work.md`](../error-contract-book-of-work.md), case `EC-001`).
9. TBD: add typed Wikilink suffix-decoration contract and parser/serializer support (ordered, unknown-suffix passthrough), after propagation v2 migration critical path is complete.
10. Add a Morphology parse/serialize regression corpus (mixed relation markers, equations, gloss text, malformed lines) and property-style roundtrip checks to guard against equation/backlink reclassification regressions.
11. Add throttling/sampling for repeated propagation-v2 adapter warnings (for example skipped embedded/unparseable wikilinks) to keep logs actionable on large notes.

These items are intentionally deferred from v1 for delivery focus.
