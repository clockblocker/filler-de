import {
	codexNameFromTreePath,
	pageNameFromTreePath,
} from "../indexing/formatters";
import { getTreePathFromNode } from "../pure-functions/node";
import type { PageNode, SectionNode, TextNode, TreePath } from "../types";
import { NodeType } from "../types";
import type { BackLink, CodexContent, CodexItem } from "./types";

/**
 * Generates CodexContent from tree nodes.
 *
 * - Section nodes → nested list of children (sections + texts)
 * - Text nodes (books) → flat list of pages
 */
export class CodexGenerator {
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
	 * Generate Codex for a book (text with multiple pages).
	 */
	forBook(node: TextNode): CodexContent {
		return {
			backLink: this.generateBackLink(node),
			items: this.generateBookItems(node),
		};
	}

	/**
	 * Generate Codex for any node that needs one.
	 * Returns null for scrolls (single-page texts don't get Codex).
	 */
	forNode(node: SectionNode | TextNode): CodexContent | null {
		if (node.type === NodeType.Section) {
			return this.forSection(node);
		}

		// Text node - only books (multi-page) get Codex
		if (node.children.length > 1) {
			return this.forBook(node);
		}

		// Scroll - no Codex
		return null;
	}

	/**
	 * Check if a node has a Codex file.
	 * Sections and books have codexes, scrolls don't.
	 */
	hasCodex(node: SectionNode | TextNode): boolean {
		if (node.type === NodeType.Section) {
			return true;
		}
		// Text: only books (multi-page) have codex
		return node.children.length > 1;
	}

	// ─── Private Helpers ─────────────────────────────────────────────

	private generateBackLink(node: SectionNode | TextNode): BackLink {
		const parent = node.parent;

		// Root has no back link
		if (!parent) {
			return null;
		}

		// All parents now have codexes - link to parent's codex
		// For root parent, use [name] directly since getTreePathFromNode returns []
		const parentPath = parent.parent
			? getTreePathFromNode(parent)
			: [parent.name];
		return {
			displayName: parent.name.replace(/_/g, " "),
			target: codexNameFromTreePath.encode(parentPath),
		};
	}

	private generateSectionItems(node: SectionNode): CodexItem[] {
		return node.children.map((child) => this.nodeToItem(child));
	}

	private generateBookItems(node: TextNode): CodexItem[] {
		return node.children.map((page) => this.pageToItem(page, node));
	}

	private nodeToItem(node: SectionNode | TextNode): CodexItem {
		const path = getTreePathFromNode(node);

		if (node.type === NodeType.Section) {
			return {
				children: this.generateSectionItems(node),
				displayName: node.name.replace(/_/g, " "),
				status: node.status,
				target: codexNameFromTreePath.encode(path),
			};
		}

		// TextNode - books show pages as children, scrolls have no children
		const isBook = node.children.length > 1;
		return {
			children: isBook ? this.generateBookItems(node) : [],
			displayName: node.name.replace(/_/g, " "),
			status: node.status,
			target: isBook
				? codexNameFromTreePath.encode(path) // Book links to its codex
				: this.scrollTarget(path), // Scroll links to the file directly
		};
	}

	private pageToItem(page: PageNode, parentText: TextNode): CodexItem {
		const textPath = getTreePathFromNode(parentText);

		return {
			children: [],
			displayName: page.name.replace(/_/g, " "),
			status: page.status,
			target: this.pageTarget(textPath, parentText.name, page.name),
		};
	}

	/**
	 * Generate target for a scroll file.
	 * Scroll files are named: TextName-Parent-Grandparent.md
	 */
	private scrollTarget(path: TreePath): string {
		return path.toReversed().join("-");
	}

	/**
	 * Generate target for a page file.
	 * Page files are named: 000-TextName-Parent.md
	 * After refactor: pages are stored in parent/000-TextName-Parent.md (not parent/page/)
	 * 
	 * Note: getTreePathFromNode includes the node's name only if it has a parent.
	 * For root-level texts, textPath is empty, so we need to include textName.
	 */
	private pageTarget(textPath: TreePath, textName: string, pageIndex: string): string {
		// textPath already includes textName if text has a parent, otherwise it's empty
		const fullPath: TreePath = textPath.length > 0 
			? [...textPath, pageIndex] 
			: [textName, pageIndex];
		return pageNameFromTreePath.encode(fullPath);
	}
}

/** Singleton instance */
export const codexGenerator = new CodexGenerator();
