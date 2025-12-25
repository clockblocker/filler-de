import { logWarning } from "../../../obsidian-vault-action-manager/helpers/issue-handlers";
import { editOrAddMetaInfo } from "../../../services/dto-services/meta-info-manager/interface";
import { fullPathFromSystemPathLegacy } from "../../../services/obsidian-services/atomic-services/pathfinder";
import {
	type LegacyVaultAction,
	LegacyVaultActionType,
} from "../../../services/obsidian-services/file-services/background/background-vault-actions";
import type { TexfresserObsidianServices } from "../../../services/obsidian-services/interface";
import type { PrettyPathLegacy } from "../../../types/common-interface/dtos";
import { TextStatusLegacy } from "../../../types/common-interface/enums";
import { splitTextIntoPages } from "../../text-splitter/text-splitter";
import type { ActionDispatcherLegacy } from "../action-dispatcher";
import {
	isRootNameLegacy,
	LIBRARY_ROOTSLegacy,
	type RootNameLegacy,
} from "../constants";
import { regenerateCodexActionsLegacy } from "../diffing/tree-diff-applier";
import {
	pageNumberFromInt,
	toNodeNameLegacy,
	treePathToCodexBasename,
	treePathToPageBasenameLegacy,
	treePathToScrollBasename,
} from "../indexing/codecs";
import type { LibrarianLegacyStateLegacy } from "../librarian-state";
import type { LibraryTreeLegacy } from "../library-tree/library-tree";
import type {
	NoteDtoLegacy,
	SectionNodeLegacy,
	TreePathLegacyLegacy,
} from "../types";
import { createFolderActionsForPathParts } from "../utils/folder-actions";
import type { TreeReconcilerLegacy } from "./tree-reconciler";

export class NoteOperationsLegacy {
	constructor(
		private readonly deps: {
			state: LibrarianLegacyStateLegacy;
			dispatcher: ActionDispatcherLegacy;
			treeReconciler: TreeReconcilerLegacy;
			regenerateAllCodexes: () => Promise<void>;
			generateUniquePrettyPathLegacy: (
				prettyPath: PrettyPathLegacy,
			) => Promise<PrettyPathLegacy>;
		} & Pick<
			TexfresserObsidianServices,
			"openedFileService" | "backgroundFileService"
		>,
	) {}

	get tree(): LibraryTreeLegacy | null {
		return this.deps.state.tree;
	}

