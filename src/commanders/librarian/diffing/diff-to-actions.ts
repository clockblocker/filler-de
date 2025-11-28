import { editOrAddMetaInfo } from "../../../services/dto-services/meta-info-manager/interface";
import type { MetaInfo } from "../../../services/dto-services/meta-info-manager/types";
import {
	type VaultAction,
	VaultActionType,
} from "../../../services/obsidian-services/file-services/background/background-vault-actions";
import type { PrettyPath } from "../../../types/common-interface/dtos";
import { codexFormatter, codexGenerator } from "../codex";
import { pageNameFromTreePath } from "../indexing/formatters";
import {
	NodeType,
	type SectionNode,
	type TextDto,
	type TextNode,
	type TreePath,
} from "../types";
import type { StatusChange, TreeDiff } from "./types";

/**
 * Callback to get a node from the tree by path.
 * Used for Codex content generation.
 */
export type GetNodeFn = (
	path: TreePath,
) => (SectionNode | TextNode) | undefined;

/**
 * Maps tree diffs to vault actions.
 *
 * Chain logic (folder order, cleanup) is handled here.
 * Codex content is generated via CodexGenerator/CodexFormatter.
 */
export class DiffToActionsMapper {
	private rootName: string;

	constructor(rootName: string) {
		this.rootName = rootName;
	}

	/**
	 * Convert a tree diff into vault actions.
	 *
	 * @param diff The tree diff to process
	 * @param getNode Optional callback to get nodes for Codex generation.
	 *                If not provided, Codex files are created with empty content.
	 */
	mapDiffToActions(diff: TreeDiff, getNode?: GetNodeFn): VaultAction[] {
		const actions: VaultAction[] = [];

		// Handle added sections (create folders + Codex)
		for (const sectionPath of diff.addedSections) {
			actions.push(this.createFolderAction(sectionPath));
			actions.push(this.createSectionCodexAction(sectionPath, getNode));
		}

		// Handle added texts (create files)
		for (const text of diff.addedTexts) {
			actions.push(...this.createTextActions(text, getNode));
		}

		// Handle removed texts (trash files)
		for (const text of diff.removedTexts) {
			actions.push(...this.trashTextActions(text));
		}

		// Handle removed sections (trash folders + Codex) - deepest first
		const sortedRemovedSections = [...diff.removedSections].sort(
			(a, b) => b.length - a.length,
		);
		for (const sectionPath of sortedRemovedSections) {
			actions.push(this.trashSectionCodexAction(sectionPath));
			actions.push(this.trashFolderAction(sectionPath));
		}

		// Handle status changes → update page/scroll files AND affected Codex files
		for (const change of diff.statusChanges) {
			const action = this.createPageStatusUpdateAction(change, getNode);
			if (action) {
				actions.push(action);
			}
		}

		const affectedCodexPaths = this.getAffectedCodexPaths(
			diff.statusChanges,
		);

		// Also update parent section codexes when texts are added/removed
		// Including root codex
		for (const text of diff.addedTexts) {
			// Add parent section paths including root
			affectedCodexPaths.add(""); // root
			for (let i = 1; i <= text.path.length - 1; i++) {
				affectedCodexPaths.add(text.path.slice(0, i).join("/"));
			}
		}
		for (const text of diff.removedTexts) {
			affectedCodexPaths.add(""); // root
			for (let i = 1; i <= text.path.length - 1; i++) {
				affectedCodexPaths.add(text.path.slice(0, i).join("/"));
			}
		}

		for (const codexPathKey of affectedCodexPaths) {
			// Handle root path: "" splits to [""], but we need []
			const path = (
				codexPathKey === "" ? [] : codexPathKey.split("/")
			) as TreePath;
			// Skip scrolls (single-page texts) - they don't have Codexes
			if (getNode) {
				const node = getNode(path);
				if (node && !codexGenerator.hasCodex(node)) {
					continue;
				}
			}
			actions.push(this.updateCodexAction(path, getNode));
		}

		return actions;
	}

	/**
	 * Get all Codex paths affected by status changes.
	 * Includes all ancestors INCLUDING root (empty path = "").
	 */
	getAffectedCodexPaths(statusChanges: StatusChange[]): Set<string> {
		const paths = new Set<string>();

		for (const change of statusChanges) {
			// Walk up the path, adding each ancestor including root
			// A status change at ['A', 'B', 'C', '000'] affects:
			// - ['A', 'B', 'C'] (the text/book)
			// - ['A', 'B'] (parent section)
			// - ['A'] (grandparent section)
			// - [] (root) - represented as ""
			let current = change.path.slice(0, -1); // Remove page name
			while (current.length > 0) {
				paths.add(current.join("/"));
				current = current.slice(0, -1);
			}
			// Add root
			paths.add("");
		}

		return paths;
	}

