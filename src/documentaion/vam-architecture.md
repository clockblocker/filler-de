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
| Dispatch | `dispatchWithReport`, `dispatch`, `dispatchStopOnFirstFailure` |
| Observation | `startListening`, `subscribeToBulk`, `subscribeToMdModifications`, `subscribeToProtectedPathModifications` |
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

### Vault Path identity

`VaultPath` decides when two path strings are one path and when one lies
under another. Do not compare paths with `===`, `startsWith`, or
`toLowerCase`.

```ts
import { VaultPath } from "@textfresser/vault-action-manager";

VaultPath.caseSensitive.isUnder("Worter/de/a.md", "Worter", { inclusive: false }); // true
VaultPath.caseSensitive.isUnder("Worterbuch/a.md", "Worter", { inclusive: true }); // false
vam.paths.same("Exemplar/a.md", "exemplar/A.md"); // true on macOS and Windows
```

Every comparison first normalizes both paths as Obsidian's `normalizePath`
does: `/` and `\` runs become one `/`, edge slashes go, non-breaking spaces
become spaces, and the result is NFC. The root stays `""`. Containment goes by
whole segments, and the root lies above every other path.

Case is the caller's choice of identity:

| Identity | Case | Use it for |
| --- | --- | --- |
| `VaultPath.caseSensitive` | matters | Anything that feeds Obsidian's exact lookup, a path-keyed map, or a rename that may change only case: Library scope, the dictionary's scope, Self Events, Markdown modification scopes, active-editor routing. |
| `vam.paths` | as the vault's file system | Whether two paths land on one file: protected paths, delimiter rename collisions. |

`vam.paths` reads Obsidian's undocumented `adapter.insensitive` flag. The
desktop adapter sets it by probing the vault folder (it writes `.OBSIDIANTEST`
and checks for `.obsidiantest`), so a case-sensitive APFS volume is detected.
Without the flag, the platform decides: macOS and Windows ignore case. Off
desktop, VAM assumes case is ignored: the mobile adapter sets the flag to
`false` without probing, and Android's shared storage ignores case, so
protected paths and the collision check refuse more rather than less.
`createVaultActionManager(app, { fileSystem })` overrides it for tests.
`VaultPath.caseInsensitive` and `VaultPath.forFileSystem` exist for callers
and tests that need a fixed policy.

The only path Obsidian receives for a lookup is a branded `SystemPath`, made by
`toSystemPath` inside VAM's lookup adapter: the normalized path, with the root
as `"/"`, which `getRoot()` answers.

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
and fails with an `IdentityMismatch` error. The dispatch report gives both the
failure kind `conflict`; `isContentConflict(failure)` asks for it.

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
fails at once, for a `VamDispatchOverflowError`, so a runaway producer such as
a healing loop surfaces instead of growing the queue without limit.

Important rules:

- Trash wins over other actions for the same path.
- Multiple Markdown transforms compose in submission order.
- A content write wins over an earlier transform for the same file.
- Parent folders are created before their children.
- Trashes below a renamed folder's source run before that rename, so they
  still find their targets.
- Each action's Self Event paths are registered immediately before it runs.
  They stay expected while it runs and for one TTL (5 s) after it ends, so
  the window does not depend on how long the batch is. Actions a stopped
  batch skips register nothing.
- Each caller receives the result of its own batch.

A Dispatch Batch is not atomic. VAM does not roll back actions that completed
before a later failure; the report below says what each one did.

By default, a batch attempts every planned action. With
`stopOnFirstFailure`, it stops at the first failed action and reports the rest
as skipped. Planned actions include prerequisites VAM added, such as parent
folders.

## Dispatch reports

`dispatchWithReport(actions, { stopOnFirstFailure })` answers a
`VamDispatchReport`, the batch's receipt. `dispatch` and
`dispatchStopOnFirstFailure` run the same batch for callers that need only
success, and answer `void`. All three fail with one error,
`VamDispatchFailure`, which carries the same report and a `reason`:

| `reason` | When | Report |
| --- | --- | --- |
| `VamDispatchError` | An action failed; this is the first one. | Every planned action |
| `VamPlanningError` | Planning failed. | Every submitted action `Skipped` |
| `VamProtectedPathError` | The batch named a protected path. | Every submitted action `Skipped` |
| `VamDispatchOverflowError` | The queue was at its ceiling. | Every submitted action `Skipped` |
| `VamShutdownError`, `VamSetupError` | VAM was shut down, or could not start. | Every submitted action `Skipped` |

The report has one entry per planned action, in the order VAM ran them. Its
`status` is:

- `Done`, with an `outcome`: what the action did.
- `Failed`, with its `VamDispatchError`: it failed and changed nothing.
- `Uncertain`, with its `VamDispatchError`: it failed and may have changed
  the vault, such as a rename that moved the file and then could not restore
  the editor selection.
- `Skipped`: it never ran.

A `VamDispatchError` names its typed `action` and a `kind`: `conflict` (the
file or editor changed under it), `missing` (its file or folder was not
there), `io` or `defect`. The first two are `Failed`, the others `Uncertain`.

Outcomes record what actually happened, so a caller can build guarded
inverses from them:

| Outcome | Meaning | Inverse a caller could build |
| --- | --- | --- |
| `Created { contentHash? }` | Made the file or folder. | Trash it while it still has `contentHash`. |
| `Wrote { beforeHash, afterHash }` | Changed an existing file. | Restore a captured pre-image whose hash is `beforeHash`, while the file still has `afterHash`. |
| `Renamed { to }` | Moved the source to `to`. | Rename back while the file is at `to`. |
| `RenamedToIndexed { to }` | The target was taken; moved to the free indexed path `to`. | Rename back from `to`. |
| `TrashedDuplicate` | The target already held the source's content; the source went to the trash. | None needed for content; the target holds it. |
| `Trashed` | Moved the target to the trash. | None in VAM. |
| `NoOp` | Changed nothing. | None. |

Hashes are `vaultContentHash`es of the whole file. The report also answers
`executed`, `failed`, `uncertain` and `skipped`, and `touchedVault`: `yes`
when an action changed something, `unknown` when none did but an `Uncertain`
one may have, `no` otherwise. VAM itself never undoes anything.

## Protected paths

`createVaultActionManager(app, { protectedPaths })` takes vault path prefixes
that no Dispatch Batch may change. The plugin protects `Exemplar`, which holds
the design-reference notes such as `Exemplar/Kohlekraftwerk/`. The list is a
constant in `src/managers/obsidian/protected-paths/`, not a setting.

A prefix protects its own path and everything below it. Matching uses whole
segments, so `Exemplar` covers `Exemplar/Note.md` but not
`Exemplars/Note.md`. It compares case as the vault's file system does
(`vam.paths`), because the file systems of macOS and Windows put
`exemplar/x.md` in `Exemplar/`; on a case-sensitive file system that is
another folder and is not protected. It also ignores stray slashes,
backslashes, and Unicode composition. The vault root (`""`) cannot be a
prefix.

Dispatch checks each submitted batch before it queues it. If any action names
a protected path, the whole batch fails, for a `VamProtectedPathError`, and
none of it runs. A protected path here is a target, or either end of a rename. A
rename or trash of a folder that contains a prefix is refused too, and so is
the vault root, which contains every prefix. Creating such a folder is
allowed. Planning only adds parent folders of submitted targets, so checking
the submission is enough. `replaceActiveLine` is not a dispatch and is not
checked: it edits the open note at the user's command.
`protectedPrefixOf(path)` answers the same match up front. Classify and the
dictionary reset ask it before they write `Worter/` for a Scroll, because a
refused Scroll write afterwards would leave the dictionary half-written.

VAM cannot stop Obsidian from writing these files. The link updater rewrites
links in any file after `fileManager.renameFile`, and Sync or other plugins
may write them too. `subscribeToProtectedPathModifications` reports these
writes. It runs over the Markdown modification channel below and labels each
change with an `origin`:

- `VamRenameLinkUpdate`: the file's mtime falls within a rename that VAM ran
  with link updating, plus a 5 s grace.
- `OpenInEditor`: otherwise, if a Markdown view shows the file. This is most
  likely the user's own typing.
- `Unattributed`: anything else.

The plugin shows a Notice for every origin except `OpenInEditor`. The Notice
stays until dismissed and names each file. Hand edits to an open exemplar
therefore raise no alarm. A rewrite after a VAM rename still raises one while
the note is open. One case is missed: Obsidian's link updater rewrites an
open exemplar after a rename the user made. If the editor lookup fails, the
change counts as `Unattributed`, so a failure can add a warning but never
hide one.

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

The Self Event tracker uses three match types:

- Exact paths match one expected callback and then disappear.
- Folder source prefixes match descendant callback cascades until they expire.
- Folder rename pairs match, until they expire, each descendant rename
  Obsidian reports for a folder VAM renamed: the old path lies under the
  source, and the new path is the same remainder under the destination.

A rename callback is Self when both of its paths match, or when it is such a
descendant pair. The destination is not a prefix, so a user's create or
rename into it stays observable during the window.

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
writes over an existing Markdown file only through `vault.process`, for
`UpsertMdFile` as for `ProcessMdFile`, and records one expectation
synchronously inside the callback and only when the callback changes the
content, since Obsidian writes nothing when the callback returns its input. A modify callback that
lands before the callback runs, or during a `vault.process` call that writes
nothing (an unchanged `ProcessMdFile` or `UpsertMdFile`, the first call of an
asynchronous transform, a revalidation that lost a content race), is
therefore never hidden. An expectation is withdrawn when its write
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
4. Fails queued, waiting, and new submissions, for a `VamShutdownError`.
5. Disposes the managed runtime.

Errors remain typed at the package boundary. They include the operation, cause, and path or typed action when applicable, and a `message` built from them.

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
| Dispatch reports | `src/packages/independent/vault-action-manager/src/effect/dispatch-report.ts` |
| Observation | `src/packages/independent/vault-action-manager/src/impl/event-processing/` |
| Markdown routing | `src/packages/independent/vault-action-manager/src/file-services/markdown-file-access.ts` |
| Testing adapter | `src/packages/independent/vault-action-manager/src/testing-adapter.ts` |
| Public types | `src/packages/independent/vault-action-manager/src/types/` |
