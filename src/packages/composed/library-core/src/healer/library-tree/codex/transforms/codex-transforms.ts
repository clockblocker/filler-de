/**
 * Transforms for processing codex files.
 * Used by ProcessMdFile actions to update codex content and backlinks.
 */

import type { Transform } from "@textfresser/vault-action-manager";
import type { Codecs } from "../../../../codecs";
import type { SectionNodeSegmentId } from "../../../../codecs/segment-id";
import { noteMetadataHelper } from "../../../../internal/root/note-metadata";
import type { SectionNode } from "../../tree-node/types/tree-node";
import { generateChildrenList } from "../generate-codex-content";
import { makeBacklinkTransform } from "./scroll-transforms";

/**
 * Create a single transform that writes the complete Codex projection:
 * children, metadata, and (for non-root Codexes) the parent backlink.
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

	return async (_content: string) => {
		const childrenContent = generateChildrenList(
			section,
			sectionChain,
			codecs,
		);
		const withMetadata = await metaTransform(childrenContent);
		return sectionChain.length > 1
			? await makeBacklinkTransform(
					sectionChain.slice(0, -1),
					codecs,
				)(withMetadata)
			: withMetadata;
	};
}
