import { editOrAddMetaInfo } from "../../../services/dto-services/meta-info-manager/interface";
import type { MetaInfo } from "../../../services/dto-services/meta-info-manager/types";
import {
	type VaultAction,
	VaultActionType,
} from "../../../services/obsidian-services/file-services/background/background-vault-actions";
import type { PrettyPath } from "../../../types/common-interface/dtos";
import { codexFormatter } from "../codex";
import { createCodexGeneratorV2 } from "../codex/codex-generator-v2";
import { pageNameFromTreePath } from "../indexing/formatters";
import type { NoteDto, NoteNode, SectionNodeV2, TreePath } from "../types";
import { NodeTypeV2 } from "../types";
import type { NoteDiff, NoteStatusChange } from "./note-differ";

/**
 * Callback to get a V2 node from the tree by path.
 */
export type GetNodeV2Fn = (
	path: TreePath,
) => SectionNodeV2 | NoteNode | undefined;

/**
 * Check if a note path represents a book page (numeric suffix like "000").
 */
function isBookPage(notePath: TreePath): boolean {
	const lastSegment = notePath[notePath.length - 1];
	return !!lastSegment && /^\d{3}$/.test(lastSegment);
}

/**
 * Get the book path from a page path (removes the page index).
 */
function getBookPath(pagePath: TreePath): TreePath {
	return pagePath.slice(0, -1);
}

/**
 * Maps V2 tree diffs to vault actions.
 *
 * Simpler than V1:
 * - Notes are flat (no pageStatuses grouping)
 * - Scroll vs Book determined by path pattern
 */
export class DiffToActionsV2 {
	private rootName: string;

	constructor(rootName: string) {
		this.rootName = rootName;
	}

	/**
	 * Convert a note diff into vault actions.
	 */
	mapDiffToActions(diff: NoteDiff, getNode?: GetNodeV2Fn): VaultAction[] {
		const actions: VaultAction[] = [];

		// Track which book sections need codex updates
		const affectedBookPaths = new Set<string>();

		console.log("[DiffToActionsV2] Processing diff:", {
			addedNotes: diff.addedNotes.length,
			addedSections: diff.addedSections.length,
			removedNotes: diff.removedNotes.length,
			removedSections: diff.removedSections.length,
			statusChanges: diff.statusChanges.length,
		});

		// Handle added sections (create folders + Codex)
		for (const sectionPath of diff.addedSections) {
			actions.push(this.createFolderAction(sectionPath));
			actions.push(this.createCodexAction(sectionPath, getNode));
		}

		// Handle added notes
		for (const note of diff.addedNotes) {
			actions.push(this.createNoteAction(note));

			// Track affected books/sections for codex updates
			if (isBookPage(note.path)) {
				affectedBookPaths.add(getBookPath(note.path).join("/"));
			}
			// All ancestors need codex update
			this.addAncestorPaths(note.path, affectedBookPaths);
		}

		// Handle removed notes
		for (const note of diff.removedNotes) {
			actions.push(this.trashNoteAction(note));

			if (isBookPage(note.path)) {
				affectedBookPaths.add(getBookPath(note.path).join("/"));
			}
			this.addAncestorPaths(note.path, affectedBookPaths);
		}

		// Handle removed sections (trash folders + Codex) - deepest first
		const sortedRemovedSections = [...diff.removedSections].sort(
			(a, b) => b.length - a.length,
		);
		for (const sectionPath of sortedRemovedSections) {
			actions.push(this.trashCodexAction(sectionPath));
			actions.push(this.trashFolderAction(sectionPath));
		}

		// Handle status changes
		for (const change of diff.statusChanges) {
			console.log("[DiffToActionsV2] Processing status change:", change);
			actions.push(this.createStatusUpdateAction(change));

			// Track affected sections for codex updates
			if (isBookPage(change.path)) {
				console.log(
					"[DiffToActionsV2] Is book page, adding book path:",
					getBookPath(change.path),
				);
				affectedBookPaths.add(getBookPath(change.path).join("/"));
			}
			this.addAncestorPaths(change.path, affectedBookPaths);
		}

		console.log("[DiffToActionsV2] Affected codex paths:", [
			...affectedBookPaths,
		]);

		// Update affected codexes
		for (const pathKey of affectedBookPaths) {
			const path = pathKey === "" ? [] : (pathKey.split("/") as TreePath);
			console.log(
				"[DiffToActionsV2] Checking codex path:",
				pathKey,
				"->",
				path,
			);

			// Check if this path has a codex (sections and books do, scrolls don't)
			if (getNode) {
				const node = getNode(path);
				console.log(
					"[DiffToActionsV2] Node at path:",
					path,
					node?.type,
				);
				if (node && node.type === NodeTypeV2.Note) {
					// Notes (scrolls) don't have codexes
					console.log(
						"[DiffToActionsV2] Skipping Note (no codex):",
						path,
					);
					continue;
				}
			}

			console.log("[DiffToActionsV2] Adding codex update for:", path);
			actions.push(this.updateCodexAction(path, getNode));
		}

		return actions;
	}

	// ─── Helper Methods ───────────────────────────────────────────────

