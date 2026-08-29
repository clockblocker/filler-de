# Librarian architecture

The Librarian keeps one configured Library subtree consistent. It owns Library meaning. It does not own Obsidian I/O.

Related decisions:

- [ADR-0001: Use VAM as the Librarian's Obsidian boundary](../../docs/adr/0001-use-vam-as-the-librarians-obsidian-boundary.md)
- [ADR-0002: Coalesce Obsidian callbacks into Bulk Vault Events](../../docs/adr/0002-coalesce-obsidian-callbacks-into-bulk-vault-events.md)
- [ADR-0003: Translate vault observations before Healing](../../docs/adr/0003-translate-vault-observations-before-healing.md)
- [ADR-0004: Encode the Section path in each leaf name](../../docs/adr/0004-encode-the-section-path-in-each-leaf-name.md)
- [ADR-0011: Use different compatibility policies for domain and infrastructure](../../docs/adr/0011-use-different-compatibility-policies-for-domain-and-infrastructure.md)

## Core model

| Term | Meaning | Vault form |
| --- | --- | --- |
| Section | A branch in the Library Tree | Folder |
| Scroll | A Markdown leaf with Reading Status | `.md` file |
| File | A non-Markdown leaf | Other file |
| Codex | A generated index for one Section | `__-<suffix>.md` |
| Library Tree | The in-memory model of Sections and leaves | No direct file |

Use the terms in `CONTEXT.md`. Do not use live `TFile` or `TFolder` objects as Library identity.

## Naming invariant

A leaf basename must encode its Section chain in reverse order. The Library root is not part of the suffix.

```text
Library/German/Verbs/laufen-Verbs-German.md

Core Name:       laufen
Section chain:   German/Verbs
Library Suffix:  Verbs-German
```

Sections do not have a Library Suffix.

The Librarian uses two interpretation policies:

| Policy | Input location | Authority |
| --- | --- | --- |
| `NameKing` | Leaf directly below the Library root | The suffix defines the target Section chain. |
| `PathKing` | Leaf inside a Section | The folder path defines the Section chain. Healing corrects the suffix. |

This rule lets the Librarian recover intent after a move. It also gives each leaf a vault-wide basename.

## Processing flow

```text
BulkVaultEvent
  -> apply Library scope
  -> materialize folder effects into node events
  -> infer policy and user intent
  -> TreeAction[]
  -> update the Library Tree
  -> compute Healing and Codex impact
  -> VaultAction[]
  -> VAM dispatch
```

The translation boundary must run before Healing. VAM remains unaware of Sections, suffixes, Codexes, and Reading Status.

### Tree actions

| Action | Meaning |
| --- | --- |
| `Create` | Add a Section or leaf. |
| `Delete` | Remove a node. |
| `Rename` | Change a Core Name without changing the parent. |
| `Move` | Change the parent Section. |
| `ChangeStatus` | Change Scroll progress. |

Tree actions use node locators. A locator contains deterministic Segment IDs for the node and its ancestors. It does not depend on a live Obsidian object.

`ObservedSplitPath` is optional evidence. A Create or Move action carries it only when Healing must compare the observed path with the canonical path.

## Healing

Healing compares observed vault state with the canonical path from the Library Tree.

| Change | Required correction |
| --- | --- |
| Create or rename a leaf | Correct its basename and suffix. |
| Move a leaf | Correct its folder and suffix. |
| Rename or move a Section | Correct the folder and all descendant suffixes. |
| Delete a node | Remove it from the tree and update affected Codexes. |
| Change status | Update metadata and Codexes. |

A duplicate Create gets a new Core Name. A Rename or Move that would overwrite an existing node fails.

`Tree.apply` reports whether the tree changed. Healing stops when the requested state already exists. This makes repeated event delivery idempotent.

Empty Sections stay in the tree until an explicit Section action removes them. This permits Codex cleanup after the last leaf leaves a Section.

A Healing Transaction groups tree changes, Healing Actions, and Codex impact for one event batch. It is an audit and coordination unit. It is not a rollback transaction.

## Codex and reading status

Each Section can have one generated Codex. A Codex lists direct and nested children in deterministic display order.

- A Scroll has `NotStarted`, `Done`, or `Unknown` status.
- A File always has `Unknown` status.
- A Section status is derived from its descendants.
- A Codex checkbox creates a `ChangeStatus` Tree Action.
- Codex files are generated output. They are not Library nodes.

The Librarian regenerates an affected Codex as a complete file. It does not patch individual list items.

## Runtime and startup

The Librarian serializes event batches. Two Healing batches must not mutate the tree at the same time.

At startup, the Librarian:

1. Reads all items below the Library root through VAM.
2. Skips Codex files.
3. Builds canonical Create actions.
4. Reads Scroll status metadata.
5. builds the Library Tree.
6. Starts the Bulk Vault Event subscription.
7. Dispatches initial Healing, Codex, and backlink actions.

The event subscription starts before the initial dispatch. VAM filters the resulting Self Events.

## Commands

| Command | Result |
| --- | --- |
| `SplitToPages` | Split one Scroll into a Section of page Scrolls. |
| `SplitInBlocks` | Add stable Obsidian block IDs. |
| `GoToNextPage` | Open the next Scroll in Library display order. |
| `GoToPrevPage` | Open the previous Scroll in Library display order. |

Navigation uses Library Tree order. It does not depend on stored next-page or previous-page metadata.

## Boundaries

- VAM owns typed vault paths, vault reads, dispatch, and event attribution.
- Library Core owns codecs, the tree, Healing policy, and Codex calculation.
- The Librarian commander owns startup, serialization, commands, and VAM coordination.
- Note metadata and go-back links are projections of Library state.

## Source map

| Area | Location |
| --- | --- |
| Commander and startup | `src/commanders/librarian/` |
| Pure Library model | `src/packages/composed/library-core/` |
| Tree and Healing | `src/packages/composed/library-core/src/healer/`, `src/packages/composed/library-core/src/healing/` |
| Codecs | `src/packages/composed/library-core/src/codecs/` |
| Codex | `src/packages/composed/library-core/src/codex/` |
| Pages and navigation | `src/commanders/librarian/pages/`, `src/commanders/librarian/navigation/` |
