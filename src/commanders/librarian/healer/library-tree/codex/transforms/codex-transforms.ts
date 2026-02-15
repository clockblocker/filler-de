/**
 * Transforms for processing codex files.
 * Used by ProcessMdFile actions to update codex content and backlinks.
 */

import type { Transform } from "../../../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { goBackLinkHelper } from "../../../../../../stateless-helpers/go-back-link/go-back-link";
import { noteMetadataHelper } from "../../../../../../stateless-helpers/note-metadata";
import { LINE_BREAK } from "../../../../../../types/literals/ui";
import type { Codecs } from "../../../../codecs";
import type { SectionNodeSegmentId } from "../../../../codecs/segment-id";
import type { SectionNode } from "../../tree-node/types/tree-node";
import { generateChildrenList } from "../generate-codex-content";

/**
 * Create a single transform that updates codex content (children list only).
 * Backlink line is added by backlink-healing flow, not here.
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
		const childrenContent = generateChildrenList(
			section,
			sectionChain,
			codecs,
		);
		return metaTransform(childrenContent);
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
