import type { TAbstractFile, TFile } from "obsidian";
import type {
	ObsidianVaultActionManager,
	VaultEvent,
} from "../../obsidian-vault-action-manager";
import { splitPathKey } from "../../obsidian-vault-action-manager";
import type { CoreSplitPath } from "../../obsidian-vault-action-manager/types/split-path";
import { fullPathFromSystemPath } from "../../services/obsidian-services/atomic-services/pathfinder";
import type { LegacyOpenedFileService } from "../../services/obsidian-services/file-services/active-view/legacy-opened-file-service";
import { ActionDispatcher } from "./action-dispatcher";
import { isRootName, LIBRARY_ROOT, type RootName } from "./constants";
import type { NoteSnapshot } from "./diffing/note-differ";
import { regenerateCodexActions } from "./diffing/tree-diff-applier";
import { LibrarianState } from "./librarian-state";
import type { LibraryTree } from "./library-tree/library-tree";
import { FilesystemHealer } from "./orchestration/filesystem-healer";
import { NoteOperations } from "./orchestration/note-operations";
import { TreeReconciler } from "./orchestration/tree-reconciler";
import { VaultEventHandler } from "./orchestration/vault-event-handler";
import type { NoteDto, TreePath } from "./types";
import {
	type ManagerFsAdapter,
	makeManagerFsAdapter,
} from "./utils/manager-fs-adapter.ts";
import { SelfEventTracker } from "./utils/self-event-tracker";

export class Librarian {
	backgroundFileService: ManagerFsAdapter;
	openedFileService: LegacyOpenedFileService;
	manager: ObsidianVaultActionManager;
	tree: LibraryTree | null;

	private dispatcher: ActionDispatcher;
	private state: LibrarianState;
	private selfEventTracker = new SelfEventTracker();
	private filesystemHealer: FilesystemHealer;
	private treeReconciler: TreeReconciler;
	private noteOperations: NoteOperations;
	private eventHandler: VaultEventHandler;

	constructor({
		manager,
		openedFileService,
	}: {
		manager: ObsidianVaultActionManager;
		openedFileService: LegacyOpenedFileService;
	}) {
		this.manager = manager;
		this.backgroundFileService = makeManagerFsAdapter(manager);
		this.openedFileService = openedFileService;
		this.state = new LibrarianState();
		this.dispatcher = new ActionDispatcher(manager, this.selfEventTracker);
		this.filesystemHealer = new FilesystemHealer({
			backgroundFileService: this.backgroundFileService,
			dispatcher: this.dispatcher,
		});
		this.treeReconciler = new TreeReconciler({
			backgroundFileService: this.backgroundFileService,
			dispatcher: this.dispatcher,
			filesystemHealer: this.filesystemHealer,
			state: this.state,
		});
		this.noteOperations = new NoteOperations({
			backgroundFileService: this.backgroundFileService,
			dispatcher: this.dispatcher,
			generateUniqueSplitPath: (p) => this.generateUniqueSplitPath(p),
			openedFileService: this.openedFileService,
			regenerateAllCodexes: () => this.regenerateAllCodexes(),
			state: this.state,
			treeReconciler: this.treeReconciler,
		});
		this.eventHandler = new VaultEventHandler({
			backgroundFileService: this.backgroundFileService,
			dispatcher: this.dispatcher,
			filesystemHealer: this.filesystemHealer,
			generateUniqueSplitPath: (p) => this.generateUniqueSplitPath(p),
			regenerateAllCodexes: () => this.regenerateAllCodexes(),
			selfEventTracker: this.selfEventTracker,
			state: this.state,
			treeReconciler: this.treeReconciler,
		});
		this.tree = this.state.tree;
	}

	_setSkipReconciliation(skip: boolean): void {
		this.state.skipReconciliation = skip;
	}

	async initTrees(): Promise<void> {
		await this.treeReconciler.initTrees();
		this.tree = this.state.tree;
		await this.regenerateAllCodexes();
	}

