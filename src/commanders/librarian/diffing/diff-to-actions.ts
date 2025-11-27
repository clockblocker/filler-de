import {
	type VaultAction,
	VaultActionType,
} from "../../../services/obsidian-services/file-services/background/background-vault-actions";
import type { PrettyPath } from "../../../types/common-interface/dtos";
import { codexFormatter, codexGenerator } from "../codex";
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

		// Handle status changes → update affected Codex files
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
			const path = codexPathKey.split("/") as TreePath;
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
			actions.push({
				payload: {
					content: "",
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

			// Create Pages subfolder
			actions.push({
				payload: {
					prettyPath: this.pagesFolderToPrettyPath(text.path),
				},
				type: VaultActionType.UpdateOrCreateFolder,
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
					type: VaultActionType.UpdateOrCreateFile,
				});
			}

			// Create Codex file for the book
			const content = this.generateCodexContent(text.path, getNode);
			actions.push({
				payload: {
					content,
					prettyPath: this.bookCodexToPrettyPath(text.path),
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
					prettyPath: this.bookCodexToPrettyPath(text.path),
				},
				type: VaultActionType.TrashFile,
			});

			// Trash Pages folder
			actions.push({
				payload: {
					prettyPath: this.pagesFolderToPrettyPath(text.path),
				},
				type: VaultActionType.TrashFolder,
			});

			// Trash book folder
			actions.push({
				payload: {
					prettyPath: this.bookFolderToPrettyPath(text.path),
				},
				type: VaultActionType.TrashFolder,
			});
		}

		return actions;
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

	/**
	 * Determine the correct Codex path for any node path.
	 * - Root (empty path): Codex is Library/__Library.md
	 * - Sections: Codex is in the section folder itself
	 * - Books (texts with pages): Codex is inside the book folder
	 */
	private pathToCodexPrettyPath(
		path: TreePath,
		getNode?: GetNodeFn,
	): PrettyPath {
		// Root codex
		if (path.length === 0) {
			return this.rootCodexToPrettyPath();
		}

		if (getNode) {
			const node = getNode(path);
			if (node) {
				// Use node.type to distinguish Section from Text
				if (node.type === NodeType.Text && node.children.length > 1) {
					// It's a book (multi-page text) - codex lives inside the book folder
					return this.bookCodexToPrettyPath(path);
				}
				// Section or scroll (single-page text) - use section-style path
			}
		}
		return this.sectionCodexToPrettyPath(path);
	}

	private sectionPathToPrettyPath(sectionPath: TreePath): PrettyPath {
		const pathParts = [this.rootName, ...sectionPath.slice(0, -1)];
		const basename = sectionPath[sectionPath.length - 1] ?? "";
		return { basename, pathParts };
	}

	private sectionCodexToPrettyPath(sectionPath: TreePath): PrettyPath {
		// Codex goes inside the section folder
		const pathParts = [this.rootName, ...sectionPath];
		const basename = `__${sectionPath.toReversed().join("-")}`;
		return { basename, pathParts };
	}

	private rootCodexToPrettyPath(): PrettyPath {
		// Root codex: Library/__Library.md
		return { basename: `__${this.rootName}`, pathParts: [this.rootName] };
	}

	private bookCodexToPrettyPath(textPath: TreePath): PrettyPath {
		// Book codex lives inside the book folder
		// e.g., Library/Fairy_Tales/Aschenputtel/__Aschenputtel-Fairy_Tales.md
		const pathParts = [this.rootName, ...textPath];
		const basename = `__${textPath.toReversed().join("-")}`;
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

	private pagesFolderToPrettyPath(textPath: TreePath): PrettyPath {
		const pathParts = [this.rootName, ...textPath];
		return { basename: "Pages", pathParts };
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
