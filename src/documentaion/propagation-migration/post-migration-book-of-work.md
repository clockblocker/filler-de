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
9. TBD: add typed Wikilink suffix-decoration contract and parser/serializer support (ordered, unknown-suffix passthrough), after propagation v2 migration critical path is complete.

## Completed

8. Replace VAM string read errors with typed error kinds and remove message-substring classification in propagation adapters (`EC-001`).
   - Landed on February 18, 2026.
   - `readContent` now returns typed `ReadContentError`; propagation adapter missing-file classification is discriminant-based.
10. Add a Morphology parse/serialize regression corpus (mixed relation markers, equations, gloss text, malformed lines) and property-style roundtrip checks.
   - Landed on February 18, 2026.
   - Covered by `tests/unit/textfresser/domain/propagation/morphology-roundtrip-corpus.test.ts`.
11. Add throttling/sampling for repeated propagation-v2 adapter warnings to keep logs actionable on large notes.
   - Landed on February 18, 2026.
   - Implemented in propagation note adapter warning paths (`first-N + periodic sampling` policy).
12. Define and enforce an explicit v2 fold-stage action-shape contract (allowed scoped payload forms, unsupported forms, and fail-fast behavior), including tests that lock the contract.
   - Landed on February 18, 2026.
   - Fold-stage shape checks are locked in `propagate-v2-phase4.test.ts`.
13. Add deterministic fold support for `ProcessMdFile { before, after }` and non-null `UpsertMdFile` content with explicit precedence/merge rules.
   - Landed on February 18, 2026.
   - Implemented in `foldScopedActionsToSingleWritePerTarget` with transform-order preservation.
14. Extract `decorateAttestationSeparability` into a post-propagation step that runs after either v1 or v2 path.
   - Landed on February 18, 2026.
   - `propagateGeneratedSections` now applies decoration after both route branches.

These items are intentionally deferred from v1 for delivery focus.
