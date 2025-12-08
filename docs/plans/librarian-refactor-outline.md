Problem
The Librarian class is 1084 lines with mixed responsibilities:
Layer 1 (Healing): healRootFilesystem, initializeMetaInfo, cleanupOrphanFolders
Layer 2 (Tree): initTrees, reconcileSubtree, withDiff
Event routing: onFileCreated, onFileRenamed (~170 lines!), onFileDeleted
Business ops: createNewNoteInCurrentFolder, makeNoteAText (~200 lines!)
Debounce state management
Helper methods scattered throughout
Proposed Structure
Extract into focused modules + thin orchestrator:
librarian/
├── orchestration/
│   ├── filesystem-healer.ts      # Layer 1: healRootFilesystem, initializeMetaInfo, cleanupOrphanFolders ✅
│   ├── tree-reconciler.ts        # Layer 2: initTrees, reconcileSubtree, withDiff, withDiffSync ✅
│   ├── vault-event-handler.ts    # Events: onFileCreated/Renamed/Deleted; owns RenameBatcher state ⏳
│   └── note-operations.ts        # Business: createNewNote, makeNoteAText, setStatus, addNotes, deleteNotes, splitTextToPages 🚧 (commands mostly moved)
├── action-dispatcher.ts          # Wrap queue + selfEventTracker; single enqueue/flush surface ✅
├── librarian-state.ts            # Trees map + skip flag (no debounce state) ✅
├── librarian.ts                  # Thin orchestrator ~100 lines
└── ... (existing subdirs)
Module Responsibilities
Module	Lines (est.)	Purpose
FilesystemHealer	~200	Layer 1: filename invariant enforcement
TreeReconciler	~120	Layer 2: tree ↔ filesystem sync (+ initTrees, withDiffSync)
VaultEventHandler	~250	Route Obsidian events; owns RenameBatcher
NoteOperations	~350	Business logic for user actions
ActionDispatcher	~50	Self-event registration + queue push/flush
LibrarianState	~40	Hold trees + skip flag (no timers)
Librarian	~100	Compose modules, expose API
Interface Design
// Shared context passed to modules
type LibrarianContext = {
  state: LibrarianState;
  dispatcher: ActionDispatcher;
  backgroundFileService: BackgroundFileService;
  openedFileService: OpenedFileService;
};
// FilesystemHealer
class FilesystemHealer {
  constructor(private ctx: LibrarianContext) {}
  async healRoot(rootName: RootName): Promise<void>
  // optional: return canonical targets for callers
}
// TreeReconciler
class TreeReconciler {
  constructor(private ctx: LibrarianContext) {}
  async initTrees(): Promise<void>
  async reconcileSubtree(rootName: RootName, path: TreePath): Promise<void>
  withDiff<T>(rootName: RootName, mutation: (tree: LibraryTree) => T, affectedPaths?: TreePath[]): { actions: VaultAction[]; result: T }
  withDiffSync<T>(...): { actions: VaultAction[]; result: T }
}
// VaultEventHandler (owns RenameBatcher)
class VaultEventHandler {
  constructor(private ctx: LibrarianContext, private healer: FilesystemHealer, private reconciler: TreeReconciler) {}
  async onFileCreated(file: TAbstractFile): Promise<void>
  async onFileRenamed(file: TAbstractFile, oldPath: string): Promise<void>
  async onFileDeleted(file: TAbstractFile): Promise<void>
}
// NoteOperations
class NoteOperations {
  constructor(private ctx: LibrarianContext, private reconciler: TreeReconciler) {}
  async createNewNoteInCurrentFolder(): Promise<void>
  async makeNoteAText(): Promise<boolean>
  async setStatus(rootName: RootName, path: TreePath, status: ...): Promise<void>
  async splitTextToPages(...): Promise<void>
}
// ActionDispatcher
class ActionDispatcher {
  constructor(private queue: VaultActionQueue, private tracker: SelfEventTracker) {}
  pushMany(actions: VaultAction[]): void
  push(action: VaultAction): void
  registerSelf(actions: VaultAction[]): void
  flushNow(): Promise<void>
}
// LibrarianState
class LibrarianState {
  trees: Record<RootName, LibraryTree> = {};
  skipReconciliation = false;
}
Simplified Librarian
class Librarian {
  private ctx: LibrarianContext;
  private healer: FilesystemHealer;
  private reconciler: TreeReconciler;
  private eventHandler: VaultEventHandler;
  private noteOps: NoteOperations;
  private dispatcher: ActionDispatcher;
  private state: LibrarianState;
  constructor(deps) {
    this.dispatcher = new ActionDispatcher(deps.actionQueue, new SelfEventTracker());
    this.state = new LibrarianState();
    this.ctx = { state: this.state, dispatcher: this.dispatcher, ...deps };
    this.healer = new FilesystemHealer(this.ctx);
    this.reconciler = new TreeReconciler(this.ctx);
    this.eventHandler = new VaultEventHandler(this.ctx, this.healer, this.reconciler);
    this.noteOps = new NoteOperations(this.ctx, this.reconciler);
  }
  // Delegate all public methods
  initTrees = () => this.reconciler.initTrees();
  onFileCreated = (f) => this.eventHandler.onFileCreated(f);
  onFileRenamed = (f, p) => this.eventHandler.onFileRenamed(f, p);
  onFileDeleted = (f) => this.eventHandler.onFileDeleted(f);
  createNewNote = () => this.noteOps.createNewNoteInCurrentFolder();
  makeNoteAText = () => this.noteOps.makeNoteAText();
  // etc.
}
Benefits
Single Responsibility — each module has one job
Testable — modules can be unit tested in isolation
Matches architecture doc — layers are explicit classes
Readable — no 170-line methods, no 200-line methods
Maintainable — changes localized to relevant module
Migration Path
Extract FilesystemHealer first (most isolated)
Extract TreeReconciler (depends only on trees + queue)
Introduce ActionDispatcher + LibrarianState
Extract VaultEventHandler (depends on 1 + 2)
Extract NoteOperations (depends on 2)
Slim down Librarian to orchestrator

Decisions
- withDiff API: require affectedPaths
- FilesystemHealer canonical targets: expose 
- _skipReconciliation location: in state (visible, testable; broader mutability) 
- Debounce: keep 100ms, handler-owned.
- Command placement: all in NoteOperations (clean split; minor breaking API) 