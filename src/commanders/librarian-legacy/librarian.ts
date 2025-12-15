import type { TAbstractFile, TFile } from "obsidian";
import { fullPathFromSystemPathLegacy } from "../../services/obsidian-services/atomic-services/pathfinder";
import type { VaultActionQueueLegacy } from "../../services/obsidian-services/file-services/vault-action-queue";
import type { TexfresserObsidianServices } from "../../services/obsidian-services/interface";
import type { PrettyPathLegacy } from "../../types/common-interface/dtos";
import { ActionDispatcherLegacy } from "./action-dispatcher";
import {
	isRootNameLegacy,
	LIBRARY_ROOTSLegacy,
	type RootNameLegacy,
} from "./constants";
import type { NoteSnapshotLegacy } from "./diffing/note-differ";
import { regenerateCodexActionsLegacy } from "./diffing/tree-diff-applier";
import { LibrarianLegacyStateLegacy } from "./librarian-state";
import type { LibraryTreeLegacy } from "./library-tree/library-tree";
import { FilesystemHealerLegacy } from "./orchestration/filesystem-healer";
import { NoteOperationsLegacy } from "./orchestration/note-operations";
import { TreeReconcilerLegacy } from "./orchestration/tree-reconciler";
import { VaultEventHandlerLegacy } from "./orchestration/vault-event-handler";
import type { NoteDtoLegacy, TreePathLegacyLegacy } from "./types";
import { SelfEventTrackerLegacy } from "./utils/self-event-tracker";

export class LibrarianLegacy {
	backgroundFileService: TexfresserObsidianServices["backgroundFileService"];
	openedFileService: TexfresserObsidianServices["openedFileService"];
	tree: LibraryTreeLegacy | null;

	private dispatcher: ActionDispatcherLegacy;
	private state: LibrarianLegacyStateLegacy;
	private selfEventTracker = new SelfEventTrackerLegacy();
	private filesystemHealer: FilesystemHealerLegacy;
	private treeReconciler: TreeReconcilerLegacy;
	private noteOperations: NoteOperationsLegacy;
	private eventHandler: VaultEventHandlerLegacy;

	constructor({
		backgroundFileService,
		openedFileService,
		actionQueue,
	}: { actionQueue: VaultActionQueueLegacy } & Pick<
		TexfresserObsidianServices,
		"backgroundFileService" | "openedFileService"
	>) {
		this.backgroundFileService = backgroundFileService;
		this.openedFileService = openedFileService;
		this.state = new LibrarianLegacyStateLegacy();
		this.dispatcher = new ActionDispatcherLegacy(
			actionQueue,
			this.selfEventTracker,
		);
		this.filesystemHealer = new FilesystemHealerLegacy({
			backgroundFileService,
			dispatcher: this.dispatcher,
		});
		this.treeReconciler = new TreeReconcilerLegacy({
			backgroundFileService,
			dispatcher: this.dispatcher,
			filesystemHealer: this.filesystemHealer,
			state: this.state,
		});
		this.noteOperations = new NoteOperationsLegacy({
			backgroundFileService,
			dispatcher: this.dispatcher,
			generateUniquePrettyPathLegacy: (p) =>
				this.generateUniquePrettyPathLegacy(p),
			openedFileService,
			regenerateAllCodexes: () => this.regenerateAllCodexes(),
			state: this.state,
			treeReconciler: this.treeReconciler,
		});
		this.eventHandler = new VaultEventHandlerLegacy({
			backgroundFileService,
			dispatcher: this.dispatcher,
			filesystemHealer: this.filesystemHealer,
			generateUniquePrettyPathLegacy: (p) =>
				this.generateUniquePrettyPathLegacy(p),
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

	// ─── Business Operations ──────────────────────────────────────────

	async createNewNoteInCurrentFolder(): Promise<void> {
		await this.noteOperations.createNewNoteInCurrentFolder();
	}

	async makeNoteAText(): Promise<boolean> {
		return this.noteOperations.makeNoteAText();
	}

	isInLibraryFolder(file: TFile): boolean {
		const fullPath = fullPathFromSystemPathLegacy(file.path);
		const rootName = fullPath.pathParts[0];
		return !!rootName && isRootNameLegacy(rootName);
	}

	async setStatus(
		rootName: RootNameLegacy,
		path: TreePathLegacyLegacy,
		status: "Done" | "NotStarted",
	): Promise<void> {
		await this.noteOperations.setStatus(rootName, path, status);
	}

	async addNotes(
		rootName: RootNameLegacy,
		notes: NoteDtoLegacy[],
	): Promise<void> {
		await this.noteOperations.addNotes(rootName, notes);
	}

	async deleteNotes(
		rootName: RootNameLegacy,
		paths: TreePathLegacyLegacy[],
	): Promise<void> {
		await this.noteOperations.deleteNotes(rootName, paths);
	}

	getSnapshot(rootName: RootNameLegacy): NoteSnapshotLegacy | null {
		return this.treeReconciler.getSnapshot(rootName);
	}

	async regenerateAllCodexes(): Promise<void> {
		const rootName = LIBRARY_ROOTSLegacy[0];
		const tree = this.tree;
		if (rootName && tree) {
			const getNode = (path: TreePathLegacyLegacy) => {
				const mbNode = tree.getMaybeLegacyNode({ path });
				return mbNode.error ? undefined : mbNode.data;
			};

			const sectionPaths = tree.getAllSectionPaths();
			const actions = regenerateCodexActionsLegacy(
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

	private async generateUniquePrettyPathLegacy(
		prettyPath: PrettyPathLegacy,
	): Promise<PrettyPathLegacy> {
		let candidate = prettyPath;
		let counter = 1;

		while (await this.backgroundFileService.exists(candidate)) {
			candidate = {
				...prettyPath,
				basename: `${prettyPath.basename}_${counter}`,
			};
			counter += 1;
		}

		return candidate;
	}
}
