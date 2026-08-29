# Vault Action Manager architecture

The Vault Action Manager (VAM) is the only supported Obsidian I/O boundary for the Librarian and Textfresser.

Related decisions:

- [ADR-0001: Use VAM as the Librarian's Obsidian boundary](../../docs/adr/0001-use-vam-as-the-librarians-obsidian-boundary.md)
- [ADR-0002: Coalesce Obsidian callbacks into Bulk Vault Events](../../docs/adr/0002-coalesce-obsidian-callbacks-into-bulk-vault-events.md)
- [ADR-0005: Use one Effect runtime inside VAM](../../docs/adr/0005-use-one-effect-runtime-inside-vam.md)

## Responsibilities

VAM owns:

- typed vault paths;
- vault reads and writes;
- active-editor access;
- dependency-ordered action dispatch;
- Obsidian callback normalization;
- Self Event filtering;
- subscription and runtime lifecycle.

VAM does not own Library names, Codexes, linguistic notes, or command policy.

## Public boundary

Import VAM only from the package root:

```ts
import {
	createVaultActionManager,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
```

Public operations return environment-free Effects. Callers can compose these Effects. The plugin is the execution boundary.

The API has four groups:

| Group | Examples |
| --- | --- |
| Dispatch | `dispatch` |
| Observation | `startListening`, `subscribeToBulk` |
| Vault reads | `readContent`, `exists`, `findByBasename`, `list`, `listAllFilesWithMdReaders` |
| Active editor | `mdPwd`, `getOpenedContent`, `getSelectionInfo`, `cd`, `scrollOpenedFileToLine` |

Do not import internal ports, the runtime, or helper classes.

## Typed paths, actions, and events

`SplitPath` is a discriminated union:

```ts
type AnySplitPath =
	| { kind: "Folder"; pathParts: string[]; basename: string }
	| { kind: "File"; pathParts: string[]; basename: string; extension: string }
	| { kind: "MdFile"; pathParts: string[]; basename: string; extension: "md" };
```

A `VaultAction` requests a vault change. Supported operations are:

| Target | Operations |
| --- | --- |
| Folder | Create, rename, trash |
| File | Create, rename, trash |
| Markdown file | Upsert, process, rename, trash |

`UpsertMdFile` with `content: null` means "ensure that this file exists." It must not overwrite existing content.

`ProcessMdFile` applies a transform to current content. VAM routes the operation to the active editor or the background vault adapter.

A `VaultEvent` is a typed create, rename, or delete observation from Obsidian. It is not a `VaultAction`.

## Dispatch pipeline

Each `dispatch(actions)` call is one Dispatch Batch.

```text
actions
  -> add missing prerequisites
  -> collapse redundant actions
  -> build the dependency graph
  -> topologically sort
  -> register expected Self Events
  -> execute actions in sequence
```

The coordinator processes submitted batches in first-in, first-out order. Batches do not interleave.

Important rules:

- Trash wins over other actions for the same path.
- Multiple Markdown transforms compose in submission order.
- A content write wins over an earlier transform for the same file.
- Parent folders are created before their children.
- All Self Event paths are registered before execution starts.
- Each caller receives the result of its own batch.

A Dispatch Batch is not atomic. VAM does not roll back actions that completed before a later failure. The failure reports the affected operation and retains the original cause.

## Observation pipeline

```text
Obsidian create, rename, and delete callbacks
  -> attribute and remove Self Events
  -> encode Vault Events
  -> collect one bounded event window
  -> collapse duplicates and rename chains
  -> identify Semantic Roots
  -> publish one BulkVaultEvent
```

Obsidian callbacks do not wait for subscribers. Each subscriber gets its own handler fiber. One subscriber failure must not stop observation or another subscriber.

The accumulator has a quiet deadline and an absolute maximum deadline. Continuous callbacks cannot keep a window open without limit.

The Self Event tracker uses two match types:

- Exact paths match one expected callback and then disappear.
- Folder source prefixes match descendant callback cascades until they expire.

`ProcessMdFile` is not tracked because VAM does not subscribe to Obsidian modify callbacks.

## Markdown access

`MarkdownFileAccess` owns the route between the active editor and background vault I/O.

- Reads and transforms of the active file use the editor adapter.
- Reads and transforms of other files use the vault adapter.
- Selection preservation during rename stays inside this module.
- Consumers request intent. They do not select an adapter.

This single route prevents differences between read and write behavior.

## Effect runtime and lifecycle

`createVaultActionManager` creates one managed Effect runtime. The runtime supplies two Obsidian ports:

- `VaultIo` for vault, file-manager, and metadata-cache operations;
- `ActiveEditorAccess` for the active Markdown view and navigation.

Internal modules return Effect programs. They do not create runtimes.

Shutdown is idempotent. It:

1. Closes public subscriptions.
2. Stops observation and listeners.
3. Lets the active Dispatch Batch finish.
4. Fails queued and new submissions with a typed shutdown error.
5. Disposes the managed runtime.

Errors remain typed at the package boundary. They include the operation, cause, and path or action when applicable.

## Test boundary

The production API does not expose queues, traces, or timing controls.

`VaultActionManagerTestingAdapter.whenSettled()` observes the production graph. It waits for dispatch, event-window flush, subscriber work, Self Event settlement, and file queryability.

Desktop scenarios use this idle barrier. They must not inspect VAM internals or add sleeps.

## Source map

| Area | Location |
| --- | --- |
| Public facade | `src/packages/independent/vault-action-manager/src/facade.ts` |
| Effect runtime and ports | `src/packages/independent/vault-action-manager/src/effect/` |
| Dispatch | `src/packages/independent/vault-action-manager/src/impl/actions-processing/` |
| Observation | `src/packages/independent/vault-action-manager/src/impl/event-processing/` |
| Markdown routing | `src/packages/independent/vault-action-manager/src/file-services/markdown-file-access.ts` |
| Testing adapter | `src/packages/independent/vault-action-manager/src/testing-adapter.ts` |
| Public types | `src/packages/independent/vault-action-manager/src/types/` |
