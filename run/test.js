[TreeStalenessTest] readTreeFromVault: root=Library leavesCount=2
[TreeStalenessTest]   leaf: coreName=Sonne chain= tRefPath=Library/Sonne.md tRefBasename=Sonne
[TreeStalenessTest]   leaf: coreName=Sonne chain=Songs tRefPath=Library/Songs/Sonne-Songs.md tRefBasename=Sonne-Songs
[TreeStalenessTest] analyzeLeaf: coreName=Sonne chain= tRefPath=Library/Sonne.md tRefBasename=Sonne ext=md
[TreeStalenessTest] analyzeLeaf: coreName=Sonne chain=Songs tRefPath=Library/Songs/Sonne-Songs.md tRefBasename=Sonne-Songs ext=md
[TreeStalenessTest] handleRename: {oldPath: 'Library/Songs/Sonne-Songs.md', newPath: 'Library/Songs/Rammstien/Sonne-Songs.md', isFolder: false, actionsCount: 1, actions: Array(1)}actions: Array(1)0: {type: 'RenameMdFile'}length: 1[[Prototype]]: Array(0)actionsCount: 1isFolder: falsenewPath: "Library/Songs/Rammstien/Sonne-Songs.md"oldPath: "Library/Songs/Sonne-Songs.md
Initialized Excalidraw Image Cache
[main] loadPlugin started
[main] vaultActionManager created
[TreeStalenessTest] readTreeFromVault: root=Library leavesCount=2
[TreeStalenessTest]   leaf: coreName=Sonne chain= expectedPath=Library/Sonne.md
[TreeStalenessTest]   leaf: coreName=Sonne chain=Songs expectedPath=Library/Songs/Sonne.md
[Librarian] Tree initialized successfully, leaves: 2
[main] loadPlugin completed
[main] Librarian initialized, healed: 0 files
event {from: {…}, to: {…}, type: 'FileRenamed'}from: basename: "Sonne-Songs"extension: "md"pathParts: (2) ['Library', 'Songs']type: "MdFile"[[Prototype]]: Objectto: basename: "Sonne-Songs"extension: "md"pathParts: (3) ['Library', 'Songs', 'Rammstien']type: "MdFile"[[Prototype]]: Objecttype: "FileRenamed"[[Prototype]]: Object
[extractFileInfo] input path: {basename: 'Sonne-Songs', extension: 'md', pathParts: Array(3), type: 'MdFile'}basename: "Sonne-Songs"extension: "md"pathParts: (3) ['Library', 'Songs', 'Rammstien']type: "MdFile"[[Prototype]]: Object
[extractFileInfo] parsed: {coreName: 'Sonne', splitSuffix: Array(1)}
[TreeStalenessTest] handleRename: oldPath=Library/Songs/Sonne-Songs.md newPath=Library/Songs/Rammstien/Sonne-Songs.md isFolder=false actionsCount=1 types=[RenameMdFile]
[TreeStalenessTest] applyActionsToTree: count=1 types=[RenameMdFile]
[TreeStalenessTest] translateRename: fromPath=Library/Songs/Rammstien/Sonne-Songs toPath=Library/Songs/Rammstien/Sonne-Rammstien-Songs fromChain=Songs/Rammstien/Sonne sameParent=true
[TreeStalenessTest] translateRename → ChangeNodeName: chain=Songs/Rammstien/Sonne newCoreName=Sonne
[TreeStalenessTest] translateVaultAction: vaultAction=RenameMdFile → treeAction=ChangeNodeName
[TreeStalenessTest] calling applyTreeAction: type=ChangeNodeName
[TreeStalenessTest] applyTreeAction: type=ChangeNodeName chain=Songs/Rammstien/Sonne
[TreeStalenessTest] changeNodeName: called chain=Songs/Rammstien/Sonne newCoreName=Sonne
[TreeStalenessTest] changeNodeName: node not found for chain=Songs/Rammstien/Sonne
[TreeStalenessTest] changeNodeName: available nodes in tree: chain=Sonne coreName=Sonne, chain=Songs/Sonne coreName=Sonne

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
