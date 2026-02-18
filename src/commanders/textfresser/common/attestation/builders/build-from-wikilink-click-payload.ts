/**
 * Build Attestation from wikilink click data.
 */

import { ok, type Result } from "neverthrow";
import type { WikilinkClickPayload } from "../../../../../managers/obsidian/user-event-interceptor/events";
import type { AttestationParsingError } from "../../../errors";
import type { Attestation } from "../types";
import { buildSourceFields } from "./build-source-fields";

/**
 * Build Attestation from input data.
 * @param input - The wikilink click input data. Wikilinks are formatted either as [[surface]] or [[lemma|surface]]
 * @returns Result with Attestation or AttestationError
 */
export function buildAttestationFromWikilinkClickPayload(
	input: WikilinkClickPayload,
): Result<Attestation, AttestationParsingError> {
	const { blockContent, splitPath, wikiTarget } = input;

	// surface = alias if exists, else basename (what user clicked)
	const surface = wikiTarget.alias ?? wikiTarget.basename;

	const { ref, textWithOnlyTargetMarked } = buildSourceFields({
		basename: splitPath.basename,
		blockContent,
		surface,
	});

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
