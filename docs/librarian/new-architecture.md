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
{ coreName: CoreName, coreNameChainToParent: CoreNameChainFromRoot, tRef: TFile, nodeType: "Scroll", status: "Done" | "NotStarted" }
- FileNodes (a shadows of non-markdown Tfiles)
{ coreName: CoreName, coreNameChainToParent: CoreNameChainFromRoot, tRef: TFile, nodeType: "File", status: "Unknown" }
- SectionNodes (a shadows of Tfolder)
{ coreName: CoreName, coreNameChainToParent: CoreNameChainFromRoot, tRef: TFolder, nodeType: "Section", status: "Done" | "NotStarted", children: (ScrollNode | FileNode | SectionNode)[]}

LibraryTree is itialized with an array of TreeLeafDtos: 
((ScrollNode | FileNode) & Pick<SplitPath, "pathParts">)[]

LibraryTree has applyApplyTreeAction method. TreeAction hase types:
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
applyApplyTreeAction modifies the tree and retunes coreNameChain to the closest to root impacted node.

there is a util findCommonAncestor(coreNameChains: CoreNameChainFromRoot[])

LibraryTree can serialize itself to TreeLeafDtos (for copy creation)
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


