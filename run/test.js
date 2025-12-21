[TreeStalenessTest] readTreeFromVault: root=Library leavesCount=2
[TreeStalenessTest]   leaf: coreName=Sonne chain= tRefPath=Library/Sonne.md tRefBasename=Sonne
[TreeStalenessTest]   leaf: coreName=Sonne chain=Songs tRefPath=Library/Songs/Sonne-Songs.md tRefBasename=Sonne-Songs
[TreeStalenessTest] analyzeLeaf: coreName=Sonne chain= tRefPath=Library/Sonne.md tRefBasename=Sonne ext=md
[TreeStalenessTest] analyzeLeaf: coreName=Sonne chain=Songs tRefPath=Library/Songs/Sonne-Songs.md tRefBasename=Sonne-Songs ext=md
[TreeStalenessTest] handleRename: {oldPath: 'Library/Songs/Sonne-Songs.md', newPath: 'Library/Songs/Rammstien/Sonne-Songs.md', isFolder: false, actionsCount: 1, actions: Array(1)}actions: Array(1)0: {type: 'RenameMdFile'}length: 1[[Prototype]]: Array(0)actionsCount: 1isFolder: falsenewPath: "Library/Songs/Rammstien/Sonne-Songs.md"oldPath: "Library/Songs/Sonne-Songs.md
[main] loadPlugin completed
[main] Librarian initialized, healed: 0 files
[handleCodexCheckboxClick] {coreNameChain: Array(3), href: 'Sonne-Rammstien-Songs', newStatus: 'NotStarted'}
[Librarian] setStatus called before init, attempting to reinitialize...
setStatus @ 
handleCodexCheckboxClick @ 
await in handleCodexCheckboxClick
eval @ 
[Librarian] Failed to read tree from vault: Error: File not found: Failed to get file by path: Library/Songs/Rammstien/Sonne.md
at BackgroundFileServiceLegacy.readContent (:13)
init @ 
await in init
setStatus @ 
handleCodexCheckboxClick @ 
await in handleCodexCheckboxClick
eval @ 
[Librarian] Failed to initialize tree in setStatus
[TreeStalenessTest] translateRename: fromPath=Library/Songs/Rammstien/Sonne-Songs toPath=Library/Songs/Rammstien/Sonne-Rammstien-Songs fromChain=Songs/Rammstien/Sonne-Songs sameParent=true
[TreeStalenessTest] translateRename → ChangeNodeName: chain=Songs/Rammstien/Sonne-Songs newCoreName=Sonne-Rammstien-Songs
[TreeStalenessTest] translateVaultAction: vaultAction=RenameMdFile → treeAction=ChangeNodeName
[TreeStalenessTest] applyActionsToTree: count=1 types=[RenameMdFile]
[TreeStalenessTest] translateRename: fromPath=Library/Songs/Rammstien/Sonne-Songs toPath=Library/Songs/Rammstien/Sonne-Rammstien-Songs fromChain=Songs/Rammstien/Sonne-Songs sameParent=true
[TreeStalenessTest] translateRename → ChangeNodeName: chain=Songs/Rammstien/Sonne-Songs newCoreName=Sonne-Rammstien-Songs
[TreeStalenessTest] translateVaultAction: vaultAction=RenameMdFile → treeAction=ChangeNodeName
[TreeStalenessTest] applyActionsToTree: count=1 types=[RenameMdFile]
[TreeStalenessTest] translateRename: fromPath=Library/Songs/Rammstien/Sonne-Songs toPath=Library/Songs/Rammstien/Sonne-Rammstien-Songs fromChain=Songs/Rammstien/Sonne-Songs sameParent=true
[TreeStalenessTest] translateRename → ChangeNodeName: chain=Songs/Rammstien/Sonne-Songs newCoreName=Sonne-Rammstien-Songs
[TreeStalenessTest] translateVaultAction: vaultAction=RenameMdFile → treeAction=ChangeNodeName