	// ─── Section Actions ─────────────────────────────────────────────

	private createFolderAction(sectionPath: TreePath): VaultAction {
		return {
			payload: {
				prettyPath: this.sectionPathToPrettyPath(sectionPath),
			},
			type: VaultActionType.UpdateOrCreateFolder,
		};
	}

	private trashFolderAction(sectionPath: TreePath): VaultAction {
		return {
			payload: {
				prettyPath: this.sectionPathToPrettyPath(sectionPath),
			},
			type: VaultActionType.TrashFolder,
		};
	}

	private createSectionCodexAction(
		sectionPath: TreePath,
		getNode?: GetNodeFn,
	): VaultAction {
		const content = this.generateCodexContent(sectionPath, getNode);
		return {
			payload: {
				content,
				prettyPath: this.sectionCodexToPrettyPath(sectionPath),
			},
			type: VaultActionType.UpdateOrCreateFile,
		};
	}

	private trashSectionCodexAction(sectionPath: TreePath): VaultAction {
		return {
			payload: {
				prettyPath: this.sectionCodexToPrettyPath(sectionPath),
			},
			type: VaultActionType.TrashFile,
		};
	}

	// ─── Text Actions ────────────────────────────────────────────────

	private createTextActions(
		text: TextDto,
		getNode?: GetNodeFn,
	): VaultAction[] {
		const actions: VaultAction[] = [];
		const pageNames = Object.keys(text.pageStatuses);

		if (pageNames.length === 1) {
			// Scroll (single page = single file, no Codex)
			const pageName = pageNames[0];
			const status = pageName ? text.pageStatuses[pageName] : undefined;
			const scrollMeta: MetaInfo = {
				fileType: "Scroll",
				status: status ?? "NotStarted",
			};
			actions.push({
				payload: {
					content: editOrAddMetaInfo("", scrollMeta),
					prettyPath: this.scrollPathToPrettyPath(text.path),
				},
				type: VaultActionType.UpdateOrCreateFile,
			});
		} else {
			// Book (multiple pages)
			// Create folder for the book
			actions.push({
				payload: {
					prettyPath: this.bookFolderToPrettyPath(text.path),
				},
				type: VaultActionType.UpdateOrCreateFolder,
			});

			// Create page files with meta section (pages stored directly in book folder, no Page subfolder)
			for (const pageName of pageNames) {
				const status = text.pageStatuses[pageName];
				const pageMeta: MetaInfo = {
					fileType: "Page",
					index: Number(pageName),
					status: status ?? "NotStarted",
				};
				actions.push({
					payload: {
						content: editOrAddMetaInfo("", pageMeta),
						prettyPath: this.pagePathToPrettyPath(
							text.path,
							pageName,
						),
					},
					type: VaultActionType.UpdateOrCreateFile,
				});
			}

			// Create Codex file for the book
			const content = this.generateCodexContent(text.path, getNode);
			actions.push({
				payload: {
					content,
					prettyPath: this.sectionCodexToPrettyPath(text.path),
				},
				type: VaultActionType.UpdateOrCreateFile,
			});
		}

		return actions;
	}

	private trashTextActions(text: TextDto): VaultAction[] {
		const actions: VaultAction[] = [];
		const pageNames = Object.keys(text.pageStatuses);

		if (pageNames.length === 1) {
			// Scroll
			actions.push({
				payload: {
					prettyPath: this.scrollPathToPrettyPath(text.path),
				},
				type: VaultActionType.TrashFile,
			});
		} else {
			// Book - trash pages first, then Codex, then folder
			for (const pageName of pageNames) {
				actions.push({
					payload: {
						prettyPath: this.pagePathToPrettyPath(
							text.path,
							pageName,
						),
					},
					type: VaultActionType.TrashFile,
				});
			}

			// Trash Codex file
			actions.push({
				payload: {
					prettyPath: this.sectionCodexToPrettyPath(text.path),
				},
				type: VaultActionType.TrashFile,
			});

			actions.push({
				payload: {
					prettyPath: this.bookFolderToPrettyPath(text.path),
				},
				type: VaultActionType.TrashFolder,
			});
		}

		return actions;
	}

	// ─── Page/Scroll Status Update Action ─────────────────────────────

