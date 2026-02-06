/**
 * Build Attestation from a text selection context.
 */

import type { SelectionInfo } from "../../../../../managers/obsidian/vault-action-manager";
import { blockIdHelper } from "../../../../../stateless-helpers/block-id";
import { markdownHelper } from "../../../../../stateless-helpers/markdown-strip";
import type { Attestation } from "../types";

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

	const blockId = blockIdHelper.extractFromLine(blockContent);
	const ref = blockId
		? blockIdHelper.formatEmbed(splitPath.basename, blockId)
		: blockContent;

	const stripped = markdownHelper.stripAll(blockContent);
	const textWithOnlyTargetMarked = stripped.replace(surface, `[${surface}]`);

	return {
		source: {
			path: splitPath,
			ref,
			textRaw: blockContent,
			textWithOnlyTargetMarked,
		},
		target: {
			surface,
		},
	};
}
