import {
	codexNameFromTreePath,
	pageNameFromTreePath,
	scrollNameFromTreePath,
} from "../indexing/formatters";
import {
	NodeTypeV2,
	type NoteNode,
	type SectionNodeV2,
	type TreePath,
} from "../types";
import type { BackLink, CodexContent, CodexItem } from "./types";

type TreeNodeV2 = SectionNodeV2 | NoteNode;

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
function getPathFromNode(node: TreeNodeV2, root: SectionNodeV2): TreePath {
	const path: TreePath = [];
	let current: TreeNodeV2 | null = node;

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
 * - SectionNodeV2 can contain Sections or Notes
 * - Books are Sections containing Notes with numeric names (000, 001, etc.)
 * - Scrolls are Notes with non-numeric names
 */
export class CodexGeneratorV2 {
	private root: SectionNodeV2;

	constructor(root: SectionNodeV2) {
		this.root = root;
	}

	/**
	 * Generate Codex for a section node.
	 */
	forSection(node: SectionNodeV2): CodexContent {
		return {
			backLink: this.generateBackLink(node),
			items: this.generateSectionItems(node),
		};
	}

	/**
	 * Check if section is a "book" (all children are notes with numeric names).
	 */
	isBook(node: SectionNodeV2): boolean {
		if (node.children.length === 0) return false;

		return node.children.every(
			(child) =>
				child.type === NodeTypeV2.Note && /^\d{3}$/.test(child.name),
		);
	}

	/**
	 * Check if a section needs a codex.
	 * All sections have codexes (including books).
	 * Notes (scrolls/pages) don't have codexes.
	 */
	hasCodex(node: TreeNodeV2): boolean {
		return node.type === NodeTypeV2.Section;
	}

	// ─── Private Helpers ─────────────────────────────────────────────

	private generateBackLink(node: SectionNodeV2): BackLink {
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
				target: `__${parent.name}`,
			};
		}

		return {
			displayName: parent.name.replace(/_/g, " "),
			target: codexNameFromTreePath.encode(parentPath),
		};
	}

	private generateSectionItems(node: SectionNodeV2): CodexItem[] {
		return node.children.map((child) => this.nodeToItem(child));
	}

	private nodeToItem(node: TreeNodeV2): CodexItem {
		const path = this.getPath(node);

		if (node.type === NodeTypeV2.Note) {
			// Note - determine if book page or scroll
			const isPage = isBookPage(path);

			return {
				children: [],
				displayName: node.name.replace(/_/g, " "),
				status: node.status,
				target: isPage
					? pageNameFromTreePath.encode(path)
					: scrollNameFromTreePath.encode(path),
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
				target: codexNameFromTreePath.encode(path),
			};
		}

		// Regular section - show children, link to codex
		return {
			children: this.generateSectionItems(node),
			displayName: node.name.replace(/_/g, " "),
			status: node.status,
			target: codexNameFromTreePath.encode(path),
		};
	}

	private getPath(node: TreeNodeV2): TreePath {
		return getPathFromNode(node, this.root);
	}
}

/**
 * Create a CodexGeneratorV2 instance for a tree.
 */
export function createCodexGeneratorV2(root: SectionNodeV2): CodexGeneratorV2 {
	return new CodexGeneratorV2(root);
}
