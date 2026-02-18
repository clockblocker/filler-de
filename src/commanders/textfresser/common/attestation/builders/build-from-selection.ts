/**
 * Build Attestation from a text selection context.
 */

import type { SelectionInfo } from "../../../../../managers/obsidian/vault-action-manager";
import { logger } from "../../../../../utils/logger";
import type { Attestation } from "../types";
import { buildSourceFields } from "./build-source-fields";

/**
 * Build Attestation from a text selection.
 * Caller must ensure `selection.text` is non-null before calling.
 */
export function buildAttestationFromSelection(
	selection: SelectionInfo & { text: string },
): Attestation {
	const surface = selection.text;
	const blockContent = selection.surroundingRawBlock;
	const splitPath = selection.splitPathToFileWithSelection;

	const { ref, textWithOnlyTargetMarked } = buildSourceFields({
		basename: splitPath.basename,
		blockContent,
		surface,
	});

	logger.info(`[attestation] blockContent: "${blockContent}"`);
	logger.info(`[attestation] ref: "${ref}"`);

	return {
		source: {
			path: splitPath,
			ref,
			textRaw: blockContent,
			textWithOnlyTargetMarked,
		},
		target: {
			offsetInBlock: selection.selectionStartInBlock ?? undefined,
			surface,
		},
	};
}
