/**
 * Codex content generator.
 * Generates markdown content for a section's codex file.
 */

import { getParsedUserSettings } from "../../../global-state/global-state";
import { LINE_BREAK, SPACE_F, TAB } from "../../../types/literals";
import type { SectionNode, TreeNode } from "../types/tree-node";
import { TreeNodeType } from "../types/tree-node";
import { formatAsLine } from "./content/intended-tree-node-and-codex-line";
import type { AnyIntendedTreeNode } from "./content/schema/intended-tree-node";
import { CodexLineType } from "./content/schema/literals";

/**
 * Generate codex content for a section.
 * Reads maxSectionDepth from global settings.
 *
 * Structure:
 * - Backlink to parent (if not root)
 * - Own direct children (scrolls with checkbox, files without)
 * - Nested sections with their scrolls (up to maxDepth)
 */
export function generateCodexContent(section: SectionNode): string {
	const settings = getParsedUserSettings();
	const maxDepth = settings.maxSectionDepth;
	const lines: string[] = [];

	// Backlink to parent codex
	// Root section (empty chain and empty name) has no parent
	if (section.nodeNameChainToParent.length === 0 && section.nodeName === "") {
		// No backlink for root
	} else if (section.nodeNameChainToParent.length > 0) {
		// Nested section: parent is the last element in the chain
		const parentName =
			section.nodeNameChainToParent[
				section.nodeNameChainToParent.length - 1
			];
		if (parentName) {
			const parentChainToParent = section.nodeNameChainToParent.slice(
				0,
				-1,
			);
			const parentIntended: AnyIntendedTreeNode = {
				node: {
					nodeName: parentName,
					nodeNameChainToParent: parentChainToParent,
					status: section.status,
					type: TreeNodeType.Section,
				},
				type: CodexLineType.ParentSectionCodex,
			};
			const parentLine = formatAsLine(parentIntended);
			lines.push(parentLine);
		}
	}
	// First-level section (empty chain but has name) - no backlink for now
	// (could link to library root if needed, but that requires libraryRoot option)

	// Generate items for children
	lines.push(...generateItems(section.children, 0, maxDepth));

	return (
		LINE_BREAK + lines.map((l) => `${l}${SPACE_F}${LINE_BREAK}`).join("")
	);
}

/**
 * Generate list items for children.
 */
function generateItems(
	children: TreeNode[],
	depth: number,
	maxDepth: number,
): string[] {
	const lines: string[] = [];
	const indent = TAB.repeat(depth);

	for (const child of children) {
		switch (child.type) {
			case TreeNodeType.Scroll: {
				const intended: AnyIntendedTreeNode = {
					node: child,
					type: CodexLineType.Scroll,
				};
				const line = formatAsLine(intended);
				lines.push(`${indent}${line}`);
				break;
			}

			case TreeNodeType.File: {
				const intended: AnyIntendedTreeNode = {
					node: child,
					type: CodexLineType.File,
				};
				const line = formatAsLine(intended);
				lines.push(`${indent}${line}`);
				break;
			}

			case TreeNodeType.Section: {
				const intended: AnyIntendedTreeNode = {
					node: {
						nodeName: child.nodeName,
						nodeNameChainToParent: child.nodeNameChainToParent,
						status: child.status,
						type: TreeNodeType.Section,
					},
					type: CodexLineType.ChildSectionCodex,
				};
				const line = formatAsLine(intended);
				lines.push(`${indent}${line}`);

				if (depth < maxDepth) {
					lines.push(
						...generateItems(child.children, depth + 1, maxDepth),
					);
				}
				break;
			}
		}
	}

	return lines;
}
