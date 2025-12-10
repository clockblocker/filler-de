Status
- ActionDispatcher, LibrarianState, FilesystemHealer, TreeReconciler extracted.
- NoteOperations finished (helpers moved); business flows flush dispatcher.
- VaultEventHandler extracted with rename debounce; Librarian delegates events.
- Librarian now thin (~180 lines).

Remaining
- Docs: confirm outline synced; add any open risks if discovered.

Notes
- withDiff requires affectedPaths; skip flag lives in LibrarianState.
- Command API stays on Librarian as thin wrappers (compat). 

Plan: collapse trees map to single tree
- State: replace `trees: Record<RootName, LibraryTree>` with `tree: LibraryTree | null`.
- TreeReconciler: build one tree, store on state; keep rootName validation only for path/canonicalizer.
- Librarian: expose `tree`, update init/regenerate paths to use single tree.
- NoteOperations/VaultEventHandler: read/write single tree; guard on null.
- Docs/tests/mocks: update `LibraryTree` references and any `trees[...]` expectations.
