import {
	treePathToCodexBasename,
	treePathToPageBasename,
	treePathToScrollBasename,
} from "../indexing/codecs";
import {
	NodeType,
	type NoteNode,
	type SectionNode,
	type TreePath,
} from "../types";
import type { BackLink, CodexContent, CodexItem } from "./types";

type TreeNode = SectionNode | NoteNode;

/**
 * Check if a note path represents a book page (numeric suffix like "000").
 */
function isBookPage(notePath: TreePath): boolean {
	const lastSegment = notePath[notePath.length - 1];
	return !!lastSegment && /^\d{3}$/.test(lastSegment);
}

/**
 * Get path from node by walking up to root.
 */
function getPathFromNode(node: TreeNode, root: SectionNode): TreePath {
	const path: TreePath = [];
	let current: TreeNode | null = node;

	while (current && current !== root) {
		path.unshift(current.name);
		current = current.parent;
	}

	return path;
}

/**
 * Generates CodexContent from V2 tree nodes.
 *
 * In V2:
 * - SectionNode can contain Sections or Notes
 * - Books are Sections containing Notes with numeric names (000, 001, etc.)
 * - Scrolls are Notes with non-numeric names
 */
export class CodexGenerator {
	private root: SectionNode;

	constructor(root: SectionNode) {
		this.root = root;
	}

	/**
	 * Generate Codex for a section node.
	 */
	forSection(node: SectionNode): CodexContent {
		return {
			backLink: this.generateBackLink(node),
			items: this.generateSectionItems(node),
		};
	}

	/**
	 * Check if section is a "book" (all children are notes with numeric names).
	 */
	isBook(node: SectionNode): boolean {
		if (node.children.length === 0) return false;

		return node.children.every(
			(child) =>
				child.type === NodeType.Note && /^\d{3}$/.test(child.name),
		);
	}

	/**
	 * Check if a section needs a codex.
	 * All sections have codexes (including books).
	 * Notes (scrolls/pages) don't have codexes.
	 */
	hasCodex(node: TreeNode): boolean {
		return node.type === NodeType.Section;
	}

	// ─── Private Helpers ─────────────────────────────────────────────

	private generateBackLink(node: SectionNode): BackLink {
		const parent = node.parent;

		// Root has no back link
		if (!parent) {
			return null;
		}

		// Link to parent's codex
		const parentPath = this.getPath(parent);
		if (parentPath.length === 0) {
			// Parent is root - use root name
			return {
				displayName: parent.name.replace(/_/g, " "),
				target: treePathToCodexBasename.encode([parent.name]),
			};
		}

		return {
			displayName: parent.name.replace(/_/g, " "),
			target: treePathToCodexBasename.encode(parentPath),
		};
	}

	private generateSectionItems(node: SectionNode): CodexItem[] {
		return node.children.map((child) => this.nodeToItem(child));
	}

	private nodeToItem(node: TreeNode): CodexItem {
		const path = this.getPath(node);

		if (node.type === NodeType.Note) {
			// Note - determine if book page or scroll
			const isPage = isBookPage(path);

			return {
				children: [],
				displayName: node.name.replace(/_/g, " "),
				status: node.status,
				target: isPage
					? treePathToPageBasename.encode(path)
					: treePathToScrollBasename.encode(path),
			};
		}

		// Section - check if it's a book (all children are numeric notes)
		const isBook = this.isBook(node);

		if (isBook) {
			// Book section - show pages as children, link to book's codex
			return {
				children: this.generateSectionItems(node),
				displayName: node.name.replace(/_/g, " "),
				status: node.status,
				target: treePathToCodexBasename.encode(path),
			};
		}

		// Regular section - show children, link to codex
		return {
			children: this.generateSectionItems(node),
			displayName: node.name.replace(/_/g, " "),
			status: node.status,
			target: treePathToCodexBasename.encode(path),
		};
	}

	private getPath(node: TreeNode): TreePath {
		return getPathFromNode(node, this.root);
	}
}

/**
 * Create a CodexGenerator instance for a tree.
 */
export function createCodexGenerator(root: SectionNode): CodexGenerator {
	return new CodexGenerator(root);
}
