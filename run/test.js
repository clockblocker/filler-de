[handleCodexCheckboxClick] {coreNameChain: Array(3), href: 'Yesterday-Beatles-Songs', newStatus: 'NotStarted'}coreNameChain: (3) ['Songs', 'Beatles', 'Yesterday']href: "Yesterday-Beatles-Songs"newStatus: "NotStarted"[[Prototype]]: Object
[Dispatcher] dispatch: input actions: 1
[Dispatcher] dispatch: input action types: ['ReplaceContentMdFile']
[Dispatcher] dispatch: after ensureAllDestinationsExist: 5
[Dispatcher] dispatch: after ensureAllDestinationsExist types: (5) ['ReplaceContentMdFile', 'CreateFolder', 'CreateFolder', 'CreateFolder', 'CreateMdFile']0: "ReplaceContentMdFile"1: "CreateFolder"2: "CreateFolder"3: "CreateFolder"4: "CreateMdFile"length: 5[[Prototype]]: Array(0)
[Dispatcher] dispatch: after collapseActions: 4
[Dispatcher] dispatch: after collapseActions types: (4) ['CreateMdFile', 'CreateFolder', 'CreateFolder', 'CreateFolder']0: "CreateMdFile"1: "CreateFolder"2: "CreateFolder"3: "CreateFolder"length: 4[[Prototype]]: Array(0)
[Dispatcher] dispatch: after collapseActions details: (4) [{…}, {…}, {…}, {…}]0: {path: 'Library/Songs/Beatles/Yesterday-Beatles-Songs.md', type: 'CreateMdFile'}1: {path: 'Library', type: 'CreateFolder'}2: {path: 'Library/Songs', type: 'CreateFolder'}3: {path: 'Library/Songs/Beatles', type: 'CreateFolder'}length: 4[[Prototype]]: Array(0)
[Dispatcher] dispatch: after sortActionsByWeight: 4
[Dispatcher] dispatch: executing 4 actions
[Dispatcher] dispatch: executing action: CreateFolder Library
[Dispatcher] dispatch: action succeeded: CreateFolder Library
[Dispatcher] dispatch: executing action: CreateFolder Library/Songs
[Dispatcher] dispatch: action succeeded: CreateFolder Library/Songs
[Dispatcher] dispatch: executing action: CreateFolder Library/Songs/Beatles
[Dispatcher] dispatch: action succeeded: CreateFolder Library/Songs/Beatles
[Dispatcher] dispatch: executing action: CreateMdFile Library/Songs/Beatles/Yesterday-Beatles-Songs.md
[Dispatcher] dispatch: action succeeded: CreateMdFile Library/Songs/Beatles/Yesterday-Beatles-Songs.md
[Librarian] writeStatusToMetadata: success
[Librarian] setStatus: baseChain: (2) ['Songs', 'Beatles']
[Librarian] setStatus: impactedSections: (3) [Array(0), Array(1), Array(2)]0: []1: ['Songs']2: (2) ['Songs', 'Beatles']length: 3[[Prototype]]: Array(0)
[Librarian] regenerateCodexes: impacted chains: (3) [Array(0), Array(1), Array(2)]0: []1: ['Songs']2: (2) ['Songs', 'Beatles']length: 3[[Prototype]]: Array(0)
[getCodexContext] chain: [] node: Section
[buildCodexVaultActions] creating action for: {chain: Array(0), codexBasename: '__Library', codexPath: 'Library/__Library.md', contentLength: 250}chain: []codexBasename: "__Library"codexPath: "Library/__Library.md"contentLength: 250[[Prototype]]: Object
[getCodexContext] chain: ['Songs'] node: Section
[buildCodexVaultActions] creating action for: {chain: Array(1), codexBasename: '__Songs', codexPath: 'Library/Songs/__Songs.md', contentLength: 222}chain: ['Songs']codexBasename: "__Songs"codexPath: "Library/Songs/__Songs.md"contentLength: 222[[Prototype]]: Object
[getCodexContext] chain: (2) ['Songs', 'Beatles'] node: Section
[buildCodexVaultActions] creating action for: {chain: Array(2), codexBasename: '__Beatles-Songs', codexPath: 'Library/Songs/Beatles/__Beatles-Songs.md', contentLength: 67}chain: (2) ['Songs', 'Beatles']codexBasename: "__Beatles-Songs"codexPath: "Library/Songs/Beatles/__Beatles-Songs.md"contentLength: 67[[Prototype]]: Object
[Librarian] regenerateCodexes: codexActions: 3
[Librarian] regenerateCodexes: codexActions details: (3) [{…}, {…}, {…}]0: {type: 'ReplaceContentMdFile', path: 'Library/__Library.md'}1: {type: 'ReplaceContentMdFile', path: 'Library/Songs/__Songs.md'}2: {type: 'ReplaceContentMdFile', path: 'Library/Songs/Beatles/__Beatles-Songs.md'}length: 3[[Prototype]]: Array(0)
[Dispatcher] dispatch: input actions: 3
[Dispatcher] dispatch: input action types: (3) ['ReplaceContentMdFile', 'ReplaceContentMdFile', 'ReplaceContentMdFile']0: "ReplaceContentMdFile"1: "ReplaceContentMdFile"2: "ReplaceContentMdFile"length: 3[[Prototype]]: Array(0)
[Dispatcher] dispatch: after ensureAllDestinationsExist: 9
[Dispatcher] dispatch: after ensureAllDestinationsExist types: (9) ['ReplaceContentMdFile', 'ReplaceContentMdFile', 'ReplaceContentMdFile', 'CreateFolder', 'CreateFolder', 'CreateFolder', 'CreateMdFile', 'CreateMdFile', 'CreateMdFile']0: "ReplaceContentMdFile"1: "ReplaceContentMdFile"2: "ReplaceContentMdFile"3: "CreateFolder"4: "CreateFolder"5: "CreateFolder"6: "CreateMdFile"7: "CreateMdFile"8: "CreateMdFile"length: 9[[Prototype]]: Array(0)
[Dispatcher] dispatch: after collapseActions: 6
[Dispatcher] dispatch: after collapseActions types: (6) ['CreateMdFile', 'CreateMdFile', 'CreateMdFile', 'CreateFolder', 'CreateFolder', 'CreateFolder']0: "CreateMdFile"1: "CreateMdFile"2: "CreateMdFile"3: "CreateFolder"4: "CreateFolder"5: "CreateFolder"length: 6[[Prototype]]: Array(0)
[Dispatcher] dispatch: after collapseActions details: (6) [{…}, {…}, {…}, {…}, {…}, {…}]0: {path: 'Library/__Library.md', type: 'CreateMdFile'}1: {path: 'Library/Songs/__Songs.md', type: 'CreateMdFile'}2: {path: 'Library/Songs/Beatles/__Beatles-Songs.md', type: 'CreateMdFile'}3: {path: 'Library', type: 'CreateFolder'}4: {path: 'Library/Songs', type: 'CreateFolder'}5: {path: 'Library/Songs/Beatles', type: 'CreateFolder'}length: 6[[Prototype]]: Array(0)
[Dispatcher] dispatch: after sortActionsByWeight: 6
[Dispatcher] dispatch: executing 6 actions
[Dispatcher] dispatch: executing action: CreateFolder Library
[Dispatcher] dispatch: action succeeded: CreateFolder Library
[Dispatcher] dispatch: executing action: CreateFolder Library/Songs
[Dispatcher] dispatch: action succeeded: CreateFolder Library/Songs
[Dispatcher] dispatch: executing action: CreateFolder Library/Songs/Beatles
[Dispatcher] dispatch: action succeeded: CreateFolder Library/Songs/Beatles
[Dispatcher] dispatch: executing action: CreateMdFile Library/__Library.md
[Dispatcher] dispatch: action succeeded: CreateMdFile Library/__Library.md
[Dispatcher] dispatch: executing action: CreateMdFile Library/Songs/__Songs.md
[Dispatcher] dispatch: action succeeded: CreateMdFile Library/Songs/__Songs.md
[Dispatcher] dispatch: executing action: CreateMdFile Library/Songs/Beatles/__Beatles-Songs.md
[Dispatcher] dispatch: action succeeded: CreateMdFile Library/Songs/Beatles/__Beatles-Songs.md
[Librarian] regenerateCodexes: dispatch result: Ok {value: undefined}