import type { ObsidianVaultActionManager } from "../../../obsidian-vault-action-manager";
import type {
	CoreSplitPath,
	SplitPathToMdFile,
} from "../../../obsidian-vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionType,
} from "../../../obsidian-vault-action-manager/types/vault-action";
import { editOrAddMetaInfo } from "../../../services/dto-services/meta-info-manager/interface";
import { splitPathToMdFile } from "../../../services/obsidian-services/atomic-services/pathfinder";
import { logWarning } from "../../../services/obsidian-services/helpers/issue-handlers";
import { TextStatus } from "../../../types/common-interface/enums";
import { isRootName, LIBRARY_ROOT, type RootName } from "../constants";
import { regenerateCodexActions } from "../diffing/tree-diff-applier";
import {
	pageNumberFromInt,
	toNodeName,
	treePathToCodexBasename,
	treePathToPageBasename,
	treePathToScrollBasename,
} from "../indexing/codecs";
import type { LibraryTree } from "../library-tree/library-tree";
import { splitTextIntoPages } from "../text-splitter/text-splitter";
import type { NoteDto, SectionNode, TreePath } from "../types";
import { createFolderActionsForPathParts } from "../utils/folder-actions";
import type { TreeReconciler } from "./tree-reconciler";

export class NoteOperations {
	constructor(
		private readonly deps: {
			getTree: () => LibraryTree | null;
			manager: ObsidianVaultActionManager;
			treeReconciler: TreeReconciler;
			regenerateAllCodexes: () => Promise<void>;
		},
	) {}

	get tree(): LibraryTree | null {
		return this.deps.getTree();
	}

	async createNewNoteInCurrentFolder(): Promise<void> {
		const pwd = await this.deps.manager.pwd();

		if (!this.deps.getTree()) {
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

		await this.deps.manager.openFile({
			basename: treePathToScrollBasename.encode(notePath),
			extension: "md",
			pathParts: [rootName, ...sectionPath],
			type: "MdFile",
		});
	}

	async makeNoteAText(): Promise<boolean> {
		const fullPath = await this.deps.manager.pwd();
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

		if (!this.deps.getTree()) {
			logWarning({
				description: "Tree not initialized for this root.",
				location: "Librarian.makeNoteAText",
			});
			return false;
		}

		const originalPrettyPath: SplitPathToMdFile = {
			basename: fullPath.basename,
			extension: "md",
			pathParts: fullPath.pathParts,
			type: "MdFile",
		};
		const content = await this.deps.manager.readContent(originalPrettyPath);

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
				await this.deps.manager.exists(
					splitPathToMdFile(unmarkedPrettyPath),
				)
			) {
				unmarkedPrettyPath =
					await this.generateUniqueSplitPath(unmarkedPrettyPath);
			}

			const renameAction: VaultAction = {
				payload: {
					from: originalPrettyPath,
					to: unmarkedPrettyPath,
				},
				type: VaultActionType.RenameMdFile,
			};
			await this.deps.manager.dispatch([renameAction]);

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

			await this.deps.manager.dispatch(createActions);

			this.deps
				.getTree()
				?.addNotes([
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
				await this.deps.manager.exists(
					splitPathToMdFile(unmarkedPrettyPath),
				)
			) {
				unmarkedPrettyPath =
					await this.generateUniqueSplitPath(unmarkedPrettyPath);
			}

			phase1Actions.push({
				payload: {
					from: originalPrettyPath,
					to: unmarkedPrettyPath,
				},
				type: VaultActionType.RenameMdFile,
			});

			await this.deps.manager.dispatch(phase1Actions);

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

			await this.deps.manager.dispatch(phase2Actions);

			const bookSectionPath: TreePath = [...sectionPath, textName];
			destinationPrettyPath = {
				basename: treePathToCodexBasename.encode(bookSectionPath),
				pathParts: bookFolderPathParts,
			};

			await this.deps.treeReconciler.reconcileSubtree(
				rootName,
				bookSectionPath,
			);

			const tree = this.deps.getTree();
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
				await this.deps.manager.dispatch(codexActions);
			}
		}

		await this.deps.manager.openFile(
			splitPathToMdFile(destinationPrettyPath),
		);

		return true;
	}

	private async generateUniqueSplitPath(
		path: CoreSplitPath,
	): Promise<CoreSplitPath> {
		let candidate = path;
		let counter = 1;

		while (await this.deps.manager.exists(splitPathToMdFile(candidate))) {
			candidate = {
				...path,
				basename: `${path.basename}_${counter}`,
			};
			counter += 1;
		}

		return candidate;
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

		// Codex files must reflect the updated status immediately.
		await this.deps.regenerateAllCodexes();
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
			? (this.deps.getTree() ?? undefined)
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
