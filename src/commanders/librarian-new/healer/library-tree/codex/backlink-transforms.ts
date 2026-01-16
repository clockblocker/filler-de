/**
 * Transforms for processing backlinks and content.
 * Used by ProcessMdFile actions to update codexes and scrolls.
 */

import { LINE_BREAK, SPACE_F } from "../../../../../types/literals";
import type { Transform } from "../../../../../managers/obsidian/vault-action-manager/types/vault-action";
import type { Codecs } from "../../../codecs";
import type { SectionNodeSegmentId } from "../../../codecs/segment-id";
import type { SectionNode } from "../tree-node/types/tree-node";
import { formatParentBacklink } from "./format-codex-line";
import { generateChildrenList } from "./generate-codex-content";

// ─── Composed Transform ───

/**
 * Create a single transform that updates both backlink and content for a codex.
 * This is the primary transform for codex healing - combines backlink + content
 * into one atomic operation to avoid dependency graph conflicts.
 *
 * @param section - Section node to generate content for
 * @param sectionChain - Full chain including this section
 * @param codecs - Codec API
 * @returns Transform function that updates entire codex
 */
export function makeCodexTransform(
	section: SectionNode,
	sectionChain: SectionNodeSegmentId[],
	codecs: Codecs,
): Transform {
	return (content: string): string => {
		// Generate children content
		const childrenContent = generateChildrenList(
			section,
			sectionChain,
			codecs,
		);

		// For root section (chain length 1), no backlink
		if (sectionChain.length <= 1) {
			return childrenContent;
		}

		// Generate backlink for non-root sections
		const parentChain = sectionChain.slice(0, -1);
		const parentPathParts: string[] = [];
		for (const segId of parentChain) {
			const parseResult = codecs.segmentId.parseSectionSegmentId(segId);
			if (parseResult.isErr()) {
				// Fall back to just children content
				return childrenContent;
			}
			parentPathParts.push(parseResult.value.coreName);
		}

		const parentName = parentPathParts[parentPathParts.length - 1];
		if (!parentName) {
			return childrenContent;
		}

		const backlinkLine = `${formatParentBacklink(parentName, parentPathParts)}${SPACE_F}`;

		// Combine backlink + children content (newline before backlink)
		return `${LINE_BREAK}${backlinkLine}${childrenContent}`;
	};
}

// ─── Constants ───

/**
 * Loose regex to detect existing backlink on first line.
 * Matches patterns like: [[__-...|← ...]] or [[__-...]]
 */
const BACKLINK_PATTERN = /^\[\[__-[^\]]*\]\]/;

// ─── Helpers ───

/**
 * Check if the first line looks like a backlink.
 */
function isBacklinkLine(line: string): boolean {
	return BACKLINK_PATTERN.test(line.trim());
}

/**
 * Split content into first line and rest.
 */
function splitFirstLine(content: string): { firstLine: string; rest: string } {
	const newlineIndex = content.indexOf(LINE_BREAK);
	if (newlineIndex === -1) {
		return { firstLine: content, rest: "" };
	}
	return {
		firstLine: content.slice(0, newlineIndex),
		rest: content.slice(newlineIndex + 1),
	};
}

// ─── Backlink Transforms ───

/**
 * Create transform that updates backlink on first line of a codex.
 * - If line 1 is a backlink: replace it
 * - If line 1 is not a backlink: prepend backlink + newline
 *
 * @param parentChain - Chain to parent section (for backlink target)
 * @param codecs - Codec API for segment ID parsing
 * @returns Transform function
 */
export function makeCodexBacklinkTransform(
	parentChain: SectionNodeSegmentId[],
	codecs: Codecs,
): Transform {
	return (content: string): string => {
		// Root codex has no parent backlink
		if (parentChain.length === 0) {
			return content;
		}

		// Parse parent name from chain
		const parentPathParts: string[] = [];
		for (const segId of parentChain) {
			const parseResult = codecs.segmentId.parseSectionSegmentId(segId);
			if (parseResult.isErr()) {
				// Skip if parsing fails - return content unchanged
				return content;
			}
			parentPathParts.push(parseResult.value.coreName);
		}

		const parentName = parentPathParts[parentPathParts.length - 1];
		if (!parentName) {
			return content;
		}

		const backlinkLine = `${formatParentBacklink(parentName, parentPathParts)}${SPACE_F}`;

		const { firstLine, rest } = splitFirstLine(content);

		if (isBacklinkLine(firstLine)) {
			// Replace existing backlink
			return `${backlinkLine}${LINE_BREAK}${rest}`;
		}

		// Prepend backlink (preserve existing content)
		return `${backlinkLine}${LINE_BREAK}${content}`;
	};
}

/**
 * Create transform that updates content (children list) of a codex.
 * - Preserves line 1 if it's a backlink
 * - Replaces everything after with generated children list
 *
 * @param section - Section node to generate content for
 * @param sectionChain - Full chain including this section
 * @param codecs - Codec API
 * @returns Transform function
 */
export function makeCodexContentTransform(
	section: SectionNode,
	sectionChain: SectionNodeSegmentId[],
	codecs: Codecs,
): Transform {
	return (content: string): string => {
		const childrenContent = generateChildrenList(
			section,
			sectionChain,
			codecs,
		);

		const { firstLine } = splitFirstLine(content);

		if (isBacklinkLine(firstLine)) {
			// Preserve backlink, replace rest
			return `${firstLine}${LINE_BREAK}${childrenContent}`;
		}

		// No backlink - just use children content
		// (backlink transform will add it)
		return childrenContent;
	};
}

/**
 * Create transform that updates backlink on a scroll.
 * Scrolls link back to their parent section's codex.
 * Format: \n[[backlink]]<user content>
 *
 * @param parentChain - Chain to parent section
 * @param codecs - Codec API
 * @returns Transform function
 */
export function makeScrollBacklinkTransform(
	parentChain: SectionNodeSegmentId[],
	codecs: Codecs,
): Transform {
	return (content: string): string => {
		// Scrolls always have a parent (at minimum, the library root)
		if (parentChain.length === 0) {
			return content;
		}

		// Parse parent path parts from chain
		const parentPathParts: string[] = [];
		for (const segId of parentChain) {
			const parseResult = codecs.segmentId.parseSectionSegmentId(segId);
			if (parseResult.isErr()) {
				return content;
			}
			parentPathParts.push(parseResult.value.coreName);
		}

		const parentName = parentPathParts[parentPathParts.length - 1];
		if (!parentName) {
			return content;
		}

		// Scroll backlink points to parent section's codex
		const backlinkLine = `${formatParentBacklink(parentName, parentPathParts)}${SPACE_F}`;

		// Check for existing backlink in new format: \n[[backlink]]\n...
		const { firstLine, rest } = splitFirstLine(content);
		if (firstLine.trim() === "") {
			// First line is empty, check second line
			const { firstLine: secondLine, rest: restAfterSecond } =
				splitFirstLine(rest);
			if (isBacklinkLine(secondLine)) {
				// Replace existing backlink, preserve user content with newline
				return `${LINE_BREAK}${backlinkLine}${LINE_BREAK}${restAfterSecond}`;
			}
		}

		// Check for old format: [[backlink]]\n...
		if (isBacklinkLine(firstLine)) {
			// Replace existing backlink (migrate to new format)
			return `${LINE_BREAK}${backlinkLine}${LINE_BREAK}${rest}`;
		}

		// No existing backlink - prepend with newline after backlink
		return `${LINE_BREAK}${backlinkLine}${LINE_BREAK}${content}`;
	};
}
