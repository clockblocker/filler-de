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
- Self Event attribution: labelling each event with its origin;
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
| Observation | `startListening`, `scanAndSubscribe`, `subscribeToBulk`, `subscribeToMdModifications`, `subscribeToProtectedPathModifications` |
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
| Markdown file | Create, upsert, process, rename, trash |

`UpsertMdFile` with `content: null` means "ensure that this file exists." It must not overwrite existing content.

`CreateMdFile` (and `CreateFile`) create a file only where none is. A file
or folder at the path, or at a path the vault's file system holds to be the
same (`Foo.md` for `foo.md` on macOS), fails the action with
`VamTargetExistsError`, kind `exists`, before anything is written. Obsidian's
`vault.create` refuses an existing file as well, so a file that appears
between that check and the create fails it the same way.

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

### Preconditions

A caller that planned a write from content it read can make the write
conditional on that content, so a hand edit made in between is never written
over or trashed. `ExpectedContent` is the whole content, or
`{ hash }` with its `vaultContentHash`, such as a report's `afterHash`.

| Action | Field | Checked | When it does not hold |
| --- | --- | --- | --- |
| `ProcessMdFile` | `expected` | Against the content the transform receives, inside the same `Vault.process` call that writes (in the editor, before the transform runs). | `VamContentConflictError`, kind `conflict`, `Failed`; nothing written. |
| `TrashMdFile` | `ifContent` | Against the content read immediately before the trash: the open editor's buffer, unsaved typing included, or the file on disk. | `VamContentConflictError`, kind `conflict`, `Failed`; nothing trashed. A file already gone is a `NoOp`. |
| `CreateMdFile`, `CreateFile` | (always) | That no file is at the path, as the file system compares names. | `VamTargetExistsError`, kind `exists`, `Failed`. |

The process check is atomic: nothing can land between the check and the
write. The trash check is one read away from the trash, the closest Obsidian
allows, since `trashFile` takes no callback. VAM creates no missing file
for a `ProcessMdFile`, so a file deleted meanwhile fails it as `missing`.

Collapse keeps the checks. Transforms of one file compose in submission
order, each behind its own check against the content it receives; the
composed action carries no `expected` of its own. A transform folded into a
`CreateMdFile` or a contentful `UpsertMdFile` runs, check included, on that
content during planning. An unconditional trash beats a guarded one for the
same file, and a trash still supersedes earlier transforms of its file.

### Rename collisions

`RenameMdFile`, `RenameFile` and `RenameFolder` take
`onCollision: "fail" | "index" | "dedupe"` for a target that is taken, by
its exact path or by a name the file system holds to be the same (a rename
that changes only the case of its own source is free):

| `onCollision` | Taken target | Source gone, target there |
| --- | --- | --- |
| `fail` | `VamTargetExistsError`, kind `exists`, `Failed`; nothing moves. | Kind `missing`, `Failed`. |
| `index` | Moves to the first free `1_<name>`, `2_<name>`, … (`RenamedToIndexed`). | `NoOp`. |
| `dedupe` (Markdown only) | Like `index`, except that a source whose content the target holds goes to the trash (`TrashedDuplicate`). | `NoOp`. |

The defaults keep the Librarian's behaviour: `dedupe` for `RenameMdFile`,
`index` for `RenameFile` and `RenameFolder`. A free indexed name is one no
sibling, file or folder, holds as the file system compares names, so
`1_Foo` and `1_foo` collide on macOS. The delimiter migration and the
dictionary reset's backup move use `fail`.

A `VaultEvent` is a typed create, rename, or delete observation from Obsidian. It is not a `VaultAction`.

### Callers, operations and origins

Every dispatch names its caller, and every delivered event names its
origin:

```ts
vam.dispatch(actions, { caller: "reset" });
vam.dispatchWithReport(actions, { caller: "librarian", operationId, stopOnFirstFailure });

type VaultEventOrigin =
	| { kind: "Vam"; caller: string; operationId: string }
	| { kind: "LinkUpdate"; operationId: string }
	| { kind: "External" };
```

