/**
 * Transforms for processing scroll files.
 * Used by ProcessMdFile actions to update scroll backlinks.
 */

import type { Transform } from "../../../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { goBackLinkHelper } from "../../../../../../stateless-helpers/go-back-link/go-back-link";
import { noteMetadataHelper } from "../../../../../../stateless-helpers/note-metadata";
import { LINE_BREAK, SPACE_F } from "../../../../../../types/literals";
import { logger } from "../../../../../../utils/logger";
import type { Codecs } from "../../../../codecs";
import type { SectionNodeSegmentId } from "../../../../codecs/segment-id";
import { sectionChainToPathParts } from "../../../../paths/path-finder";
import { makeCodexBasename } from "../format-codex-line";

/** Pattern to match JSON metadata section at end of file */
const JSON_META_PATTERN =
	/(\n*<section\s+id=[{"]textfresser_meta_keep_me_invisible[}"]>[\s\S]*?<\/section>\n*)$/;

/**
 * Create transform that strips backlink from a scroll.
 * Removes the go-back link from the file, preserving frontmatter/metadata.
 *
 * @returns Transform function
 */
export function makeStripScrollBacklinkTransform(): Transform {
	return (content: string): string => {
		// Extract JSON metadata section (at end of file) to preserve it
		const jsonMetaMatch = content.match(JSON_META_PATTERN);
		const jsonMeta = jsonMetaMatch?.[1] ?? "";
		const contentWithoutJsonMeta = jsonMeta
			? content.slice(0, -jsonMeta.length)
			: content;

		// Use goBackLinkHelper.strip to remove go-back link
		// noteMetadataHelper.stripOnlyFrontmatter preserves JSON meta
		const withoutFm = noteMetadataHelper.stripOnlyFrontmatter(
			contentWithoutJsonMeta,
		);
		const stripped = goBackLinkHelper.strip(withoutFm);

		// Re-extract frontmatter from original to preserve it
		const fmMatch = contentWithoutJsonMeta.match(
			/^---\r?\n[\s\S]*?\r?\n---\r?\n?/,
		);
		if (fmMatch) {
			return `${fmMatch[0]}${stripped}${jsonMeta}`;
		}
		return `${stripped}${jsonMeta}`;
	};
}

/**
 * Create transform that updates backlink on a scroll.
 * Scrolls link back to their parent section's codex.
 * Format: [frontmatter]\n[[backlink]]  \n\n<content>\n[json-meta]
 *
 * IMPORTANT: Preserves JSON metadata section at end of file (contains status, navIdx, etc.)
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

		// Extract JSON metadata section (at end of file) to preserve it
		const jsonMetaMatch = content.match(JSON_META_PATTERN);
		const jsonMeta = jsonMetaMatch?.[1] ?? "";
		const contentWithoutJsonMeta = jsonMeta
			? content.slice(0, -jsonMeta.length)
			: content;

		// Build backlink to parent section's codex (goBackLinkHelper only)
		const backlinkLine = goBackLinkHelper.build(
			makeCodexBasename(parentPathParts),
			parentName,
		);

		// Extract frontmatter if present
		const fmMatch = contentWithoutJsonMeta.match(
			/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)/,
		);
		const frontmatter = fmMatch?.[1] ?? "";
		const afterFrontmatter = fmMatch
			? contentWithoutJsonMeta.slice(frontmatter.length)
			: contentWithoutJsonMeta;

		// Strip existing go-back link (but not JSON metadata - that's already extracted)
		const cleanBody = goBackLinkHelper.strip(afterFrontmatter.trimStart());

		// Defensive: log if strip left a go-back link (regex mismatch, can cause duplicates)
		const firstNonEmptyLine = cleanBody
			.split("\n")
			.map((l) => l.trim())
			.find((l) => l.length > 0);
		if (firstNonEmptyLine && goBackLinkHelper.isMatch(firstNonEmptyLine)) {
			logger.warn(
				"[makeScrollBacklinkTransform] strip left a go-back link; regex may not match on-disk format",
				{ firstLine: firstNonEmptyLine.slice(0, 80) },
			);
		}

		// Format: [frontmatter]\n[[backlink]]  \n\n<body>\n[json-meta]
		const result = `${frontmatter}${LINE_BREAK}${backlinkLine}${SPACE_F}${LINE_BREAK}${LINE_BREAK}${cleanBody}${jsonMeta}`;
		return result;
	};
}
