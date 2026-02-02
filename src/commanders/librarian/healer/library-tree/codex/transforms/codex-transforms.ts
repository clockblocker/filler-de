/**
 * Transforms for processing codex files.
 * Used by ProcessMdFile actions to update codex content and backlinks.
 */

import type { Transform } from "../../../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { goBackLinkHelper } from "../../../../../../stateless-helpers/go-back-link/go-back-link";
import { noteMetadataHelper } from "../../../../../../stateless-helpers/note-metadata";
import { LINE_BREAK, SPACE_F } from "../../../../../../types/literals";
import type { Codecs } from "../../../../codecs";
import type { SectionNodeSegmentId } from "../../../../codecs/segment-id";
import { sectionChainToPathParts } from "../../../../paths/path-finder";
import type { SectionNode } from "../../tree-node/types/tree-node";
import { formatParentBacklink } from "../format-codex-line";
import { generateChildrenList } from "../generate-codex-content";

/**
 * Create a single transform that updates both backlink and content for a codex.
 * This is the primary transform for codex healing - combines backlink + content
 * into one atomic operation to avoid dependency graph conflicts.
 * Also adds fileType: Codex metadata (respects hideMetadata setting).
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
	const metaTransform = noteMetadataHelper.upsert({ fileType: "Codex" });

	return (_content: string) => {
		// Generate children content
		const childrenContent = generateChildrenList(
			section,
			sectionChain,
			codecs,
		);

		let codexContent: string;

		// For root section (chain length 1), no backlink
		if (sectionChain.length <= 1) {
			codexContent = childrenContent;
		} else {
			// Generate backlink for non-root sections
			const parentChain = sectionChain.slice(0, -1);
			const parentPathPartsResult = sectionChainToPathParts(
				parentChain,
				codecs,
			);
			if (parentPathPartsResult.isErr()) {
				// Fall back to just children content
				codexContent = childrenContent;
			} else {
				const parentPathParts = parentPathPartsResult.value;
				const parentName = parentPathParts[parentPathParts.length - 1];
				if (!parentName) {
					codexContent = childrenContent;
				} else {
					const backlinkLine = formatParentBacklink(
						parentName,
						parentPathParts,
					);
					// Format: \n[[backlink]]  \n\n<children content>
					codexContent = `${LINE_BREAK}${backlinkLine}${SPACE_F}${childrenContent}`;
				}
			}
		}

		// Apply metadata transform
		return metaTransform(codexContent);
	};
}

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
		const parentPathPartsResult = sectionChainToPathParts(
			parentChain,
			codecs,
		);
		if (parentPathPartsResult.isErr()) {
			// Skip if parsing fails - return content unchanged
			return content;
		}

		const parentPathParts = parentPathPartsResult.value;
		const parentName = parentPathParts[parentPathParts.length - 1];
		if (!parentName) {
			return content;
		}

		const backlinkLine = formatParentBacklink(parentName, parentPathParts);

		// Strip existing go-back link if present
		const cleanContent = goBackLinkHelper.strip(content.trimStart());

		// Format: \n[[backlink]]  \n\n<content>
		return `${LINE_BREAK}${backlinkLine}${SPACE_F}${LINE_BREAK}${LINE_BREAK}${cleanContent}`;
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

		// Check if first non-empty line is a backlink
		const trimmed = content.trimStart();
		const firstLineEnd = trimmed.indexOf("\n");
		const firstLine =
			firstLineEnd === -1 ? trimmed : trimmed.slice(0, firstLineEnd);

		if (goBackLinkHelper.isMatch(firstLine)) {
			// Preserve backlink line, replace rest with children content
			return `${firstLine}${LINE_BREAK}${childrenContent}`;
		}

		// No backlink - just use children content
		// (backlink transform will add it)
		return childrenContent;
	};
}