The caller is a plain name (`librarian`, `dictionary`, `classify`, `reset`,
`migration`, `textfresser`); VAM gives it no meaning beyond telling callers
apart. The `operationId` names one Dispatch Batch. A caller may pass one, for
example to line several of its batches up; otherwise VAM makes
`<caller>#<n>`, fresh on each run of the Effect. It appears in the batch's
report, as the `vam.caller` and `vam.operationId` attributes of its
`vam.dispatch` and `DispatchBatch.executeBatch` spans, and in the origin of
every event the batch causes.

- `Vam`: the Self Event windows below attributed the callback to a batch.
- `LinkUpdate`: a Markdown modification inside the window of a rename VAM ran
  with link updating, so most likely Obsidian's link updater rewriting a
  link; it carries the rename's `operationId`. The window is the timing
  heuristic of `LinkRewriteWindows` (the rename's run plus a 5 s grace, by
  the file's mtime), so a hand edit inside it is labelled too.
- `External`: anything else: the user, Sync, another plugin, or a VAM write
  routed to the open editor (see below).

Each subscription (`subscribeToBulk`, `subscribeToMdModifications`,
`scanAndSubscribe`) takes `{ from }`:

| `from` | Delivers |
| --- | --- |
| `external` (default) | Everything but `Vam`. `LinkUpdate` arrives, as before origins existed. |
| `allButMine` (with `caller`) | Everything but `Vam` events of `caller`. |
| `all` | Everything. |

The Librarian subscribes with `external`, so it never heals its own renames
or another caller's. The dictionary store subscribes with `allButMine` as
`dictionary`, so the reset's and the metadata migration's writes under
`Worter/` reach it; it handles every event by reading the named paths again,
so an event it hears twice changes nothing. The protected-path watcher takes
`all`. Classify's unlink observer and the other subscribers keep the default.

Attribution is the same per-action windows as before, with the folder-rename
remainder rule and the indexed destinations of a redirected rename: they
now decide a label instead of whether anyone hears the event. A
misattribution mislabels one event for the subscribers that filter on its
origin, instead of hiding it from every subscriber.

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

`dispatchWithReport(actions, { caller, operationId, stopOnFirstFailure })`
answers a `VamDispatchReport`, the batch's receipt, with its `caller` and
`operationId`. `dispatch` and `dispatchStopOnFirstFailure` take
`{ caller, operationId }` and run the same batch for callers that need only
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
file or editor changed under it, or a precondition did not hold), `exists`
(its target was taken), `missing` (its file or folder was not there), `io`
or `defect`. The first three are `Failed`, the others `Uncertain`. Its
`cause` is the typed error the action failed with, such as
`VamContentConflictError` or `VamTargetExistsError`.

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
writes. It runs over the Markdown modification channel below with every
origin, and gives each change a `writer` from its origin:

- `VamRenameLinkUpdate`: its origin is `LinkUpdate`.
- `OpenInEditor`: otherwise, if its origin is `External` and a Markdown view
  shows the file. This is most likely the user's own typing.
- `Unattributed`: anything else. VAM never writes a protected path, so a
  change labelled `Vam` is a misattribution and counts here.

The plugin shows a Notice for every writer except `OpenInEditor`. The Notice
stays until dismissed and names each file. Hand edits to an open exemplar
therefore raise no alarm. A rewrite after a VAM rename still raises one while
the note is open. One case is missed: Obsidian's link updater rewrites an
open exemplar after a rename the user made. If the editor lookup fails, the
change counts as `Unattributed`, so a failure can add a warning but never
hide one.

## Observation pipeline

```text
Obsidian create, rename, and delete callbacks
  -> number each callback
  -> attribute it: label its origin
  -> encode Vault Events
  -> collect one bounded event window
  -> per subscriber: keep the callbacks after its cursor, of origins it takes
  -> collapse duplicates and rename chains
  -> identify Semantic Roots
  -> publish one BulkVaultEvent
```

