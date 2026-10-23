/**
 * Generate codex content for a section.
 * Produces markdown content for a section's codex file.
 */

import type { Codecs } from "../../../codecs";
import type { SectionNodeSegmentId } from "../../../codecs/segment-id";
import { sortTreeNodesForDisplay } from "../../../display-name-sort";
import { LINE_BREAK, SPACE_F, TAB } from "../../../internal/root/ui";
import { sectionChainToPathParts } from "../../../path-finder";
import { TreeNodeKind } from "../tree-node/types/atoms";
import type { SectionNode } from "../tree-node/types/tree-node";
import { computeSectionStatus } from "./compute-section-status";
import {
	formatChildSectionLine,
	formatFileLine,
	formatScrollLine,
} from "./format-codex-line";

// ─── Chain Parsing Helper ───

/**
 * Parse section chain to path parts, throwing on error.
 */
function parseChainOrThrow(
	sectionChain: SectionNodeSegmentId[],
	codecs: Codecs,
): string[] {
	const result = sectionChainToPathParts(sectionChain, codecs);
	if (result.isErr()) {
		throw new Error(
			`Failed to parse section chain: ${result.error.kind}. Should never happen with valid tree state.`,
		);
	}
	return result.value;
}

// ─── Children List Generation ───

/**
 * Generate children list content for a section (without backlink).
 * Used by both generateCodexContent and makeCodexContentTransform.
 *
 * @param section - The section node to generate content for
 * @param sectionChain - Full chain including this section
 * @param codecs - Codec API for parsing segment IDs; its rules set the depths
 * @returns Markdown content for children list
 */
export function generateChildrenList(
	section: SectionNode,
	sectionChain: SectionNodeSegmentId[],
	codecs: Codecs,
): string {
	const pathParts = parseChainOrThrow(sectionChain, codecs);

	// Generate items for children
	const lines = generateItems(section, pathParts, 0, codecs);

	if (lines.length === 0) {
		return LINE_BREAK;
	}

	return (
		LINE_BREAK + lines.map((l) => `${l}${SPACE_F}${LINE_BREAK}`).join("")
	);
}

// ─── Full Codex Generation ───

/**
 * Generate codex content for a section (children list only).
 * Backlink to parent is added by backlink-healing flow.
 *
 * Structure: direct children + nested sections with their children (up to maxDepth).
 *
 * @param section - The section node to generate codex for
 * @param sectionChain - Full chain including Library root, e.g. ["Library﹘Section﹘", "A﹘Section﹘"]
 * @param codecs - Codec API for parsing segment IDs; its rules set the depths
 * @returns Markdown content for codex file
 */
export function generateCodexContent(
	section: SectionNode,
	sectionChain: SectionNodeSegmentId[],
	codecs: Codecs,
): string {
	const pathParts = parseChainOrThrow(sectionChain, codecs);
	const lines = generateItems(section, pathParts, 0, codecs);

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
	codecs: Codecs,
): string[] {
	const { maxSectionDepth: maxDepth, showScrollsInCodexesForDepth } =
		codecs.rules;
	const lines: string[] = [];
	const indent = TAB.repeat(depth);

	const children = sortTreeNodesForDisplay(Object.values(section.children));

	for (const child of children) {
		switch (child.kind) {
			case TreeNodeKind.Scroll: {
				if (depth <= showScrollsInCodexesForDepth) {
					const line = formatScrollLine(
						child.nodeName,
						parentPathParts,
						child.status,
						codecs,
					);
					lines.push(`${indent}${line}`);
				}
				break;
			}

			case TreeNodeKind.File: {
				const line = formatFileLine(
					child.nodeName,
					parentPathParts,
					codecs,
				);
				lines.push(`${indent}${line}`);
				break;
			}

			case TreeNodeKind.Section: {
				const sectionStatus = computeSectionStatus(child);
				const line = formatChildSectionLine(
					child.nodeName,
					parentPathParts,
					sectionStatus,
					codecs,
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
							codecs,
						),
					);
				}
				break;
			}
		}
	}

	return lines;
}