	private addAncestorPaths(notePath: TreePath, paths: Set<string>): void {
		paths.add(""); // root
		for (let i = 1; i < notePath.length; i++) {
			paths.add(notePath.slice(0, i).join("/"));
		}
	}

	// ─── Note Actions ─────────────────────────────────────────────────

	private createNoteAction(note: NoteDto): VaultAction {
		const isPage = isBookPage(note.path);

		const metaInfo: MetaInfo = isPage
			? {
					fileType: "Page",
					index: Number(note.path[note.path.length - 1]),
					status: note.status,
				}
			: {
					fileType: "Scroll",
					status: note.status,
				};

		return {
			payload: {
				content: editOrAddMetaInfo("", metaInfo),
				prettyPath: this.notePathToPrettyPath(note.path),
			},
			type: VaultActionType.UpdateOrCreateFile,
		};
	}

	private trashNoteAction(note: NoteDto): VaultAction {
		return {
			payload: {
				prettyPath: this.notePathToPrettyPath(note.path),
			},
			type: VaultActionType.TrashFile,
		};
	}

	private createStatusUpdateAction(change: NoteStatusChange): VaultAction {
		const isPage = isBookPage(change.path);

		const metaInfo: MetaInfo = isPage
			? {
					fileType: "Page",
					index: Number(change.path[change.path.length - 1]),
					status: change.newStatus,
				}
			: {
					fileType: "Scroll",
					status: change.newStatus,
				};

		return {
			payload: {
				prettyPath: this.notePathToPrettyPath(change.path),
				transform: (content: string) =>
					editOrAddMetaInfo(content, metaInfo),
			},
			type: VaultActionType.ProcessFile,
		};
	}

	// ─── Section Actions ──────────────────────────────────────────────

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

	// ─── Codex Actions ────────────────────────────────────────────────

	private createCodexAction(
		sectionPath: TreePath,
		getNode?: GetNodeV2Fn,
	): VaultAction {
		return {
			payload: {
				content: this.generateCodexContent(sectionPath, getNode),
				prettyPath: this.codexPrettyPath(sectionPath),
			},
			type: VaultActionType.UpdateOrCreateFile,
		};
	}

	private updateCodexAction(
		path: TreePath,
		getNode?: GetNodeV2Fn,
	): VaultAction {
		return {
			payload: {
				content: this.generateCodexContent(path, getNode),
				prettyPath: this.codexPrettyPath(path),
			},
			type: VaultActionType.UpdateOrCreateFile,
		};
	}

	private trashCodexAction(sectionPath: TreePath): VaultAction {
		return {
			payload: {
				prettyPath: this.codexPrettyPath(sectionPath),
			},
			type: VaultActionType.TrashFile,
		};
	}

	private generateCodexContent(
		path: TreePath,
		getNode?: GetNodeV2Fn,
	): string {
		if (!getNode) {
			return ""; // No tree access
		}

		// Get root to create generator
		const root = getNode([]);
		if (!root || root.type !== NodeTypeV2.Section) {
			return ""; // Root not found or invalid
		}

		const node = path.length === 0 ? root : getNode(path);
		if (!node || node.type !== NodeTypeV2.Section) {
			return ""; // Node not found or not a section (notes don't have codexes)
		}

		const generator = createCodexGeneratorV2(root);
		const codexContent = generator.forSection(node);

		return codexFormatter.format(codexContent);
	}

	// ─── Path Conversion ──────────────────────────────────────────────

	private notePathToPrettyPath(notePath: TreePath): PrettyPath {
		if (isBookPage(notePath)) {
			// Book page: Library/Section/Book/000-Book-Section.md
			const pathParts = [this.rootName, ...notePath.slice(0, -1)];
			const basename = pageNameFromTreePath.encode(notePath);
			return { basename, pathParts };
		}
		// Scroll: Library/Section/Scroll-Section.md
		const pathParts = [this.rootName, ...notePath.slice(0, -1)];
		const basename = notePath.toReversed().join("-");
		return { basename, pathParts };
	}

	private sectionPathToPrettyPath(sectionPath: TreePath): PrettyPath {
		const pathParts = [this.rootName, ...sectionPath.slice(0, -1)];
		const basename = sectionPath[sectionPath.length - 1] ?? "";
		return { basename, pathParts };
	}

	private codexPrettyPath(path: TreePath): PrettyPath {
		if (path.length === 0) {
			// Root codex: Library/__Library.md
			return {
				basename: `__${this.rootName}`,
				pathParts: [this.rootName],
			};
		}
		// Section/Book codex: Library/Section/__Section.md
		const pathParts = [this.rootName, ...path];
		const basename = `__${path.toReversed().join("-")}`;
		return { basename, pathParts };
	}

	// ─── Bulk Operations ─────────────────────────────────────────────

	/**
	 * Generate actions to regenerate all codexes in the tree.
	 * Use when codexes are out of sync with tree state.
	 */
	regenerateAllCodexes(
		sectionPaths: TreePath[],
		getNode: GetNodeV2Fn,
	): VaultAction[] {
		const actions: VaultAction[] = [];

		// Root codex
		actions.push(this.updateCodexAction([], getNode));

		// All section codexes
		for (const path of sectionPaths) {
			actions.push(this.updateCodexAction(path, getNode));
		}

		return actions;
	}
}
