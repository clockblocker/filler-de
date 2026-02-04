/**
 * Transforms for processing scroll files.
 * Used by ProcessMdFile actions to update scroll backlinks.
 */

import type { Transform } from "../../../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { goBackLinkHelper } from "../../../../../../stateless-helpers/go-back-link/go-back-link";
import { noteMetadataHelper } from "../../../../../../stateless-helpers/note-metadata";
import type { Codecs } from "../../../../codecs";
import type { SectionNodeSegmentId } from "../../../../codecs/segment-id";
import { sectionChainToPathParts } from "../../../../paths/path-finder";
import { makeCodexBasename } from "../format-codex-line";

/**
 * Create transform that strips backlink from a scroll.
 * Removes the go-back link from the file, preserving frontmatter/metadata.
 *
 * @returns Transform function
 */
export function makeStripScrollBacklinkTransform(): Transform {
	return (content: string): string => {
		const { frontmatter, body, jsonSection } =
			noteMetadataHelper.decompose(content);
		const stripped = goBackLinkHelper.strip(body);
		return `${frontmatter}${stripped}${jsonSection}`;
	};
}

/**
 * Create transform that updates backlink on a codex or scroll.
 * Both file types link back to their parent section's codex.
 * Format: [frontmatter]\n[[backlink]]  \n\n<content>\n[json-meta]
 *
 * Works correctly for:
 * - Codexes: have `fileType: Codex` frontmatter, no JSON meta (harmless empty match)
 * - Scrolls: may have frontmatter and JSON metadata section
 *
 * @param parentChain - Chain to parent section
 * @param codecs - Codec API
 * @returns Transform function
 */
export function makeBacklinkTransform(
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

		const { frontmatter, body, jsonSection } =
			noteMetadataHelper.decompose(content);

		const contentWithGoBack = goBackLinkHelper.upsert({
			content: body.trimStart(),
			displayName: parentName,
			targetBasename: makeCodexBasename(parentPathParts),
		});

		return `${frontmatter}${contentWithGoBack}${jsonSection}`;
	};
}
