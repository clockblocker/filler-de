/**
 * Transforms for processing scroll files.
 * Used by ProcessMdFile actions to update scroll backlinks.
 */

import type { Transform } from "../../../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { goBackLinkHelper } from "../../../../../../stateless-helpers/go-back-link";
import { LINE_BREAK, SPACE_F } from "../../../../../../types/literals";
import type { Codecs } from "../../../../codecs";
import type { SectionNodeSegmentId } from "../../../../codecs/segment-id";
import { sectionChainToPathParts } from "../../../../paths/path-finder";
import { formatParentBacklink } from "../format-codex-line";
import {
	ensureLeadingBlankLine,
	splitFirstLine,
	splitFrontmatter,
} from "./transform-utils";

/**
 * Create transform that strips backlink from a scroll.
 * Removes the go-back link from the file (after frontmatter if present).
 *
 * @returns Transform function
 */
export function makeStripScrollBacklinkTransform(): Transform {
	return (content: string): string => {
		const { frontmatter, rest: afterFrontmatter } =
			splitFrontmatter(content);

		// Work with content after frontmatter
		const workContent = frontmatter ? afterFrontmatter : content;

		// Check for format: \n[[backlink]]\n...
		const { firstLine, rest } = splitFirstLine(workContent);
		if (firstLine.trim() === "") {
			const { firstLine: secondLine, rest: restAfterSecond } =
				splitFirstLine(rest);
			if (goBackLinkHelper.isMatch(secondLine)) {
				// Strip backlink
				return frontmatter
					? `${frontmatter}${restAfterSecond}`
					: restAfterSecond;
			}
		}

		// Check for format without leading newline: [[backlink]]\n...
		if (goBackLinkHelper.isMatch(firstLine)) {
			return frontmatter ? `${frontmatter}${rest}` : rest;
		}

		// No backlink to strip
		return content;
	};
}

/**
 * Create transform that updates backlink on a scroll.
 * Scrolls link back to their parent section's codex.
 * Places backlink after YAML frontmatter if present.
 * Format: [frontmatter]\n[[backlink]]\n<user content>
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
		const parentPathPartsResult = sectionChainToPathParts(
			parentChain,
			codecs,
		);
		if (parentPathPartsResult.isErr()) {
			return content;
		}

		const parentPathParts = parentPathPartsResult.value;
		const parentName = parentPathParts[parentPathParts.length - 1];
		if (!parentName) {
			return content;
		}

		// Scroll backlink points to parent section's codex
		const backlinkLine = `${formatParentBacklink(parentName, parentPathParts)}${SPACE_F}`;

		// Split frontmatter from rest
		const { frontmatter, rest: afterFrontmatter } =
			splitFrontmatter(content);

		// Work with content after frontmatter
		const workContent = frontmatter ? afterFrontmatter : content;

		// Check for existing backlink in format: \n[[backlink]]\n...
		const { firstLine, rest } = splitFirstLine(workContent);
		if (firstLine.trim() === "") {
			// First line is empty, check second line
			const { firstLine: secondLine, rest: restAfterSecond } =
				splitFirstLine(rest);
			if (goBackLinkHelper.isMatch(secondLine)) {
				// Replace existing backlink, ensure blank line before content
				const newContent = `${LINE_BREAK}${backlinkLine}${ensureLeadingBlankLine(restAfterSecond)}`;
				return frontmatter ? `${frontmatter}${newContent}` : newContent;
			}
		}

		// Check for format without leading newline: [[backlink]]\n...
		if (goBackLinkHelper.isMatch(firstLine)) {
			// Replace existing backlink, ensure blank line before content
			const newContent = `${LINE_BREAK}${backlinkLine}${ensureLeadingBlankLine(rest)}`;
			return frontmatter ? `${frontmatter}${newContent}` : newContent;
		}

		// No existing backlink - insert after frontmatter or at start
		const newContent = `${LINE_BREAK}${backlinkLine}${ensureLeadingBlankLine(workContent)}`;
		return frontmatter ? `${frontmatter}${newContent}` : newContent;
	};
}