	/**
	 * Create an action to update a page/scroll file's meta section with new status.
	 * Returns null if the status change doesn't apply to a leaf node file.
	 */
	private createPageStatusUpdateAction(
		change: StatusChange,
		getNode?: GetNodeFn,
	): VaultAction | null {
		// Path format: [...textPath, pageName]
		// e.g., ["Section", "BookName", "000"] or ["Section", "ScrollName", "000"]
		if (change.path.length < 2) {
			return null; // Invalid path
		}

		const textPath = change.path.slice(0, -1);
		const pageName = change.path[change.path.length - 1];

		if (!pageName) {
			return null;
		}

		// Get the text node to determine if it's a book or scroll
		const textNode = getNode?.(textPath);
		const isBook =
			textNode?.type === NodeType.Text && textNode.children.length > 1;

		// Determine file path
		const prettyPath = isBook
			? this.pagePathToPrettyPath(textPath, pageName)
			: this.scrollPathToPrettyPath(textPath);

		// Build meta info based on file type
		const metaInfo: MetaInfo = isBook
			? {
					fileType: "Page",
					index: Number(pageName),
					status: change.newStatus,
				}
			: {
					fileType: "Scroll",
					status: change.newStatus,
				};

		return {
			payload: {
				prettyPath,
				transform: (content: string) =>
					editOrAddMetaInfo(content, metaInfo),
			},
			type: VaultActionType.ProcessFile,
		};
	}

	// ─── Codex Update Action ─────────────────────────────────────────

	private updateCodexAction(
		path: TreePath,
		getNode?: GetNodeFn,
	): VaultAction {
		const prettyPath = this.pathToCodexPrettyPath(path, getNode);

		// Use UpdateOrCreateFile - it creates if not exists, or we'll handle overwrite
		return {
			payload: {
				content: this.generateCodexContent(path, getNode),
				prettyPath,
			},
			type: VaultActionType.UpdateOrCreateFile,
		};
	}

	// ─── Codex Content Generation ────────────────────────────────────

	private generateCodexContent(path: TreePath, getNode?: GetNodeFn): string {
		if (!getNode) {
			return ""; // No tree access, empty content
		}

		const node = getNode(path);
		if (!node) {
			return ""; // Node not found
		}

		const codexContent = codexGenerator.forNode(node);
		if (!codexContent) {
			return ""; // Not a codex-able node (e.g., scroll)
		}

		return codexFormatter.format(codexContent);
	}

	// ─── Path Conversion Helpers ─────────────────────────────────────

	private pathToCodexPrettyPath(
		path: TreePath,
		getNode?: GetNodeFn,
	): PrettyPath {
		// Root codex
		if (path.length === 0) {
			return this.rootCodexToPrettyPath();
		}

		return this.sectionCodexToPrettyPath(path);
	}

	private sectionPathToPrettyPath(sectionPath: TreePath): PrettyPath {
		const pathParts = [this.rootName, ...sectionPath.slice(0, -1)];
		const basename = sectionPath[sectionPath.length - 1] ?? "";
		return { basename, pathParts };
	}

	private sectionCodexToPrettyPath(sectionPath: TreePath): PrettyPath {
		const pathParts = [this.rootName, ...sectionPath];
		const basename = `__${sectionPath.toReversed().join("-")}`;
		return { basename, pathParts };
	}

	private rootCodexToPrettyPath(): PrettyPath {
		// Root codex: Library/__Library.md
		return { basename: `__${this.rootName}`, pathParts: [this.rootName] };
	}

	// private bookCodexToPrettyPath(textPath: TreePath): PrettyPath {
	// 	// Book codex lives inside the book folder
	// 	// e.g., Library/Fairy_Tales/Aschenputtel/__Aschenputtel-Fairy_Tales.md
	// 	const pathParts = [this.rootName, ...textPath];
	// 	const basename = `__${textPath.toReversed().join("-")}`;
	// 	return { basename, pathParts };
	// }

	private scrollPathToPrettyPath(textPath: TreePath): PrettyPath {
		const pathParts = [this.rootName, ...textPath.slice(0, -1)];
		const basename = textPath.toReversed().join("-");
		return { basename, pathParts };
	}

	private bookFolderToPrettyPath(textPath: TreePath): PrettyPath {
		const pathParts = [this.rootName, ...textPath.slice(0, -1)];
		const basename = textPath[textPath.length - 1] ?? "";
		return { basename, pathParts };
	}

	private pagePathToPrettyPath(
		textPath: TreePath,
		pageName: string,
	): PrettyPath {
		const fullPath: TreePath = [...textPath, pageName];

		const pathParts = [this.rootName, ...fullPath.slice(0, -1)];
		const basename = pageNameFromTreePath.encode(fullPath);
		return { basename, pathParts };
	}
}
