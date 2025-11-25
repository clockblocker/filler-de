import {
	type BackgroundVaultAction,
	BackgroundVaultActionType,
} from "../../../services/obsidian-services/file-services/background/background-vault-actions";
import type { PrettyPath } from "../../../types/common-interface/dtos";
import { codexFormatter, codexGenerator } from "../codex";
import type { SectionNode, TextDto, TextNode, TreePath } from "../types";
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
	mapDiffToActions(
		diff: TreeDiff,
		getNode?: GetNodeFn,
	): BackgroundVaultAction[] {
		const actions: BackgroundVaultAction[] = [];

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

		// Handle status changes → update affected Codex files
		const affectedCodexPaths = this.getAffectedCodexPaths(
			diff.statusChanges,
		);
		for (const codexPathKey of affectedCodexPaths) {
			const path = codexPathKey.split("/") as TreePath;
			// Skip scrolls (single-page texts) - they don't have Codexes
			if (getNode) {
				const node = getNode(path);
				if (node && !codexGenerator.getCodexType(node)) {
					continue;
				}
			}
			actions.push(this.updateCodexAction(path, getNode));
		}

		return actions;
	}

	/**
	 * Get all Codex paths affected by status changes.
	 * Includes all ancestors up to (but not including) root.
	 */
	getAffectedCodexPaths(statusChanges: StatusChange[]): Set<string> {
		const paths = new Set<string>();

		for (const change of statusChanges) {
			// Walk up the path, adding each ancestor
			// A status change at ['A', 'B', 'C', '000'] affects:
			// - ['A', 'B', 'C'] (the text/book)
			// - ['A', 'B'] (parent section)
			// - ['A'] (grandparent section)
			let current = change.path.slice(0, -1); // Remove page name
			while (current.length > 0) {
				paths.add(current.join("/"));
				current = current.slice(0, -1);
			}
		}

		return paths;
	}

	// ─── Section Actions ─────────────────────────────────────────────

	private createFolderAction(sectionPath: TreePath): BackgroundVaultAction {
		return {
			payload: {
				prettyPath: this.sectionPathToPrettyPath(sectionPath),
			},
			type: BackgroundVaultActionType.CreateFolder,
		};
	}

	private trashFolderAction(sectionPath: TreePath): BackgroundVaultAction {
		return {
			payload: {
				prettyPath: this.sectionPathToPrettyPath(sectionPath),
			},
			type: BackgroundVaultActionType.TrashFolder,
		};
	}

	private createSectionCodexAction(
		sectionPath: TreePath,
		getNode?: GetNodeFn,
	): BackgroundVaultAction {
		const content = this.generateCodexContent(sectionPath, getNode);
		return {
			payload: {
				content,
				prettyPath: this.sectionCodexToPrettyPath(sectionPath),
			},
			type: BackgroundVaultActionType.CreateFile,
		};
	}

	private trashSectionCodexAction(
		sectionPath: TreePath,
	): BackgroundVaultAction {
		return {
			payload: {
				prettyPath: this.sectionCodexToPrettyPath(sectionPath),
			},
			type: BackgroundVaultActionType.TrashFile,
		};
	}

	// ─── Text Actions ────────────────────────────────────────────────

	private createTextActions(
		text: TextDto,
		getNode?: GetNodeFn,
	): BackgroundVaultAction[] {
		const actions: BackgroundVaultAction[] = [];
		const pageNames = Object.keys(text.pageStatuses);

		if (pageNames.length === 1) {
			// Scroll (single page = single file, no Codex)
			actions.push({
				payload: {
					content: "",
					prettyPath: this.scrollPathToPrettyPath(text.path),
				},
				type: BackgroundVaultActionType.CreateFile,
			});
		} else {
			// Book (multiple pages)
			// Create folder for the book
			actions.push({
				payload: {
					prettyPath: this.bookFolderToPrettyPath(text.path),
				},
				type: BackgroundVaultActionType.CreateFolder,
			});

			// Create page files
			for (const pageName of pageNames) {
				actions.push({
					payload: {
						content: "",
						prettyPath: this.pagePathToPrettyPath(
							text.path,
							pageName,
						),
					},
					type: BackgroundVaultActionType.CreateFile,
				});
			}

			// Create Codex file for the book
			const content = this.generateCodexContent(text.path, getNode);
			actions.push({
				payload: {
					content,
					prettyPath: this.bookCodexToPrettyPath(text.path),
				},
				type: BackgroundVaultActionType.CreateFile,
			});
		}

		return actions;
	}

	private trashTextActions(text: TextDto): BackgroundVaultAction[] {
		const actions: BackgroundVaultAction[] = [];
		const pageNames = Object.keys(text.pageStatuses);

		if (pageNames.length === 1) {
			// Scroll
			actions.push({
				payload: {
					prettyPath: this.scrollPathToPrettyPath(text.path),
				},
				type: BackgroundVaultActionType.TrashFile,
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
					type: BackgroundVaultActionType.TrashFile,
				});
			}

			// Trash Codex file
			actions.push({
				payload: {
					prettyPath: this.bookCodexToPrettyPath(text.path),
				},
				type: BackgroundVaultActionType.TrashFile,
			});

			// Trash book folder
			actions.push({
				payload: {
					prettyPath: this.bookFolderToPrettyPath(text.path),
				},
				type: BackgroundVaultActionType.TrashFolder,
			});
		}

		return actions;
	}

	// ─── Codex Update Action ─────────────────────────────────────────

	private updateCodexAction(
		path: TreePath,
		getNode?: GetNodeFn,
	): BackgroundVaultAction {
		const prettyPath = this.pathToCodexPrettyPath(path);

		return {
			payload: {
				content: this.generateCodexContent(path, getNode),
				prettyPath,
			},
			type: BackgroundVaultActionType.WriteFile,
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

		const codexType = codexGenerator.getCodexType(node);
		if (!codexType) {
			return "";
		}

		return codexFormatter.format(codexContent, codexType);
	}

	// ─── Path Conversion Helpers ─────────────────────────────────────

	/**
	 * Determine the correct Codex path for any node path.
	 * Handles both sections and books.
	 */
	private pathToCodexPrettyPath(path: TreePath): PrettyPath {
		// For sections: Codex is in parent folder
		// For books: Codex is inside the book folder
		// We can't know which without the node, so use section convention
		// (book codex paths are computed in createTextActions)
		return this.sectionCodexToPrettyPath(path);
	}

	private sectionPathToPrettyPath(sectionPath: TreePath): PrettyPath {
		const pathParts = [this.rootName, ...sectionPath.slice(0, -1)];
		const basename = sectionPath[sectionPath.length - 1] ?? "";
		return { basename, pathParts };
	}

	private sectionCodexToPrettyPath(sectionPath: TreePath): PrettyPath {
		const pathParts = [this.rootName, ...sectionPath.slice(0, -1)];
		const basename = `__${sectionPath.toReversed().join("-")}`;
		return { basename, pathParts };
	}

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

	private bookCodexToPrettyPath(textPath: TreePath): PrettyPath {
		const pathParts = [this.rootName, ...textPath];
		const basename = `__${textPath.toReversed().join("-")}`;
		return { basename, pathParts };
	}

	private pagePathToPrettyPath(
		textPath: TreePath,
		pageName: string,
	): PrettyPath {
		const pathParts = [this.rootName, ...textPath, "Pages"];
		const basename = `${pageName}-${textPath.toReversed().join("-")}`;
		return { basename, pathParts };
	}
}
