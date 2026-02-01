/**
 * Transforms for processing scroll files.
 * Used by ProcessMdFile actions to update scroll backlinks.
 */

import type { Transform } from "../../../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { goBackLinkHelper } from "../../../../../../stateless-helpers/go-back-link/go-back-link";
import { noteMetadataHelper } from "../../../../../../stateless-helpers/note-metadata";
import { LINE_BREAK, SPACE_F } from "../../../../../../types/literals";
import type { Codecs } from "../../../../codecs";
import type { SectionNodeSegmentId } from "../../../../codecs/segment-id";
import { sectionChainToPathParts } from "../../../../paths/path-finder";
import { formatParentBacklink } from "../format-codex-line";

/**
 * Create transform that strips backlink from a scroll.
 * Removes the go-back link from the file, preserving frontmatter/metadata.
 *
 * @returns Transform function
 */
export function makeStripScrollBacklinkTransform(): Transform {
	return (content: string): string => {
		// Use goBackLinkHelper.strip to remove go-back link
		// noteMetadataHelper.stripOnlyFrontmatter preserves JSON meta
		const withoutFm = noteMetadataHelper.stripOnlyFrontmatter(content);
		const stripped = goBackLinkHelper.strip(withoutFm);

		// Re-extract frontmatter from original to preserve it
		const fmMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
		if (fmMatch) {
			return `${fmMatch[0]}${stripped}`;
		}
		return stripped;
	};
}

/**
 * Create transform that updates backlink on a scroll.
 * Scrolls link back to their parent section's codex.
 * Format: [frontmatter]\n[[backlink]]  \n\n<content>
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

		// Build backlink to parent section's codex
		const backlinkLine = formatParentBacklink(parentName, parentPathParts);

		// Extract frontmatter if present
		const fmMatch = content.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)/);
		const frontmatter = fmMatch?.[1] ?? "";
		const afterFrontmatter = fmMatch
			? content.slice(frontmatter.length)
			: content;

		// Strip existing go-back link and metadata (except frontmatter which we handle separately)
		const cleanBody = goBackLinkHelper.strip(afterFrontmatter.trimStart());

		// Format: [frontmatter]\n[[backlink]]  \n\n<body>
		return `${frontmatter}${LINE_BREAK}${backlinkLine}${SPACE_F}${LINE_BREAK}${LINE_BREAK}${cleanBody}`;
	};
}