	async createNewNoteInCurrentFolder(): Promise<void> {
		const pwd = await this.deps.openedFileService.pwd();

		if (!this.deps.state.tree) {
			await this.deps.treeReconciler.initTrees();
		}

		const treePathToPwd: TreePathLegacyLegacy = pwd.pathParts.slice(1);
		const rootCandidate = pwd.pathParts[0];
		const rootName =
			rootCandidate && isRootNameLegacy(rootCandidate)
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
		const notePath: TreePathLegacyLegacy = [...sectionPath, newNoteName];

		await this.deps.treeReconciler.withDiff(
			rootName,
			(tree) =>
				tree.addNotes([
					{ path: notePath, status: TextStatusLegacy.NotStarted },
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
				location: "LibrarianLegacy.makeNoteAText",
			});
			return false;
		}

		const fullPath = fullPathFromSystemPathLegacy(currentFile.path);
		const rootCandidate = fullPath.pathParts[0];
		const rootName =
			rootCandidate && isRootNameLegacy(rootCandidate)
				? rootCandidate
				: undefined;

		if (!rootName) {
			logWarning({
				description: `File must be in a Library folder. Found: ${rootName}`,
				location: "LibrarianLegacy.makeNoteAText",
			});
			return false;
		}

		if (!this.deps.state.tree) {
			logWarning({
				description: "Tree not initialized for this root.",
				location: "LibrarianLegacy.makeNoteAText",
			});
			return false;
		}

		const originalPrettyPathLegacy: PrettyPathLegacy = {
			basename: fullPath.basename,
			pathParts: fullPath.pathParts,
		};
		const content = await this.deps.backgroundFileService.readContent(
			originalPrettyPathLegacy,
		);

		if (!content.trim()) {
			logWarning({
				description: "File is empty.",
				location: "LibrarianLegacy.makeNoteAText",
			});
			return false;
		}

		const rawTextName = toNodeNameLegacy(fullPath.basename);
		const sectionPath: TreePathLegacyLegacy = fullPath.pathParts.slice(1);
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
		let destinationPrettyPathLegacy: PrettyPathLegacy;

		if (!isBook) {
			const unmarkedBasename = `Unmarked_${fullPath.basename}`;
			let unmarkedPrettyPathLegacy: PrettyPathLegacy = {
				basename: unmarkedBasename,
				pathParts: originalPrettyPathLegacy.pathParts,
			};
			if (
				await this.deps.backgroundFileService.exists(
					unmarkedPrettyPathLegacy,
				)
			) {
				unmarkedPrettyPathLegacy =
					await this.deps.generateUniquePrettyPathLegacy(
						unmarkedPrettyPathLegacy,
					);
			}

			const renameAction: LegacyVaultAction = {
				payload: {
					from: originalPrettyPathLegacy,
					to: unmarkedPrettyPathLegacy,
				},
				type: LegacyVaultActionType.RenameFile,
			};
			this.deps.dispatcher.registerSelf([renameAction]);
			this.deps.dispatcher.push(renameAction);
			await this.deps.dispatcher.flushNow();

			const scrollTreePathLegacyLegacy: TreePathLegacyLegacy = [
				...sectionPath,
				textName,
			];
			const scrollPrettyPathLegacy: PrettyPathLegacy = {
				basename: treePathToScrollBasename.encode(
					scrollTreePathLegacyLegacy,
				),
				pathParts: [rootName, ...sectionPath],
			};

			const createActions: LegacyVaultAction[] = [
				...createFolderActionsForPathParts(
					scrollPrettyPathLegacy.pathParts,
					seenFolders,
				),
				{
					payload: {
						content: editOrAddMetaInfo(pages[0] ?? "", {
							fileType: "Scroll",
							status: TextStatusLegacy.NotStarted,
						}),
						prettyPath: scrollPrettyPathLegacy,
					},
					type: LegacyVaultActionType.UpdateOrCreateFile,
				},
			];

			this.deps.dispatcher.registerSelf(createActions);
			this.deps.dispatcher.pushMany(createActions);
			await this.deps.dispatcher.flushNow();

			this.deps.state.tree?.addNotes([
				{
					path: scrollTreePathLegacyLegacy,
					status: TextStatusLegacy.NotStarted,
				},
			]);

			await this.deps.regenerateAllCodexes();

			destinationPrettyPathLegacy = scrollPrettyPathLegacy;
		} else {
			const bookFolderPathParts = [rootName, ...sectionPath, textName];

			const phase1Actions: LegacyVaultAction[] = [
				...createFolderActionsForPathParts(
					bookFolderPathParts,
					seenFolders,
				),
			];

			const unmarkedBasename = `Unmarked-${fullPath.basename}`;
			let unmarkedPrettyPathLegacy: PrettyPathLegacy = {
				basename: unmarkedBasename,
				pathParts: bookFolderPathParts,
			};
			if (
				await this.deps.backgroundFileService.exists(
					unmarkedPrettyPathLegacy,
				)
			) {
				unmarkedPrettyPathLegacy =
					await this.deps.generateUniquePrettyPathLegacy(
						unmarkedPrettyPathLegacy,
					);
			}

			phase1Actions.push({
				payload: {
					from: originalPrettyPathLegacy,
					to: unmarkedPrettyPathLegacy,
				},
				type: LegacyVaultActionType.RenameFile,
			});

			this.deps.dispatcher.registerSelf(phase1Actions);
			this.deps.dispatcher.pushMany(phase1Actions);
			await this.deps.dispatcher.flushNow();

			const phase2Actions: LegacyVaultAction[] = [];

			for (let i = 0; i < pages.length; i++) {
				const pageTreePathLegacyLegacy: TreePathLegacyLegacy = [
					...sectionPath,
					textName,
					pageNumberFromInt.encode(i),
				];
				const pagePrettyPathLegacy: PrettyPathLegacy = {
					basename: treePathToPageBasenameLegacy.encode(
						pageTreePathLegacyLegacy,
					),
					pathParts: bookFolderPathParts,
				};

				phase2Actions.push({
					payload: {
						content: editOrAddMetaInfo(pages[i] ?? "", {
							fileType: "Page",
							index: i,
							status: TextStatusLegacy.NotStarted,
						}),
						prettyPath: pagePrettyPathLegacy,
					},
					type: LegacyVaultActionType.UpdateOrCreateFile,
				});
			}

			this.deps.dispatcher.registerSelf(phase2Actions);
			this.deps.dispatcher.pushMany(phase2Actions);
			await this.deps.dispatcher.flushNow();

			const bookSectionPath: TreePathLegacyLegacy = [
				...sectionPath,
				textName,
			];
			destinationPrettyPathLegacy = {
				basename: treePathToCodexBasename.encode(bookSectionPath),
				pathParts: bookFolderPathParts,
			};

			await this.deps.treeReconciler.reconcileSubtree(
				rootName,
				bookSectionPath,
			);

			const tree = this.deps.state.tree;
			if (tree) {
				const getNode = (path: TreePathLegacyLegacy) => {
					const mbNode = tree.getMaybeLegacyNode({ path });
					return mbNode.error ? undefined : mbNode.data;
				};
				const codexActions = regenerateCodexActionsLegacy(
					[bookSectionPath],
					rootName,
					getNode,
				);
				this.deps.dispatcher.registerSelf(codexActions);
				this.deps.dispatcher.pushMany(codexActions);
				await this.deps.dispatcher.flushNow();
			}
		}

		await this.deps.openedFileService.cd(destinationPrettyPathLegacy);

		return true;
	}

