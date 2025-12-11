import type { TFile } from "obsidian";
import type {
	ObsidianVaultActionManager,
	VaultEvent,
} from "../../obsidian-vault-action-manager";
import { splitPathKey } from "../../obsidian-vault-action-manager";
import {
	getActionTargetPath,
	type VaultAction,
	VaultActionType,
} from "../../obsidian-vault-action-manager/types/vault-action";
import { fullPathFromSystemPath } from "../../services/obsidian-services/atomic-services/pathfinder";
import type { TextStatus } from "../../types/common-interface/enums";
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

	logTreeStatuses(): void {
		if (!this.tree) {
			console.log("[logTreeStatuses] tree is null");
			return;
		}

		const lines: string[] = [];

		type TreeLogNode = {
			name: string;
			status: TextStatus;
			children?: TreeLogNode[];
		};

		const walk = (node: TreeLogNode, depth: number) => {
			const indent = "  ".repeat(depth);
			lines.push(`${indent}- ${node.name} [${node.status}]`);
			if (!Array.isArray(node.children)) return;
			for (const child of node.children) {
				walk(child, depth + 1);
			}
		};

		walk(this.tree.root as unknown as TreeLogNode, 0);
		console.log("[logTreeStatuses]\n" + lines.join("\n"));
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

			const adjustedActions: VaultAction[] = [];

			const ensureFolderActions: VaultAction[] = [];
			const folderKeys = new Set<string>();
			const addFolderIfMissing = async (folderPath: {
				basename: string;
				pathParts: string[];
			}) => {
				const key = [...folderPath.pathParts, folderPath.basename].join(
					"/",
				);
				if (folderKeys.has(key)) return;
				folderKeys.add(key);

				const exists = await this.manager.exists({
					...folderPath,
					type: "Folder",
				});
				if (!exists) {
					ensureFolderActions.push({
						payload: {
							coreSplitPath: {
								basename: folderPath.basename,
								pathParts: folderPath.pathParts,
							},
						},
						type: VaultActionType.CreateFolder,
					});
				}
			};

			// Root folder
			await addFolderIfMissing({ basename: rootName, pathParts: [] });

			// Section folders
			for (const sectionPath of sectionPaths) {
				const basename =
					sectionPath[sectionPath.length - 1] ?? rootName;
				const pathParts =
					sectionPath.length > 1
						? [rootName, ...sectionPath.slice(0, -1)]
						: [rootName];
				await addFolderIfMissing({ basename, pathParts });
			}

			for (const action of actions) {
				if (action.type === VaultActionType.WriteMdFile) {
					const exists = await this.manager.exists(
						action.payload.coreSplitPath,
					);
					if (exists) {
						adjustedActions.push(action);
					} else {
						adjustedActions.push({
							payload: {
								content: action.payload.content,
								coreSplitPath: action.payload.coreSplitPath,
							},
							type: VaultActionType.CreateMdFile,
						});
					}
				} else {
					adjustedActions.push(action);
				}
			}

			const allActions = [...ensureFolderActions, ...adjustedActions];

			if (allActions.length > 0) {
				console.log("[regenerateAllCodexes] actions", {
					count: allActions.length,
					samples: allActions.slice(0, 5).map(getActionTargetPath),
				});
				await this.manager.dispatch(allActions);
			} else {
				console.log("[regenerateAllCodexes] no actions generated");
			}
		}
	}
}