Obsidian callbacks do not wait for subscribers. Each subscriber gets its own handler fiber. One subscriber failure must not stop observation or another subscriber.

Handlers are Effects, run in VAM's runtime: each in a fiber of its own,
scoped to the channel, so a handler's span and its failure's full cause stay
attached, and a handler that closes its own subscription is not interrupted.
VAM logs a failed handler's cause and goes on.

### Callback sequence and cursors

Every raw vault callback VAM listens to (create, rename, delete, modify)
gets the next number of one sequence shared by both channels, on entry and
before Self Event attribution. The event carries it through the window as
an `ObservedCallback { seq, event, origin }`. Cursor filtering reads `seq`;
origin filtering reads `origin`.

Each subscriber has a cursor: the latest callback it must not receive,
and an origin filter. A window is filtered by both before it is collapsed
and its roots reduced, so a subscriber whose cursor falls inside a window
gets that window's part after the cursor, collapsed among itself: a rename
chain `a -> b` before the cursor and `b -> c` after it arrives as `b -> c`,
never as `a -> c`. A chain of a user's rename `a -> b` and VAM's `b -> c`
reaches an `external` subscriber as `a -> b` and an `all` subscriber as
`a -> c`. A collapsed event carries its last hop's origin. A window wholly
after the cursor and of origins the subscriber takes reaches it as one
shared message; subscribers with one filter share the message of the rest. A plain subscription's cursor is the latest callback when it
subscribed, so a subscriber never receives what Obsidian fired before it
subscribed, though such callbacks may share its first window.

### Snapshot and subscribe

`scanAndSubscribe(folder, { onBulk, onModifications })` answers what the
folder holds and every change after it:

1. It subscribes `onBulk` to Bulk Vault Events (unscoped, as
   `subscribeToBulk`) and `onModifications` to Markdown modifications below
   `folder` (as `subscribeToMdModifications`). Both are gated: they deliver
   nothing until `start`.
2. It fails with `VamSubscriptionError` unless the channels are listening
   (`startListening`): changes VAM does not hear would be lost.
3. In one synchronous step it reads the sequence's latest number `N`, lists
   the folder from Obsidian's in-memory tree, and moves both cursors to
   `N`. No callback can land inside that step. Obsidian updates its tree
   before it fires a callback, so the snapshot holds every callback up to
   `N` and none after.

The snapshot (`VaultSnapshot`) is `scanWithStat`'s result plus `cursor`:
files with their stats, folders counted, a missing root as a `scanRoot`
`VamScanError`. Content is not part of it. A Markdown entry's `read` reads
the file when called, so it is at least as new as the snapshot and may
already show a change after `N`; that change is delivered too, so a consumer
that tracks content applies it idempotently, by reading again. A file moved
after `N` fails to read, and the rename after `N` says where it went.

The subscription answers:

| Member | Does |
| --- | --- |
| `snapshot` | The folder at `N`. |
| `start` | Starts delivery. Changes after the latest snapshot waited in VAM until now, so the consumer can build its state first. Settling waits for a subscriber that has not started. |
| `rescan` | A fresh snapshot, moving the cursors to its `N'`. Windows not yet delivered lose what it holds. A failed rescan leaves the cursors. |
| `afterSnapshot(bulk)` | A delivered bulk's part after the latest snapshot, or `null`; for work queued before a `rescan` and run after it. |
| `caughtUp` | As for any subscription, below. |
| `close` | Ends both subscriptions. `rescan` still answers a snapshot. |

Re-subscribing gets a fresh snapshot and cursor. The Librarian takes its
startup snapshot this way, starts delivery once startup reconciliation
ends, rescans on recovery, and trims each queued bulk with
`afterSnapshot` in its turn.

The accumulator has a quiet deadline and an absolute maximum deadline. Continuous callbacks cannot keep a window open without limit.

