import type { CoreSplitPath } from "../../../obsidian-vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionType,
} from "../../../obsidian-vault-action-manager/types/vault-action";
import { editOrAddMetaInfo } from "../../../services/dto-services/meta-info-manager/interface";
import { fullPathFromSystemPath } from "../../../services/obsidian-services/atomic-services/pathfinder";
import type { LegacyOpenedFileService } from "../../../services/obsidian-services/file-services/active-view/legacy-opened-file-service";
import { logWarning } from "../../../services/obsidian-services/helpers/issue-handlers";
import { TextStatus } from "../../../types/common-interface/enums";
import type { ActionDispatcher } from "../action-dispatcher";
import { isRootName, LIBRARY_ROOT, type RootName } from "../constants";
import { regenerateCodexActions } from "../diffing/tree-diff-applier";
import {
	pageNumberFromInt,
	toNodeName,
	treePathToCodexBasename,
	treePathToPageBasename,
	treePathToScrollBasename,
} from "../indexing/codecs";
import type { LibrarianState } from "../librarian-state";
import type { LibraryTree } from "../library-tree/library-tree";
import { splitTextIntoPages } from "../text-splitter/text-splitter";
import type { NoteDto, SectionNode, TreePath } from "../types";
import { createFolderActionsForPathParts } from "../utils/folder-actions";
import type { ManagerFsAdapter } from "../utils/manager-fs-adapter.ts";
import type { TreeReconciler } from "./tree-reconciler";

export class NoteOperations {
	constructor(
		private readonly deps: {
			state: LibrarianState;
			dispatcher: ActionDispatcher;
			treeReconciler: TreeReconciler;
			regenerateAllCodexes: () => Promise<void>;
			generateUniqueSplitPath: (
				path: CoreSplitPath,
			) => Promise<CoreSplitPath>;
			openedFileService: LegacyOpenedFileService;
			backgroundFileService: ManagerFsAdapter;
		},
	) {}

	get tree(): LibraryTree | null {
		return this.deps.state.tree;
	}

	async createNewNoteInCurrentFolder(): Promise<void> {
		const pwd = await this.deps.openedFileService.pwd();

		if (!this.deps.state.tree) {
			await this.deps.treeReconciler.initTrees();
		}

		const treePathToPwd: TreePath = pwd.pathParts.slice(1);
		const rootCandidate = pwd.pathParts[0];
		const rootName =
			rootCandidate && isRootName(rootCandidate)
				? rootCandidate
				: undefined;
		const affectedTree = this.getAffectedTree(pwd);

		if (!affectedTree || !rootName) return;

		const nearestSection = affectedTree.getNearestSection(treePathToPwd);
		const newNoteName = this.generateUniqueNoteName(nearestSection);
		const sectionPath = this.getPathFromSection(
			nearestSection,
			affectedTree,
		);
		const notePath: TreePath = [...sectionPath, newNoteName];

		await this.deps.treeReconciler.withDiff(
			rootName,
			(tree) =>
				tree.addNotes([
					{ path: notePath, status: TextStatus.NotStarted },
				]),
			[sectionPath],
		);

		await this.deps.dispatcher.flushNow();

		await this.deps.openedFileService.cd({
			basename: treePathToScrollBasename.encode(notePath),
			pathParts: [rootName, ...sectionPath],
		});
	}

