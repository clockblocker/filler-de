/**
 * Generate codex content for a section.
 * Produces markdown content for a section's codex file.
 */

import { getParsedUserSettings } from "../../../../global-state/global-state";
import { LINE_BREAK, SPACE_F, TAB } from "../../../../types/literals";
import { TreeNodeType } from "../tree-node/types/atoms";
import type { SectionNodeSegmentId } from "../tree-node/types/node-segment-id";
import { NodeSegmentIdSeparator } from "../tree-node/types/node-segment-id";
import type { SectionNode, TreeNode } from "../tree-node/types/tree-node";
import { computeSectionStatus } from "./compute-section-status";
import {
	formatChildSectionLine,
	formatFileLine,
	formatParentBacklink,
	formatScrollLine,
} from "./format-codex-line";

/**
 * Generate codex content for a section.
 *
 * Structure:
 * - Backlink to parent (if not root)
 * - Own direct children (scrolls with checkbox, files without)
 * - Nested sections with their children (up to maxDepth)
 *
 * @param section - The section node to generate codex for
 * @param sectionChain - Full chain including Library root, e.g. ["Library﹘Section﹘", "A﹘Section﹘"]
 * @returns Markdown content for codex file
 */
export function generateCodexContent(
	section: SectionNode,
	sectionChain: SectionNodeSegmentId[],
): string {
	const settings = getParsedUserSettings();
	const maxDepth = settings.maxSectionDepth;
	const showScrollsForDepth = settings.showScrollsInCodexesForDepth;
	const libraryRoot = settings.splitPathToLibraryRoot.basename;

	const lines: string[] = [];

	// Extract path parts from chain (node names)
	const pathParts = sectionChain.map(extractNodeNameFromSegmentId);

	// Parent backlink (if not root)
	if (sectionChain.length > 1) {
		// Has parent
		const parentChain = sectionChain.slice(0, -1);
		const parentPathParts = parentChain.map(extractNodeNameFromSegmentId);
		const parentName = parentPathParts[parentPathParts.length - 1];

		if (parentName) {
			lines.push(formatParentBacklink(parentName, parentPathParts));
		}
	}
	// Root library (chain length 1, name is library root) - no backlink

	// Generate items for children
	lines.push(
		...generateItems(
			section,
			pathParts,
			0,
			maxDepth,
			showScrollsForDepth,
		),
	);

	if (lines.length === 0) {
		return LINE_BREAK;
	}

	return (
		LINE_BREAK + lines.map((l) => `${l}${SPACE_F}${LINE_BREAK}`).join("")
	);
}

/**
 * Generate list items for children.
 */
function generateItems(
	section: SectionNode,
	parentPathParts: string[],
	depth: number,
	maxDepth: number,
	showScrollsForDepth: number,
): string[] {
	const lines: string[] = [];
	const indent = TAB.repeat(depth);

	const children = Object.values(section.children);

	for (const child of children) {
		switch (child.type) {
			case TreeNodeType.Scroll: {
				if (depth <= showScrollsForDepth) {
					const line = formatScrollLine(
						child.nodeName,
						parentPathParts,
						child.status,
					);
					lines.push(`${indent}${line}`);
				}
				break;
			}

			case TreeNodeType.File: {
				const line = formatFileLine(child.nodeName, parentPathParts);
				lines.push(`${indent}${line}`);
				break;
			}

			case TreeNodeType.Section: {
				const sectionStatus = computeSectionStatus(child);
				const line = formatChildSectionLine(
					child.nodeName,
					parentPathParts,
					sectionStatus,
				);
				lines.push(`${indent}${line}`);

				if (depth < maxDepth) {
					// Recurse with extended path
					const childPathParts = [...parentPathParts, child.nodeName];
					lines.push(
						...generateItems(
							child,
							childPathParts,
							depth + 1,
							maxDepth,
							showScrollsForDepth,
						),
					);
				}
				break;
			}
		}
	}

	return lines;
}

function extractNodeNameFromSegmentId(segId: SectionNodeSegmentId): string {
	const sep = NodeSegmentIdSeparator;
	const [raw] = segId.split(sep, 1);
	return raw ?? "";
}
