import {
	treePathToCodexBasename,
	treePathToPageBasenameLegacy,
	treePathToScrollBasename,
} from "../indexing/codecs";
import {
	NodeTypeLegacy,
	type NoteNodeLegacy,
	type SectionNodeLegacy,
	type TreePathLegacyLegacy,
} from "../types";
import type { BackLink, CodexContent, CodexItem } from "./types";

type TreeNodeLegacy = SectionNodeLegacy | NoteNodeLegacy;

/**
 * Check if a note path represents a book page (numeric suffix like "000").
 */
function isBookPage(notePath: TreePathLegacyLegacy): boolean {
	const lastSegment = notePath[notePath.length - 1];
	return !!lastSegment && /^\d{3}$/.test(lastSegment);
}

/**
 * Get path from node by walking up to root.
 */
function getPathFromNode(
	node: TreeNodeLegacy,
	root: SectionNodeLegacy,
): TreePathLegacyLegacy {
	const path: TreePathLegacyLegacy = [];
	let current: TreeNodeLegacy | null = node;

	while (current && current !== root) {
		path.unshift(current.name);
		current = current.parent;
	}

	return path;
}

/**
 * Generates CodexContent from tree nodes.
 *
 * - SectionNodeLegacy can contain Sections or Notes
 * - Books are Sections containing Notes with numeric names (000, 001, etc.)
 * - Scrolls are Notes with non-numeric names
 */
export class CodexGenerator {
	private root: SectionNodeLegacy;

	constructor(root: SectionNodeLegacy) {
		this.root = root;
	}

	generateCodexForSection(node: SectionNodeLegacy): CodexContent {
		return {
			backLink: this.generateBackLink(node),
			items: this.generateSectionItems(node),
		};
	}

	/**
	 * Check if section is a "book" (all children are notes with numeric names).
	 */
	isBook(node: SectionNodeLegacy): boolean {
		if (node.children.length === 0) return false;

		return node.children.every(
			(child) =>
				child.type === NodeTypeLegacy.Note &&
				/^\d{3}$/.test(child.name),
		);
	}

	/**
	 * Check if a section needs a codex.
	 * All sections have codexes (including books).
	 * Notes (scrolls/pages) don't have codexes.
	 */
	hasCodex(node: TreeNodeLegacy): boolean {
		return node.type === NodeTypeLegacy.Section;
	}

	// ─── Private Helpers ─────────────────────────────────────────────

	private generateBackLink(node: SectionNodeLegacy): BackLink {
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

	private generateSectionItems(node: SectionNodeLegacy): CodexItem[] {
		return node.children.map((child) => this.nodeToItem(child));
	}

	private nodeToItem(node: TreeNodeLegacy): CodexItem {
		const path = this.getPath(node);

		if (node.type === NodeTypeLegacy.Note) {
			// Note - determine if book page or scroll
			const isPage = isBookPage(path);

			return {
				children: [],
				displayName: node.name.replace(/_/g, " "),
				status: node.status,
				target: isPage
					? treePathToPageBasenameLegacy.encode(path)
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

	private getPath(node: TreeNodeLegacy): TreePathLegacyLegacy {
		return getPathFromNode(node, this.root);
	}
}

/**
 * Create a CodexGenerator instance for a tree.
 */
export function createCodexGenerator(root: SectionNodeLegacy): CodexGenerator {
	return new CodexGenerator(root);
}