	async makeNoteAText(): Promise<boolean> {
		const app = this.deps.openedFileService.getApp();
		const currentFile = app.workspace.getActiveFile();

		if (!currentFile) {
			logWarning({
				description: "No file is currently open.",
				location: "Librarian.makeNoteAText",
			});
			return false;
		}

		const fullPath = fullPathFromSystemPath(currentFile.path);
		const rootCandidate = fullPath.pathParts[0];
		const rootName =
			rootCandidate && isRootName(rootCandidate)
				? rootCandidate
				: undefined;

		if (!rootName) {
			logWarning({
				description: `File must be in a Library folder. Found: ${rootName}`,
				location: "Librarian.makeNoteAText",
			});
			return false;
		}

		if (!this.deps.state.tree) {
			logWarning({
				description: "Tree not initialized for this root.",
				location: "Librarian.makeNoteAText",
			});
			return false;
		}

		const originalPrettyPath: CoreSplitPath = {
			basename: fullPath.basename,
			pathParts: fullPath.pathParts,
		};
		const content =
			await this.deps.backgroundFileService.readContent(
				originalPrettyPath,
			);

		if (!content.trim()) {
			logWarning({
				description: "File is empty.",
				location: "Librarian.makeNoteAText",
			});
			return false;
		}

		const rawTextName = toNodeName(fullPath.basename);
		const sectionPath: TreePath = fullPath.pathParts.slice(1);
		const lastFolder = sectionPath[sectionPath.length - 1];
		const textName =
			lastFolder && rawTextName.endsWith(`-${lastFolder}`)
				? rawTextName.slice(
						0,
						rawTextName.length - lastFolder.length - 1,
					)
				: rawTextName;

		const { pages, isBook } = splitTextIntoPages(content, textName);

		const seenFolders = new Set<string>();
		let destinationPrettyPath: CoreSplitPath;

		if (!isBook) {
			const unmarkedBasename = `Unmarked_${fullPath.basename}`;
			let unmarkedPrettyPath: CoreSplitPath = {
				basename: unmarkedBasename,
				pathParts: originalPrettyPath.pathParts,
			};
			if (
				await this.deps.backgroundFileService.exists(unmarkedPrettyPath)
			) {
				unmarkedPrettyPath =
					await this.deps.generateUniqueSplitPath(unmarkedPrettyPath);
			}

			const renameAction: VaultAction = {
				payload: {
					from: originalPrettyPath,
					to: unmarkedPrettyPath,
				},
				type: VaultActionType.RenameMdFile,
			};
			this.deps.dispatcher.registerSelf([renameAction]);
			this.deps.dispatcher.push(renameAction);
			await this.deps.dispatcher.flushNow();

			const scrollTreePath: TreePath = [...sectionPath, textName];
			const scrollPrettyPath: CoreSplitPath = {
				basename: treePathToScrollBasename.encode(scrollTreePath),
				pathParts: [rootName, ...sectionPath],
			};

			const createActions: VaultAction[] = [
				...createFolderActionsForPathParts(
					scrollPrettyPath.pathParts,
					seenFolders,
				),
				{
					payload: {
						content: editOrAddMetaInfo(pages[0] ?? "", {
							fileType: "Scroll",
							status: TextStatus.NotStarted,
						}),
						coreSplitPath: scrollPrettyPath,
					},
					type: VaultActionType.CreateMdFile,
				},
			];

			this.deps.dispatcher.registerSelf(createActions);
			this.deps.dispatcher.pushMany(createActions);
			await this.deps.dispatcher.flushNow();

			this.deps.state.tree?.addNotes([
				{ path: scrollTreePath, status: TextStatus.NotStarted },
			]);

			await this.deps.regenerateAllCodexes();

			destinationPrettyPath = scrollPrettyPath;
		} else {
			const bookFolderPathParts = [rootName, ...sectionPath, textName];

			const phase1Actions: VaultAction[] = [
				...createFolderActionsForPathParts(
					bookFolderPathParts,
					seenFolders,
				),
			];

			const unmarkedBasename = `Unmarked-${fullPath.basename}`;
			let unmarkedPrettyPath: CoreSplitPath = {
				basename: unmarkedBasename,
				pathParts: bookFolderPathParts,
			};
			if (
				await this.deps.backgroundFileService.exists(unmarkedPrettyPath)
			) {
				unmarkedPrettyPath =
					await this.deps.generateUniqueSplitPath(unmarkedPrettyPath);
			}

			phase1Actions.push({
				payload: {
					from: originalPrettyPath,
					to: unmarkedPrettyPath,
				},
				type: VaultActionType.RenameMdFile,
			});

			this.deps.dispatcher.registerSelf(phase1Actions);
			this.deps.dispatcher.pushMany(phase1Actions);
			await this.deps.dispatcher.flushNow();

			const phase2Actions: VaultAction[] = [];

			for (let i = 0; i < pages.length; i++) {
				const pageTreePath: TreePath = [
					...sectionPath,
					textName,
					pageNumberFromInt.encode(i),
				];
				const pagePrettyPath: CoreSplitPath = {
					basename: treePathToPageBasename.encode(pageTreePath),
					pathParts: bookFolderPathParts,
				};

				phase2Actions.push({
					payload: {
						content: editOrAddMetaInfo(pages[i] ?? "", {
							fileType: "Page",
							index: i,
							status: TextStatus.NotStarted,
						}),
						coreSplitPath: pagePrettyPath,
					},
					type: VaultActionType.CreateMdFile,
				});
			}

			this.deps.dispatcher.registerSelf(phase2Actions);
			this.deps.dispatcher.pushMany(phase2Actions);
			await this.deps.dispatcher.flushNow();

			const bookSectionPath: TreePath = [...sectionPath, textName];
			destinationPrettyPath = {
				basename: treePathToCodexBasename.encode(bookSectionPath),
				pathParts: bookFolderPathParts,
			};

			await this.deps.treeReconciler.reconcileSubtree(
				rootName,
				bookSectionPath,
			);

			const tree = this.deps.state.tree;
			if (tree) {
				const getNode = (path: TreePath) => {
					const mbNode = tree.getMaybeNode({ path });
					return mbNode.error ? undefined : mbNode.data;
				};
				const codexActions = regenerateCodexActions(
					[bookSectionPath],
					rootName,
					getNode,
				);
				this.deps.dispatcher.registerSelf(codexActions);
				this.deps.dispatcher.pushMany(codexActions);
				await this.deps.dispatcher.flushNow();
			}
		}

		await this.deps.openedFileService.cd(destinationPrettyPath);

		return true;
	}

