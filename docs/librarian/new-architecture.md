# LibrarianLegacy Architecture

Goal. To watch over the specified "Library" folder and:
1) Keep filenames in sync with their paths. 
2) Assist in navigation via genetaring and updating:
- metadata on md notes
- (later) the codexes of the filesystem


The core part of the sysytem are:

1) Vault Action Manager. Emits End-User-Triggered events. Accepts batches of Vault Actions and executes them. Does not emit anything for system-triggered events. Not a part of the Librarian directly. To be treated as external library.
Vault Action Manager acepts VaultActions

2) LibraryTree. The shadow of existing file system. Consists of:
- ScrollNodes (a shadows of markdown Tfiles)
{ coreName: CoreName, coreNameChainToParent: CoreNameChainFromRoot, extension: "md", type: "Scroll", status: "Done" | "NotStarted" }
- FileNodes (a shadows of non-markdown Tfiles)
{ coreName: CoreName, coreNameChainToParent: CoreNameChainFromRoot, extension: string, type: "File", status: "Unknown" }
- SectionNodes (a shadows of Tfolder)
{ coreName: CoreName, coreNameChainToParent: CoreNameChainFromRoot, type: "Section", status: "Done" | "NotStarted", children: (ScrollNode | FileNode | SectionNode)[]}

**Note on TFile references**: TFile references (tRef) are NOT stored in tree nodes because they become stale when files are renamed/moved. Obsidian does not automatically update TFile.path when files are renamed/moved, so storing tRefs in the tree would lead to stale references pointing to old paths. Instead, TFile references are resolved on-demand when file I/O is needed by reconstructing the path from tree structure (coreNameChainToParent + coreName + extension) and looking it up in the vault.

LibraryTree is initialized with:
- an array of TreeLeaf: (ScrollNode | FileNode)[]
  each leaf has coreNameChainToParent already set
- rootFolder: TFolder (the Library folder)

On initialization, LibraryTree:
1. Builds the tree structure from leaves (creating SectionNodes as needed)
2. Runs DFS to calculate section statuses: a section is "Done" iff all children are Done/Unknown

TreeLeaf creation uses codec `splitPathToLeaf(splitPathWithTRef, rootFolderName, suffixDelimiter)`:
- Converts SplitPath + TFile → TreeLeaf
- Derives coreNameChainToParent from pathParts (strips root folder)
- Initial status: NotStarted (for ScrollNode), Unknown (for FileNode)

Status injection uses `withStatusFromMeta(leaf, readContent, extractMetaInfo)`:
- Reads file content via provided function
- Extracts MetaInfo and applies status to ScrollNode

LibraryTree has applyTreeAction method. TreeAction has types:
- CreateNode
- DeleteNode
- ChangeNodeName:
    - updates coreName
    - updates the coreNameChainToParent of all it's children reqursively
- ChangeNodeStatus (for ScrollNodes and SectionNodes only): 
    - change in status of a SectionNode, changes all it's children's statuses recursively;
    - change in status of a ScrollNode, changes it's status
    - after the change of the target node is done, it's parent checks statuses of children. 
        - if none of the children are "NotStarted", it set's own status to "Done"
        - if one of the children is "NotStarted", it set's own status to "NotStarted"
        - if the new status has changed, trigger the same logic for it's parent
applyTreeAction modifies the tree and returns coreNameChain to the closest to root impacted node.

there is a util findCommonAncestor(coreNameChains: CoreNameChainFromRoot[])

LibraryTree can serialize itself to TreeLeaf[] (for copy creation)
LibraryTree supports getNode(coreNameChain: CoreNameChainFromRoot)

3) reconcilaltion
- clone the existing tree
- translate the Emited by Vault Action Manager End-User-Triggered events to TreeActions
- apply the TreeActions to the copy
- reconcilaltionActions = diffSubtree(existingTree, newTree, closestToRootImpactedNode): VaultAction[]
- VaultActionManager.dispath(reconcilaltionActions)


---

Example of "filenames in sync with their paths". 
Given settings { LibrarianRoot: "Library", suffixDelimeter: "-" }:
- "Library/parent/child/NoteBaseName-child-parent.md"; 
{ pathParts: ["Library", "parent", "child"], extension: "md", splitBasename: {coreName: "NoteBaseName", splitSuffix: ["child", "parent"] }} 
- "Library/doc/paper/Pekar/2025/The recency and geographical origins of the bat viruses ancestral to SARS_CoV and SARS_CoV_2-2025-Pekar-paper-doc.pdf"
{ pathParts: ["Library", "doc", "paper", "Pekar", "2025"], extension: "md", splitBasename: {coreName: "The recency and geographical origins of the bat viruses ancestral to SARS_CoV and SARS_CoV_2", splitSuffix: ["2025", "Pekar", "paper", "doc"] }}

---

See also: [Healing Modes Implementation](../plans/librarian-healing-modes.md) - how filename/path mismatches are detected and resolved.

