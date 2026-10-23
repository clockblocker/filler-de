/**
 * Transforms for processing scroll files.
 * Used by ProcessMdFile actions to update scroll backlinks.
 */

import { goBackLinkHelper } from "@textfresser/note-addressing";
import type { Transform } from "@textfresser/vault-action-manager";
import { Result } from "effect";
import type { Codecs } from "../../../../codecs";
import type { SectionNodeSegmentId } from "../../../../codecs/segment-id";
import { noteMetadataHelper } from "../../../../internal/root/note-metadata";
import { sectionChainToPathParts } from "../../../../path-finder";
import { makeCodexBasename } from "../format-codex-line";

/**
 * Create transform that strips backlink from a scroll.
 * Removes the go-back link from the file, preserving frontmatter/metadata.
 *
 * @returns Transform function
 */
export function makeStripScrollBacklinkTransform(): Transform {
	return noteMetadataHelper.mapBody((body) => goBackLinkHelper.strip(body));
}

/**
 * Create transform that updates backlink on a codex or scroll.
 * Both file types link back to their parent section's codex.
 * Format: [frontmatter]\n[[backlink]]  \n\n<content>[hidden metadata section]
 * The facility writes the hidden section canonically, so running this any
 * number of times gives the bytes of one run.
 *
 * Works correctly for:
 * - Codexes: have `fileType: Codex` frontmatter, no JSON meta (harmless empty match)
 * - Scrolls: may have frontmatter and JSON metadata section
 *
 * @param parentChain - Chain to parent section
 * @param codecs - Codec API
 * @returns A synchronous transform, so a Codex transform built on it stays one
 */
export function makeBacklinkTransform(
	parentChain: SectionNodeSegmentId[],
	codecs: Codecs,
): (content: string) => string {
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
		if (Result.isFailure(parentPathPartsResult)) {
			return content;
		}

		const parentPathParts = parentPathPartsResult.success;
		const parentName = parentPathParts[parentPathParts.length - 1];
		if (!parentName) {
			return content;
		}

		const targetBasename = makeCodexBasename(parentPathParts, codecs);
		return noteMetadataHelper.mapBody((body) =>
			goBackLinkHelper.upsert({
				content: body.trimStart(),
				displayName: parentName,
				targetBasename,
			}),
		)(content);
	};
}
