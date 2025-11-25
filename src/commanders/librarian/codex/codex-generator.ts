import { codexNameFromTreePath } from "../indexing/formatters";
import { getTreePathFromNode } from "../pure-functions/node";
import type { PageNode, SectionNode, TextNode, TreePath } from "../types";
import { NodeType } from "../types";
import type { BackLink, CodexContent, CodexItem, CodexType } from "./types";

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
	 * Get the Codex type for a node.
	 */
	getCodexType(node: SectionNode | TextNode): CodexType | null {
		if (node.type === NodeType.Section) {
			return "section";
		}
		if (node.children.length > 1) {
			return "book";
		}
		return null; // scroll
	}

	// ─── Private Helpers ─────────────────────────────────────────────

	private generateBackLink(node: SectionNode | TextNode): BackLink {
		const parent = node.parent;

		// Root has no back link
		if (!parent) {
			return null;
		}

		// Parent is root - link to root
		if (!parent.parent) {
			return {
				displayName: parent.name,
				target: parent.name, // Just the name, not a codex path
			};
		}

		// Regular parent - link to parent's codex
		const parentPath = getTreePathFromNode(parent);
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

		// TextNode
		const isBook = node.children.length > 1;
		return {
			children: [], // Texts don't have nested children in parent's codex
			displayName: node.name.replace(/_/g, " "),
			status: node.status,
			target: isBook
				? codexNameFromTreePath.encode(path) // Book links to its codex
				: this.scrollTarget(path), // Scroll links to the file directly
		};
	}

	private pageToItem(page: PageNode, parentText: TextNode): CodexItem {
		const textPath = getTreePathFromNode(parentText);
		const pageIndex = page.name; // "000", "001", etc.

		return {
			children: [],
			displayName: `Page ${Number.parseInt(pageIndex, 10) + 1}`,
			status: page.status,
			target: this.pageTarget(textPath, pageIndex),
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
	 */
	private pageTarget(textPath: TreePath, pageIndex: string): string {
		return `${pageIndex}-${textPath.toReversed().join("-")}`;
	}
}

/** Singleton instance */
export const codexGenerator = new CodexGenerator();
