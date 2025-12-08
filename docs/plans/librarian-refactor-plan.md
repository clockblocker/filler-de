Status
- ActionDispatcher, LibrarianState, FilesystemHealer, TreeReconciler extracted; Librarian delegates init/reconcile/diff; NoteOperations created and wired; business methods passthrough.
- Librarian shrunk to ~490 lines; healing logic moved out; diff now delegated.

Remaining
- VaultEventHandler: extract onFileCreated/onFileRenamed/onFileDeleted + rename debounce state; wire dispatcher/self-tracker; ensure authority rules unchanged.
- NoteOperations finish: move remaining helpers (generateUniqueNoteName, getPathFromSection) fully out of Librarian; remove leftover unused imports; ensure commands use reconciler/dispatcher only.
- Librarian cleanup: drop unused helpers/imports, keep thin passthroughs; ensure tree references use state.
- Tests: add unit coverage for FilesystemHealer, TreeReconciler, NoteOperations basics; integration for rename debounce path.

Notes
- withDiff requires affectedPaths; skip flag lives in LibrarianState.
- Command API stays on Librarian as thin wrappers (compat). 
