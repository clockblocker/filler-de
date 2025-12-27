# Librarian Architecture

Goal. To watch over the specified "Library" folder and:
1) Keep filenames in sync with their paths. 
2) Assist in navigation via generating and updating:
- metadata on md notes
- (later) the codexes of the filesystem


The core parts of the system are:

1) Vault Action Manager. Emits End-User-Triggered events. Accepts batches of Vault Actions and executes them. Does not emit anything for system-triggered events. Not a part of the Librarian directly. To be treated as external library.
- Vault Action Manager accepts VaultActions
- Provides `listAllFilesWithMdReaders(folder: SplitPathToFolder): Promise<SplitPathWithReader[]>` for file listing
- `SplitPathWithReader` includes `read(): Promise<string>` for markdown files (no tRef exposure)
- TFile references (tRef) are internal to the manager and should never leave it

**Invariant: Executor Requirements**
- **Critical Invariant**: When actions are passed to executor, all requirements are met.
- Dispatcher enforces this in `ensureAllRequirementsMet()`:
  - Files/folders that need to exist are created (only if they don't already exist)
  - Delete actions are filtered out if target doesn't exist
  - Executor assumes all requirements are met (no existence checks)
- This ensures no redundant operations and clear separation: dispatcher = requirements, executor = execution

2) LibraryTree. The shadow of existing file system. Consists of:
- ScrollNodes (a shadows of markdown Tfiles)
{ nodeName: NodeName, nodeNameChainToParent: NodeNameChain, extension: "md", type: "Scroll", status: "Done" | "NotStarted" }
- FileNodes (a shadows of non-markdown Tfiles)
{ nodeName: NodeName, nodeNameChainToParent: NodeNameChain, extension: string, type: "File", status: "Unknown" }
- SectionNodes (a shadows of Tfolder)
{ nodeName: NodeName, nodeNameChainToParent: NodeNameChain, type: "Section", status: "Done" | "NotStarted", children: (ScrollNode | FileNode | SectionNode)[]}

**Note on TFile references**: TFile references (tRef) are NOT stored in tree nodes because they become stale when files are renamed/moved. Obsidian does not automatically update TFile.path when files are renamed/moved, so storing tRefs in the tree would lead to stale references pointing to old paths. TFile references are now internal to the `ObsidianVaultActionManager` and should never leave it. External code (like Librarian) uses `SplitPathWithReader` instead, which provides a `read()` function for markdown files without exposing tRefs.

LibraryTree is initialized with:
- an array of TreeLeaf: (ScrollNode | FileNode)[]
  each leaf has nodeNameChainToParent already set
- No rootFolder parameter needed - library root read from global settings

On initialization, LibraryTree:
1. Builds the tree structure from leaves (creating SectionNodes as needed)
2. Runs DFS to calculate section statuses: a section is "Done" iff all children are Done/Unknown

Tree initialization flow (`readTreeFromVault`):
1. Reads `splitPathToLibraryRoot` from `getParsedUserSettings()`
2. Calls `listAllFilesWithMdReaders(splitPathToLibraryRoot)` to get all files with readers
3. Filters out codex files (generated files)
4. Converts each `SplitPathWithReader` to TreeLeaf using `splitPathToLeaf()` (reads settings internally)
5. For markdown files, reads content via `entry.read()` and extracts status from MetaInfo
6. Builds LibraryTree from the leaves

TreeLeaf creation uses codec `splitPathToLeaf(splitPath)`:
- Converts `SplitPathToFile | SplitPathToMdFile` → TreeLeaf (no tRef needed)
- Derives nodeNameChainToParent from pathParts (strips root folder)
- Reads `libraryRoot` and `suffixDelimiter` from `getParsedUserSettings()` globally
- Initial status: NotStarted (for ScrollNode), Unknown (for FileNode)

Status injection happens during tree initialization:
- Uses `SplitPathWithReader` from `listAllFilesWithMdReaders()` which provides `read()` for md files
- Reads content via `entry.read()` and extracts MetaInfo to apply status to ScrollNode

LibraryTree has applyTreeAction method. TreeAction has types:
- CreateNode
- DeleteNode
- ChangeNodeName:
    - updates nodeName
    - updates the nodeNameChainToParent of all it's children reqursively
- ChangeNodeStatus (for ScrollNodes and SectionNodes only): 
    - change in status of a SectionNode, changes all it's children's statuses recursively;
    - change in status of a ScrollNode, changes it's status
    - after the change of the target node is done, it's parent checks statuses of children. 
        - if none of the children are "NotStarted", it set's own status to "Done"
        - if one of the children is "NotStarted", it set's own status to "NotStarted"
        - if the new status has changed, trigger the same logic for it's parent
applyTreeAction modifies the tree and returns nodeNameChain to the closest to root impacted node.

there is a util findCommonAncestor(nodeNameChains: NodeNameChain[])

LibraryTree can serialize itself to TreeLeaf[] (for copy creation)
LibraryTree supports getNode(nodeNameChain: NodeNameChain)

3) Reconciliation
- Clone the existing tree
- Translate the emitted by Vault Action Manager End-User-Triggered events to TreeActions
  - `translateVaultAction(action)` - reads settings from global state, no context needed
- Apply the TreeActions to the copy
  - `applyActionsToTree(actions, { tree })` - simplified context, no settings needed
- ReconciliationActions = diffSubtree(existingTree, newTree, closestToRootImpactedNode): VaultAction[]
- VaultActionManager.dispatch(reconciliationActions)

**Settings Management:**
- All utilities read `libraryRoot` and `suffixDelimiter` from `getParsedUserSettings()` globally
- No parameter drilling - settings accessed where needed via global state
- `Librarian` constructor no longer takes settings parameters
- Context types (`TreeApplierContext`, `EventHandlerContext`) simplified - no settings fields


---

Example of "filenames in sync with their paths". 
Given settings (read from `getParsedUserSettings()`): `{ libraryRoot: "Library", suffixDelimiter: "-" }`:
- "Library/parent/child/NoteBaseName-child-parent.md"; 
{ pathParts: ["Library", "parent", "child"], extension: "md", separatedSuffixedBasename: {nodeName: "NoteBaseName", splitSuffix: ["child", "parent"] }} 
- "Library/doc/paper/Pekar/2025/The recency and geographical origins of the bat viruses ancestral to SARS_CoV and SARS_CoV_2-2025-Pekar-paper-doc.pdf"
{ pathParts: ["Library", "doc", "paper", "Pekar", "2025"], extension: "pdf", separatedSuffixedBasename: {nodeName: "The recency and geographical origins of the bat viruses ancestral to SARS_CoV and SARS_CoV_2", splitSuffix: ["2025", "Pekar", "paper", "doc"] }}

**Settings Access Pattern:**
- All filename utilities (`parseBasename`, `splitPathToLeaf`, `buildBasename`, etc.) read settings from `getParsedUserSettings()`
- No need to pass `libraryRoot` or `suffixDelimiter` as function parameters
- Settings are stored in global state and accessed where needed

---

See also: [Healing Modes Implementation](../plans/librarian-healing-modes.md) - how filename/path mismatches are detected and resolved.

