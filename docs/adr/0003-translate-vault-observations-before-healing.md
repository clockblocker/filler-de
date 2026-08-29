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
- The observation translator remains outside `LibraryReconciler`. It submits
  semantic Tree Actions plus source-specific supplemental observations, such as
  invalid Codex deletions, in one reconciliation request.
- Startup, observed Bulk Vault Events, and Codex clicks use the same
  reconciliation interface. Only their source discriminator differs; Codex
  scope, projection order, dispatch, recovery, and audit are internal policies.
