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
