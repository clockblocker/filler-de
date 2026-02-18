import { blockIdHelper } from "../../../../../stateless-helpers/block-id";
import { markdownHelper } from "../../../../../stateless-helpers/markdown-strip";

/**
 * Compute the shared attestation source fields from raw block content.
 *
 * Extracts the ref (embed or raw text) and textWithOnlyTargetMarked
 * (stripped markdown with only the target surface wrapped in brackets).
 */
export function buildSourceFields(params: {
	blockContent: string;
	basename: string;
	surface: string;
}): { ref: string; textWithOnlyTargetMarked: string } {
	const blockId = blockIdHelper.extractFromLine(params.blockContent);
	const ref = blockId
		? blockIdHelper.formatEmbed(params.basename, blockId)
		: params.blockContent;

	const stripped = markdownHelper.stripAll(params.blockContent);
	const textWithOnlyTargetMarked = stripped.replace(
		params.surface,
		`[${params.surface}]`,
	);

	return { ref, textWithOnlyTargetMarked };
}
