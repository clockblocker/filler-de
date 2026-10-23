import type { VaultActionManager } from "@textfresser/vault-action-manager";
import { logError } from "@textfresser/vault-action-manager/issue-handlers";
import { Effect } from "effect";
import { Notice } from "obsidian";
import { blockIdHelper } from "../../../stateless-helpers/block-id";
import { getErrorMessage } from "../../../utils/get-error-message";

/**
 * Tags the current line with a block marker (if missing) and copies the block embed to clipboard.
 * Does nothing silently on empty/blank lines.
 */
export const tagLineCopyEmbedBehavior = Effect.fn("tagLineCopyEmbedBehavior")(
	function* (vam: VaultActionManager) {
		const context = yield* vam.getActiveEditorContext();
		if (!context) {
			new Notice("No active markdown file");
			return;
		}

		const basename = context.splitPath.basename;
		const lineNumber = context.cursor.line;
		const lineText = context.currentLine;

		// Skip empty/blank lines silently
		if (!lineText.trim()) return;

		let blockId = blockIdHelper.extractNumeric(lineText);

		if (!blockId) {
			// Need to add block marker - find highest existing number
			const highestBlockNumber = blockIdHelper.findHighestNumber(
				context.content,
			);
			blockId = String(highestBlockNumber + 1);

			// Append block marker to end of line
			yield* vam.replaceActiveLine({
				after: `${lineText} ^${blockId}`,
				before: lineText,
				line: lineNumber,
				splitPath: context.splitPath,
			});
		}

		// Format and copy embed to clipboard
		const embed = blockIdHelper.formatEmbed(basename, blockId);
		yield* Effect.tryPromise(() => navigator.clipboard.writeText(embed));
	},
	Effect.catch((error) =>
		Effect.sync(() =>
			logError({
				description: `Error tagging line with block embed: ${getErrorMessage(error)}`,
				location: "tagLineCopyEmbedBehavior",
			}),
		),
	),
);
