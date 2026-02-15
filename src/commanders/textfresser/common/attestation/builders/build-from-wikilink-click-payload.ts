/**
 * Build Attestation from wikilink click data.
 */

import { ok, type Result } from "neverthrow";
import type { WikilinkClickPayload } from "../../../../../managers/obsidian/user-event-interceptor/events";
import { blockIdHelper } from "../../../../../stateless-helpers/block-id";
import { markdownHelper } from "../../../../../stateless-helpers/markdown-strip";
import type { AttestationParsingError } from "../../../errors";
import type { Attestation } from "../types";

/**
 * Build Attestation from input data.
 * @param input - The wikilink click input data. Wikilinks are formatted either as [[surface]] or [[lemma|surface]]
 * @returns Result with Attestation or AttestationError
 */
export function buildAttestationFromWikilinkClickPayload(
	input: WikilinkClickPayload,
): Result<Attestation, AttestationParsingError> {
	const { blockContent, splitPath, wikiTarget } = input;

	// Extract block ID if present
	const blockId = blockIdHelper.extractFromLine(blockContent);

	// ref: embed if block ID exists, else raw content
	const ref = blockId
		? blockIdHelper.formatEmbed(splitPath.basename, blockId)
		: blockContent;

	// surface = alias if exists, else basename (what user clicked)
	const surface = wikiTarget.alias ?? wikiTarget.basename;

	// Strip markdown and mark only the target surface with [brackets]
	const stripped = markdownHelper.stripAll(blockContent);
	const textWithOnlyTargetMarked = stripped.replace(surface, `[${surface}]`);

	return ok({
		source: {
			path: splitPath,
			ref,
			textRaw: blockContent,
			textWithOnlyTargetMarked,
		},
		target: {
			// lemma is the basename when alias exists (i.e., wikilink was [[lemma|surface]])
			lemma: wikiTarget.alias ? wikiTarget.basename : undefined,
			surface,
		},
	});
}