	async setStatus(
		rootName: RootNameLegacy,
		path: TreePathLegacyLegacy,
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

	async addNotes(
		rootName: RootNameLegacy,
		notes: NoteDtoLegacy[],
	): Promise<void> {
		const parentPaths: TreePathLegacyLegacy[] = [
			...new Set(notes.map((n) => n.path.slice(0, -1).join("/"))),
		]
			.map((p) => (p ? p.split("/") : []))
			.filter((p): p is TreePathLegacyLegacy => p.length > 0);

		await this.deps.treeReconciler.withDiff(
			rootName,
			(tree) => tree.addNotes(notes),
			parentPaths,
		);

		await this.deps.dispatcher.flushNow();
	}

	async deleteNotes(
		rootName: RootNameLegacy,
		paths: TreePathLegacyLegacy[],
	): Promise<void> {
		const parentPaths: TreePathLegacyLegacy[] = [
			...new Set(paths.map((p) => p.slice(0, -1).join("/"))),
		]
			.map((p) => (p ? p.split("/") : []))
			.filter((p): p is TreePathLegacyLegacy => p.length > 0);

		await this.deps.treeReconciler.withDiff(
			rootName,
			(tree) => tree.deleteNotes(paths),
			parentPaths,
		);

		await this.deps.dispatcher.flushNow();
	}

	private getPathFromSection(
		section: SectionNodeLegacy,
		tree: LibraryTreeLegacy,
	): TreePathLegacyLegacy {
		const path: string[] = [];
		let current: SectionNodeLegacy | null = section;
		while (current && tree.root !== current) {
			path.unshift(current.name);
			current = current.parent;
		}
		return path;
	}

	private getAffectedTree(fullPath: {
		pathParts: string[];
	}): LibraryTreeLegacy | undefined {
		const rootCandidate = fullPath.pathParts[0];
		const rootName =
			rootCandidate && isRootNameLegacy(rootCandidate)
				? rootCandidate
				: undefined;
		if (!rootName) return undefined;
		return rootName === LIBRARY_ROOTSLegacy[0]
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
