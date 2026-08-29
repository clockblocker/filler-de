# Textfresser Library Management

This context defines the language for the managed Library and its boundary with an Obsidian vault. It covers the Librarian, the Vault Action Manager, and the translation of observed vault changes into Library intentions.

## Managed Library

**Library**:
The configured subtree of an Obsidian vault whose organization, names, indexes, and reading state are kept consistent by the Librarian.
_Avoid_: Vault, repository, collection

**Section**:
A branch in the Library hierarchy, represented in the vault by a folder and in the Library Tree by a Section Node.
_Avoid_: Category, directory node

**Scroll**:
A Markdown content item in the Library that can carry reading status.
_Avoid_: Note, document, Markdown file

**File**:
A non-Markdown content item in the Library. A File has no reading progress and therefore has `Unknown` status.
_Avoid_: Asset, attachment, Scroll

**Codex**:
A Librarian-generated index for a Section, listing its children and exposing their reading status. A Codex describes Library content but is not itself a Library node.
_Avoid_: Index note, Scroll, table of contents

**Core Name**:
The user-meaningful part of a Scroll or File basename after its Library Suffix has been removed.
_Avoid_: Basename, filename

**Library Suffix**:
The delimiter-separated, reverse-ordered chain of ancestor Section names appended to a leaf's Core Name. It makes the leaf's intended Library position recoverable from its basename.
_Avoid_: Extension, path, tag

**Canonical Leaf**:
A Scroll or File whose vault location and basename encode the same Section chain under the current naming rules.
_Avoid_: Valid file, normalized note

**Reading Status**:
The progress state of a Scroll: `NotStarted`, `Done`, or `Unknown`. A Section's status is derived from its descendants rather than stored on the Section itself.
_Avoid_: Checkbox state, completion flag

## Library Consistency

**Librarian**:
The domain coordinator that maintains the Library Tree and reconciles the vault representation with the Library's naming, indexing, backlink, and reading-status rules.
_Avoid_: File watcher, Vault Action Manager, filesystem adapter

**Library Tree**:
The Librarian's hierarchical model of Sections, Scrolls, and Files. It represents Library identity independently of transient Obsidian file objects.
_Avoid_: Vault tree, folder tree, filesystem

**Tree Action**:
A semantic intention to create, delete, rename, move, or change the status of a node in the Library Tree.
_Avoid_: Vault Action, Healing Action, file operation

**Healing**:
Reconciliation that restores agreement between the Library Tree and its vault representation after an observed change.
_Avoid_: Migration, import, repair command

**Healing Action**:
A correction identified by Healing before it is translated into a Vault Action.
_Avoid_: Tree Action, Vault Action

**Observed Split Path**:
The actual vault location seen after a user operation, retained when Healing may need to move or rename that item to its canonical location.
_Avoid_: Canonical path, target locator

**Name-King Policy (`NameKing`)**:
The interpretation policy for a leaf placed directly under the Library root, where its Library Suffix expresses the intended Section chain.
_Avoid_: Filename mode, root mode

**Path-King Policy (`PathKing`)**:
The interpretation policy for a leaf inside nested Section folders, where the folder path expresses the intended Section chain and an inconsistent suffix is healed.
_Avoid_: Folder mode, nested mode

## Obsidian Boundary

**Vault Action Manager (VAM)**:
The Librarian's boundary for reading vault state, requesting vault changes, and observing typed vault events. VAM coordinates Obsidian interaction without owning Library semantics.
_Avoid_: BAM, Librarian, Obsidian DataAdapter

**Split Path**:
A typed, vault-scoped identity for a folder, Markdown file, or other file, separated into path parts, basename, kind, and—when applicable—extension.
_Avoid_: String path, system path, node locator

**Vault Action**:
A typed request for VAM to create, update, rename, process, or trash a vault item.
_Avoid_: Tree Action, Healing Action, Obsidian event

**Dispatch Batch**:
A set of Vault Actions submitted to VAM as one coordination unit. It is dependency-ordered and executed sequentially, but it is not an atomic transaction with rollback.
_Avoid_: Transaction, bulk event, atomic write

**Vault Event**:
VAM's typed observation of a create, rename, or delete reported by Obsidian.
_Avoid_: Vault Action, Tree Action, user-interface event

**Bulk Vault Event**:
A time-bounded observation containing normalized Vault Events plus Semantic Roots that identify independent user intent.
_Avoid_: BAM, Dispatch Batch, bulk operation

**Semantic Root**:
A Vault Event that represents an independent user operation after descendant effects and other derived noise have been removed. A folder root can imply changes to its entire subtree.
_Avoid_: First event, root folder, raw event

**Self Event**:
An Obsidian Vault Event expected as a consequence of a Vault Action dispatched by VAM, rather than a new user intention.
_Avoid_: Duplicate event, recursive action

**Bulk Vault Action Adapter**:
The Library boundary that translates a Bulk Vault Event into Tree Actions by applying Library scope, materializing single-node observations, and inferring Library intent. Despite its source name, it neither executes Vault Actions nor implements an Obsidian adapter.
_Avoid_: BAM, VAM, DataAdapter, bulk executor

**Materialized Node Event**:
A Library-scoped, single-node observation used between bulk-event normalization and Tree Action translation.
_Avoid_: Tree Action, raw Vault Event
