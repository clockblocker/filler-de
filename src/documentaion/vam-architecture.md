# Vault Action Manager architecture

The Vault Action Manager (VAM) is the only supported Obsidian I/O boundary for the Librarian and Textfresser.

Related decisions:

- [ADR-0001: Use VAM as the Librarian's Obsidian boundary](../../docs/adr/0001-use-vam-as-the-librarians-obsidian-boundary.md)
- [ADR-0002: Coalesce Obsidian callbacks into Bulk Vault Events](../../docs/adr/0002-coalesce-obsidian-callbacks-into-bulk-vault-events.md)
- [ADR-0005: Use one Effect runtime inside VAM](../../docs/adr/0005-use-one-effect-runtime-inside-vam.md)
- [ADR-0011: Use different compatibility policies for domain and infrastructure](../../docs/adr/0011-use-different-compatibility-policies-for-domain-and-infrastructure.md)

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
| Dispatch | `dispatch`, `dispatchStopOnFirstFailure` |
| Observation | `startListening`, `subscribeToBulk`, `subscribeToMdModifications` |
| Vault reads | `readContent`, `readContentWithStat`, `exists`, `findByBasename`, `list`, `scan`, `scanWithStat` |
| Active editor | `mdPwd`, `getOpenedContent`, `getSelectionInfo`, `cd`, `scrollOpenedFileToLine` |

`scan` owns recursive traversal. A resolved root returns a `Complete` or
`Partial` result; partial results retain successful file paths and typed
diagnostics for failed nested folders. A root-resolution failure stays in the
Effect error channel. Markdown entries expose lazy, environment-free read
Effects and never expose live Obsidian file references.

`scanWithStat` and `readContentWithStat` add Obsidian's cached
`VaultFileStat` (`ctime`, `mtime`, `size`), so a startup index can key cached
entries by `(path, mtime)`. `scan` entries stay unchanged because consumers
spread them into Split Paths. A file whose stat cannot be read is omitted from
`scanWithStat` with a `scanFile` diagnostic. `readContentWithStat` takes the
stat before reading, so content is never older than its stat. For the active
editor, the content may be unsaved while the stat describes the file on disk.

Do not import internal ports, the runtime, or helper classes.

## Typed paths, actions, and events

`SplitPath` is a discriminated union:

```ts
type AnySplitPath =
	| { kind: "Folder"; pathParts: string[]; basename: string }
	| { kind: "File"; pathParts: string[]; basename: string; extension: string }
	| { kind: "MdFile"; pathParts: string[]; basename: string; extension: "md" };
```

Callers parse and format these identities through one package-root interface:

```ts
import { splitPathCodec } from "@textfresser/vault-action-manager";

const splitPath = splitPathCodec.parse("Library/Section/Note.md");
const systemPath = splitPathCodec.format(splitPath);
const vaultRoot = splitPathCodec.root;
```

The codec accepts domain values only. Conversion to or from Obsidian `TFile`, `TFolder`, `TAbstractFile`, and `Vault` objects is an internal adapter concern and is not exported from the package root.

A `VaultAction` requests a vault change. Supported operations are:

| Target | Operations |
| --- | --- |
| Folder | Create, rename, trash |
| File | Create, rename, trash |
| Markdown file | Upsert, process, rename, trash |

`UpsertMdFile` with `content: null` means "ensure that this file exists." It must not overwrite existing content.

`ProcessMdFile` applies a transform to current content. VAM routes the operation to the active editor or the background vault adapter.

In the background, a synchronous transform runs inside `Vault.process`, so the
read, transform, and write are one atomic step. Collapsed transforms stay
synchronous when every part is. An asynchronous transform starts against the
content `Vault.process` reads; once it settles, a second `Vault.process` writes
the result only if the file still holds that content. Otherwise the action
fails with `VamContentConflictError` and the newer content stays in place. VAM
never re-runs a transform. The active-editor route applies the same re-check
and fails with an `IdentityMismatch` error.

A `VaultEvent` is a typed create, rename, or delete observation from Obsidian. It is not a `VaultAction`.

## Dispatch pipeline

Each `dispatch(actions)` call is one Dispatch Batch.

```text
actions
  -> add missing prerequisites
  -> collapse redundant actions
  -> build the dependency graph
  -> topologically sort
  -> for each action in sequence:
       open its Self Event window, execute it, start the window's TTL
```

The coordinator processes submitted batches in first-in, first-out order. Batches do not interleave.

The queue holds a bounded number of batches behind the active one. When it is
full, later submissions wait for space in submission order; VAM never drops an
accepted batch. A caller interrupted while its batch is still waiting
withdraws that batch. Once queued, a batch runs.

Waiting has a high ceiling, `MAX_PENDING_DISPATCH_BATCHES` (500 batches queued
or waiting). A submission that finds the ceiling reached is not accepted and
fails at once with `VamDispatchOverflowError`, so a runaway producer such as a
healing loop surfaces instead of growing the queue without limit.

Important rules:

- Trash wins over other actions for the same path.
- Multiple Markdown transforms compose in submission order.
- A content write wins over an earlier transform for the same file.
- Parent folders are created before their children.
- Each action's Self Event paths are registered immediately before it runs.
  They stay expected while it runs and for one TTL (5 s) after it ends, so
  the window does not depend on how long the batch is. Actions a stopped
  batch skips register nothing.
- Each caller receives the result of its own batch.

A Dispatch Batch is not atomic. VAM does not roll back actions that completed before a later failure. The failure reports the affected operation and retains the original cause.

By default, `dispatch` attempts every planned action and reports all action
failures together. `dispatchStopOnFirstFailure` stops at the first failed
action and fails with `VamDispatchStoppedError`, which carries that failure,
the planned actions already executed, and the planned actions skipped. Planned
actions include prerequisites VAM added, such as parent folders.

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

### Markdown modifications

```text
Obsidian modify callbacks for Markdown files
  -> remove modify Self Events
  -> copy the file's stat
  -> collect one bounded event window
  -> keep one modification per path, with its latest stat
  -> publish one BulkMdModifyEvent
  -> scope it to each subscriber's folder
```

`subscribeToMdModifications(folder, handler)` reports content changes that VAM
did not make: hand edits, Obsidian Sync, and Obsidian's link rewriting after
`fileManager.renameFile`. It is a separate observation channel with its own
listener, window, and subscribers, so it never changes the timing or content of
Bulk Vault Events. The modify listener is acquired only while a modify
subscriber exists and listening was started. The two channels are not ordered
relative to each other; structural changes appear only in `subscribeToBulk`.

Modify Self Events are recorded at write time, not at planning time, because
only the background writer knows whether a write happens. `TFileHelper`
records one expectation immediately before each `vault.modify` and, for
`vault.process`, synchronously inside the callback and only when the callback
changes the content, since Obsidian writes nothing when the callback returns
its input. A modify callback that lands before the callback runs, or during a
`vault.process` call that writes nothing (an unchanged `ProcessMdFile`, the
first call of an asynchronous transform, a revalidation that lost a content
race), is therefore never hidden. An expectation is withdrawn when its write
fails. Modify expectations are counted per path, expire with the tracker TTL,
and never hold the settle barrier open. Acquiring the modify listener clears
them, because writes made while nobody listened left expectations whose
callbacks already fired.

One leftover remains: if Obsidian does not report a VAM write at all, for
example a rewrite with the same size within the same millisecond that its
watcher does not see as a change, the expectation stays until the TTL and can
hide one hand edit to that path made within it.

`whenSettled` settles to a fixed point. Each round waits for dispatch to go
idle, flushes both channels and waits for their subscribers, then waits for the
Dispatch Batches those subscribers submitted. Rounds repeat until one publishes
no window, so a modify window opened by the last dispatch is included.

Writes routed to the active editor are not attributed. Obsidian persists them
with a debounced editor save that can also carry the user's own typing, so
suppressing that save could hide a hand edit. Subscribers can see such an echo
and should treat modifications idempotently.

Self Events are VAM-wide: a modification made through any VAM caller,
including the Librarian, is filtered for every modify subscriber.

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
4. Fails queued, waiting, and new submissions with a typed shutdown error.
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