	// ─── Vault Event Handlers ─────────────────────────────────────────

	async onFileCreated(file: TAbstractFile): Promise<void> {
		await this.eventHandler.onFileCreated(file);
	}

	async onFileRenamed(file: TAbstractFile, oldPath: string): Promise<void> {
		await this.eventHandler.onFileRenamed(file, oldPath);
	}

	async onFileDeleted(file: TAbstractFile): Promise<void> {
		await this.eventHandler.onFileDeleted(file);
	}

	// Manager-driven events (self-filtered inside manager)
	async onVaultEventFileCreated(event: VaultEvent): Promise<void> {
		if (event.type !== "FileCreated") return;
		const prettyPath: CoreSplitPath = {
			basename: event.splitPath.basename,
			pathParts: event.splitPath.pathParts,
		};
		await this.eventHandler.onFileCreatedFromSplitPath(prettyPath);
	}

	async onVaultEventFileRenamed(event: VaultEvent): Promise<void> {
		if (event.type !== "FileRenamed") return;
		const toPretty: CoreSplitPath = {
			basename: event.to.basename,
			pathParts: event.to.pathParts,
		};
		await this.eventHandler.onFileRenamedFromSplitPath(
			toPretty,
			splitPathKey(event.from),
		);
	}

	async onVaultEventFileTrashed(event: VaultEvent): Promise<void> {
		if (event.type !== "FileTrashed") return;
		const prettyPath: CoreSplitPath = {
			basename: event.splitPath.basename,
			pathParts: event.splitPath.pathParts,
		};
		await this.eventHandler.onFileDeletedFromSplitPath(prettyPath);
	}

	// ─── Business Operations ──────────────────────────────────────────

	async createNewNoteInCurrentFolder(): Promise<void> {
		await this.noteOperations.createNewNoteInCurrentFolder();
	}

	async makeNoteAText(): Promise<boolean> {
		return this.noteOperations.makeNoteAText();
	}

	isInLibraryFolder(file: TFile): boolean {
		const fullPath = fullPathFromSystemPath(file.path);
		const rootName = fullPath.pathParts[0];
		return !!rootName && isRootName(rootName);
	}

	async setStatus(
		rootName: RootName,
		path: TreePath,
		status: "Done" | "NotStarted",
	): Promise<void> {
		await this.noteOperations.setStatus(rootName, path, status);
	}

	async addNotes(rootName: RootName, notes: NoteDto[]): Promise<void> {
		await this.noteOperations.addNotes(rootName, notes);
	}

	async deleteNotes(rootName: RootName, paths: TreePath[]): Promise<void> {
		await this.noteOperations.deleteNotes(rootName, paths);
	}

	getSnapshot(rootName: RootName): NoteSnapshot | null {
		return this.treeReconciler.getSnapshot(rootName);
	}

	async regenerateAllCodexes(): Promise<void> {
		const rootName = LIBRARY_ROOT;
		const tree = this.tree;
		if (rootName && tree) {
			const getNode = (path: TreePath) => {
				const mbNode = tree.getMaybeNode({ path });
				return mbNode.error ? undefined : mbNode.data;
			};

			const sectionPaths = tree.getAllSectionPaths();
			const actions = regenerateCodexActions(
				sectionPaths,
				rootName,
				getNode,
			);

			if (actions.length > 0) {
				this.dispatcher.pushMany(actions);
			}
		}

		await this.dispatcher.flushNow();
	}

	// ─── Private Helpers ──────────────────────────────────────────────

	private async generateUniqueSplitPath(
		path: CoreSplitPath,
	): Promise<CoreSplitPath> {
		let candidate = path;
		let counter = 1;

		while (await this.backgroundFileService.exists(candidate)) {
			candidate = {
				...path,
				basename: `${path.basename}_${counter}`,
			};
			counter += 1;
		}

		return candidate;
	}
}