### Catching up

Every subscription answers `caughtUp`: it completes once the handler has
run for every callback VAM heard before the call, or skipped it as before
its cursor or of an origin it leaves out. It is a barrier for that
subscriber alone, queued behind those callbacks and published after the
window they close in. It never closes a window early, so it waits at most
`maxWindowMs` (2 s) plus the handler work ahead of it; a gated subscription
waits until it starts. A handler must not await its own subscription's
`caughtUp`. The dictionary reset awaits the store's after its backup move,
so no regeneration commits against the notes it moved away.

The Self Event tracker attributes a callback to the batch whose entry it
matches; each entry records its batch's operation. It uses three match
types:

- Exact paths match one expected callback and then disappear.
- Folder source prefixes match descendant callback cascades until they expire.
- Folder rename pairs match, until they expire, each descendant rename
  Obsidian reports for a folder VAM renamed: the old path lies under the
  source, and the new path is the same remainder under the destination.

A rename callback is Self when both of its paths match, under the batch of
the new path's entry, or when it is such a descendant pair, under the
folder rename's batch. The destination is not a prefix, so a user's create or
rename into it stays observable during the window.

A rename that lands elsewhere than its action's `to`, at a free indexed name,
tells the tracker before it moves anything, because Obsidian reports the
renames during the move (#175). The tracker then expects the actual
destination instead: its exact path and, for a folder, the rename pair from
the source to it, in the planned action's window, closing when that action
finishes. The planned destination's entries go, since nothing lands there.

### Markdown modifications

```text
Obsidian modify callbacks for Markdown files
  -> attribute it: Vam (a modify Self Event), else LinkUpdate, else External
  -> copy the file's stat
  -> collect one bounded event window
  -> keep one modification per path, with its latest stat
  -> publish one BulkMdModifyEvent
  -> scope it to each subscriber's folder
```

`subscribeToMdModifications(folder, handler, { from })` reports content
changes, each with its origin: hand edits, Obsidian Sync, Obsidian's link
rewriting after `fileManager.renameFile` (`LinkUpdate`), and, for a
subscription that takes them, VAM's own writes. It is a separate observation channel with its own
listener, window, and subscribers, so it never changes the timing or content of
Bulk Vault Events. The modify listener is acquired only while a modify
subscriber exists and listening was started. The two channels are not ordered
relative to each other; structural changes appear only in `subscribeToBulk`.

Modify Self Events are recorded at write time, not at planning time, because
only the background writer knows whether a write happens. The writer runs
inside its batch, which provides `CurrentVamOperation`, so the expectation
records the batch's operation. `TFileHelper`
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
no window, so a modify window opened by the last dispatch is included. VAM's
own writes enter windows too, so a round can publish a window no subscriber
takes; the round after it publishes none.

Writes routed to the active editor are not attributed: their modifications
are `External`. Obsidian persists them
with a debounced editor save that can also carry the user's own typing, so
suppressing that save could hide a hand edit. Subscribers can see such an echo
and should treat modifications idempotently.

Origins are VAM-wide: a modification made through any VAM caller is
labelled with that caller, and each modify subscriber's `from` decides
whether it hears it.

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
| Callback sequence | `src/packages/independent/vault-action-manager/src/impl/event-processing/callback-sequence.ts` |
| Snapshot traversal | `VaultReader.snapshot` in `src/packages/independent/vault-action-manager/src/impl/vault-reader.ts` |
| Markdown routing | `src/packages/independent/vault-action-manager/src/file-services/markdown-file-access.ts` |
| Testing adapter | `src/packages/independent/vault-action-manager/src/testing-adapter.ts` |
| Public types | `src/packages/independent/vault-action-manager/src/types/` |
| Callers, operations, origins | `src/packages/independent/vault-action-manager/src/types/event-origin.ts` |
| Link-update windows | `src/packages/independent/vault-action-manager/src/impl/event-processing/link-rewrite-windows.ts` |