	async setStatus(
		rootName: RootName,
		path: TreePath,
		status: "Done" | "NotStarted",
	): Promise<void> {
		const parentPath = path.slice(0, -1);

		await this.deps.treeReconciler.withDiff(
			rootName,
			(tree) => tree.setStatus({ path, status }),
			parentPath.length > 0 ? [parentPath] : [],
		);

		await this.deps.dispatcher.flushNow();
	}

	async addNotes(rootName: RootName, notes: NoteDto[]): Promise<void> {
		const parentPaths: TreePath[] = [
			...new Set(notes.map((n) => n.path.slice(0, -1).join("/"))),
		]
			.map((p) => (p ? p.split("/") : []))
			.filter((p): p is TreePath => p.length > 0);

		await this.deps.treeReconciler.withDiff(
			rootName,
			(tree) => tree.addNotes(notes),
			parentPaths,
		);

		await this.deps.dispatcher.flushNow();
	}

	async deleteNotes(rootName: RootName, paths: TreePath[]): Promise<void> {
		const parentPaths: TreePath[] = [
			...new Set(paths.map((p) => p.slice(0, -1).join("/"))),
		]
			.map((p) => (p ? p.split("/") : []))
			.filter((p): p is TreePath => p.length > 0);

		await this.deps.treeReconciler.withDiff(
			rootName,
			(tree) => tree.deleteNotes(paths),
			parentPaths,
		);

		await this.deps.dispatcher.flushNow();
	}

	private getPathFromSection(
		section: SectionNode,
		tree: LibraryTree,
	): TreePath {
		const path: string[] = [];
		let current: SectionNode | null = section;
		while (current && tree.root !== current) {
			path.unshift(current.name);
			current = current.parent;
		}
		return path;
	}

	private getAffectedTree(fullPath: {
		pathParts: string[];
	}): LibraryTree | undefined {
		const rootCandidate = fullPath.pathParts[0];
		const rootName =
			rootCandidate && isRootName(rootCandidate)
				? rootCandidate
				: undefined;
		if (!rootName) return undefined;
		return rootName === LIBRARY_ROOT
			? (this.deps.state.tree ?? undefined)
			: undefined;
	}

	private generateUniqueNoteName(section: {
		children: Array<{ name: string }>;
	}): string {
		const baseName = "New_Note";
		const existingNames = new Set(
			section.children
				.filter((child) => child.name.startsWith(baseName))
				.map((child) => child.name),
		);

		if (!existingNames.has(baseName)) return baseName;

		let counter = 1;
		while (existingNames.has(`${baseName}_${counter}`)) {
			counter += 1;
		}

		return `${baseName}_${counter}`;
	}
}
