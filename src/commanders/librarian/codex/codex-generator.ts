/**
 * Codex content generator.
 * Generates markdown content for a section's codex file.
 */

import {
	BACK_ARROW,
	DONE_CHECKBOX,
	LINE_BREAK,
	NOT_STARTED_CHECKBOX,
	SPACE_F,
	TAB,
} from "../../../types/literals";
import type { CoreNameChainFromRoot } from "../types/split-basename";
import type { SectionNode, TreeNode } from "../types/tree-node";
import { TreeNodeStatus, TreeNodeType } from "../types/tree-node";
import { buildCodexBasename } from "../utils/codex-utils";

/** Max depth for nested sections in codex */
const MAX_SECTION_DEPTH = 4;

export type CodexGeneratorOptions = {
	/** Max depth for nested sections (default: 4) */
	maxSectionDepth?: number;
	/** Suffix delimiter (default: "-") */
	suffixDelimiter?: string;
};

/**
 * Generate codex content for a section.
 *
 * Structure:
 * - Backlink to parent (if not root)
 * - Own direct children (scrolls with checkbox, files without)
 * - Nested sections with their scrolls (up to maxDepth)
 */
export function generateCodexContent(
	section: SectionNode,
	options: CodexGeneratorOptions = {},
): string {
	const maxDepth = options.maxSectionDepth ?? MAX_SECTION_DEPTH;
	const delimiter = options.suffixDelimiter ?? "-";
	const lines: string[] = [];

	// Backlink to parent codex
	const backlink = generateBacklink(section.coreNameChainToParent, delimiter);
	if (backlink) {
		lines.push(backlink);
	}

	// Generate items for children
	lines.push(...generateItems(section.children, 0, maxDepth, delimiter));

	// Format with trailing space and line breaks
	return (
		LINE_BREAK + lines.map((l) => `${l}${SPACE_F}${LINE_BREAK}`).join("")
	);
}

/**
 * Generate backlink to parent section's codex.
 * Returns null for root-level sections.
 */
function generateBacklink(
	coreNameChainToParent: CoreNameChainFromRoot,
	delimiter: string,
): string | null {
	if (coreNameChainToParent.length === 0) {
		return null;
	}

	// Parent is the last element in the chain
	const parentName = coreNameChainToParent[coreNameChainToParent.length - 1]!;
	const parentCodexCoreName = buildCodexBasename(parentName);
	// Parent's chain is everything except the last element
	const parentChainToParent = coreNameChainToParent.slice(0, -1);
	const parentCodexFullBasename = buildFullBasename(
		parentCodexCoreName,
		parentChainToParent,
		delimiter,
	);

	return `[[${parentCodexFullBasename}|${BACK_ARROW} ${parentName}]]`;
}

/**
 * Build full basename with suffix from node.
 * e.g., coreName="Rice", chainToParent=["Recipe", "Poridge"] → "Rice-Poridge-Recipe"
 */
function buildFullBasename(
	coreName: string,
	coreNameChainToParent: string[],
	delimiter: string,
): string {
	if (coreNameChainToParent.length === 0) {
		return coreName;
	}
	const suffix = [...coreNameChainToParent].reverse().join(delimiter);
	return `${coreName}${delimiter}${suffix}`;
}

/**
 * Generate list items for children.
 */
function generateItems(
	children: TreeNode[],
	depth: number,
	maxDepth: number,
	delimiter: string,
): string[] {
	const lines: string[] = [];
	const indent = TAB.repeat(depth);

	for (const child of children) {
		switch (child.type) {
			case TreeNodeType.Scroll: {
				const checkbox = statusToCheckbox(child.status);
				const fullBasename = buildFullBasename(
					child.coreName,
					child.coreNameChainToParent,
					delimiter,
				);
				const link = `[[${fullBasename}|${child.coreName}]]`;
				lines.push(`${indent}${checkbox} ${link}`);
				break;
			}

			case TreeNodeType.File: {
				// Files don't have checkbox (non-toggleable)
				const fullBasename = buildFullBasename(
					child.coreName,
					child.coreNameChainToParent,
					delimiter,
				);
				const link = `[[${fullBasename}|${child.coreName}]]`;
				lines.push(`${indent}- ${link}`);
				break;
			}

			case TreeNodeType.Section: {
				// Build codex link with suffix
				const codexCoreName = buildCodexBasename(child.coreName);
				const codexFullBasename = buildFullBasename(
					codexCoreName,
					child.coreNameChainToParent,
					delimiter,
				);

				if (depth >= maxDepth) {
					// At max depth, just show section as link
					const checkbox = statusToCheckbox(child.status);
					lines.push(
						`${indent}${checkbox} [[${codexFullBasename}|${child.coreName}]]`,
					);
				} else {
					// Show section with checkbox and recurse into children
					const checkbox = statusToCheckbox(child.status);
					lines.push(
						`${indent}${checkbox} [[${codexFullBasename}|${child.coreName}]]`,
					);
					lines.push(
						...generateItems(
							child.children,
							depth + 1,
							maxDepth,
							delimiter,
						),
					);
				}
				break;
			}
		}
	}

	return lines;
}

function statusToCheckbox(
	status: typeof TreeNodeStatus.Done | typeof TreeNodeStatus.NotStarted,
): string {
	return status === TreeNodeStatus.Done
		? DONE_CHECKBOX
		: NOT_STARTED_CHECKBOX;
}
