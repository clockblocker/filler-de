import type { TFile } from "obsidian";
import type {
	ObsidianVaultActionManager,
	VaultEvent,
} from "../../obsidian-vault-action-manager";
import { splitPathKey } from "../../obsidian-vault-action-manager";
import { fullPathFromSystemPath } from "../../services/obsidian-services/atomic-services/pathfinder";
import { isRootName, LIBRARY_ROOT, type RootName } from "./constants";
import type { NoteSnapshot } from "./diffing/note-differ";
import { regenerateCodexActions } from "./diffing/tree-diff-applier";
import type { LibraryTree } from "./library-tree/library-tree";
import { FilesystemHealer } from "./orchestration/filesystem-healer";
import { NoteOperations } from "./orchestration/note-operations";
import { TreeReconciler } from "./orchestration/tree-reconciler";
import { VaultEventHandler } from "./orchestration/vault-event-handler";
import type { NoteDto, TreePath } from "./types";

export class Librarian {
	manager: ObsidianVaultActionManager;
	tree: LibraryTree | null = null;
	private filesystemHealer: FilesystemHealer;
	private treeReconciler: TreeReconciler;
	private noteOperations: NoteOperations;
	private eventHandler: VaultEventHandler;

	constructor({
		manager,
	}: {
		manager: ObsidianVaultActionManager;
	}) {
		this.manager = manager;
		this.filesystemHealer = new FilesystemHealer({
			manager: this.manager,
		});
		this.treeReconciler = new TreeReconciler({
			filesystemHealer: this.filesystemHealer,
			getTree: () => this.tree,
			manager: this.manager,
			setTree: (tree) => {
				this.tree = tree;
			},
		});
		this.noteOperations = new NoteOperations({
			getTree: () => this.tree,
			manager: this.manager,
			regenerateAllCodexes: this.regenerateAllCodexes,
			treeReconciler: this.treeReconciler,
		});
		this.eventHandler = new VaultEventHandler({
			manager: this.manager,
			regenerateAllCodexes: this.regenerateAllCodexes,
			treeReconciler: this.treeReconciler,
		});
	}

	async initTrees(): Promise<void> {
		await this.treeReconciler.initTrees();
		await this.regenerateAllCodexes();
	}

	// Manager-driven events (self-filtered inside manager)
	async onManagedVaultEvent(event: VaultEvent): Promise<void> {
		switch (event.type) {
			case "FileCreated":
				await this.eventHandler.onFileCreatedFromSplitPath(
					event.splitPath,
				);
				return;
			case "FileRenamed":
				await this.eventHandler.onFileRenamedFromSplitPath(
					event.to,
					splitPathKey(event.from),
				);
				return;
			case "FileTrashed":
				await this.eventHandler.onFileDeletedFromSplitPath(
					event.splitPath,
				);
				return;
		}
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
				await this.manager.dispatch(actions);
			}
		}
	}
}
