---
status: accepted
---

# Translate vault observations before Healing

The `bulk-vault-action-adapter` is the semantic boundary between VAM's `BulkVaultEvent` and the Librarian's `TreeAction`. It applies Library scope, materializes single-node observations, and infers create, delete, rename, or move intent before the Library Tree and Healer see the change.

## Considered Options

- Teach VAM about Library paths, naming policies, and node identity.
- Interpret raw Vault Events directly inside the Tree or Healer.
- Isolate the translation in Library Core before applying Tree Actions.

## Consequences

- VAM remains reusable and domain-neutral, while the Tree and Healer operate on canonical node locators rather than Obsidian callback shapes.
- Changes crossing the Library boundary become semantic creates or deletes; inside-Library changes can become renames or moves according to `NameKing` and `PathKing` policy.
- Tree Actions carry an Observed Split Path only when later Healing needs the actual post-operation vault location.
- The adapter performs no filesystem I/O and is not an Obsidian `DataAdapter`; its source name must not be abbreviated as BAM.
- Startup snapshots and materialized live Create events share Library Core's
  synchronous Create-observation translator. It owns generated-Codex
  recognition, NameKing/PathKing selection, canonicalization, locator
  construction, and the final Create Tree Action. Startup alone reads Markdown
  metadata and may supply an initial Reading Status.
- Create translation returns an explicit translated, ignored generated-Codex,
  or invalid-diagnostic result. The Bulk adapter exposes invalid diagnostics to
  the Librarian for source-aware logging; it never silently represents invalid
  observations as an unexplained empty action list.
- The observation translator remains outside `LibraryReconciler`. It submits
  semantic Tree Actions plus source-specific supplemental observations, such as
  invalid Codex deletions, in one reconciliation request.
- Startup, observed Bulk Vault Events, and Codex clicks use the same
  reconciliation interface. Only their source discriminator differs; Codex
  scope, projection order, dispatch, recovery, and audit are internal policies.
- Explicit command intentions use the same interface without pretending to be
  observations. The Scroll-split translator validates vault paths, emits the
  ordered Delete-and-Create Tree Actions before any page write, and submits the
  branded plan through the Librarian queue. The initial VAM batch and semantic
  reconciliation share one permit, so recovery completes before later Library
  work can proceed.
