import { errAsync, ok, type ResultAsync } from "neverthrow";
import {
	type VaultAction,
	VaultActionKind,
} from "../../../../managers/obsidian/vault-action-manager";
import { PromptKind } from "../../../../prompt-smith/codegen/consts";
import { blockIdHelper } from "../../../../stateless-helpers/block-id";
import { markdownHelper } from "../../../../stateless-helpers/markdown-strip";
import {
	type CommandError,
	CommandErrorKind,
	type CommandInput,
} from "../types";

export function translateCommand(
	input: CommandInput,
): ResultAsync<VaultAction[], CommandError> {
	const { selection } = input.commandContext;
	const { promptRunner } = input.textfresserState;

	// Get input: selection or fallback to surrounding block
	const rawInput = selection?.text ?? selection?.surroundingRawBlock;
	if (!rawInput) {
		return errAsync({ kind: CommandErrorKind.NoSelection });
	}

	// Check for blockId, strip for API call
	const blockIdMatch = blockIdHelper.matchesPattern(rawInput);
	const withoutBlockId = blockIdHelper.stripFromEnd(rawInput);
	// Strip wikilinks to surface text before API call
	const apiInput = markdownHelper.replaceWikilinks(withoutBlockId);

	return promptRunner
		.generate(PromptKind.Translate, apiInput)
		.mapErr(
			(e): CommandError => ({
				kind: CommandErrorKind.ApiError,
				reason: e.reason,
			}),
		)
		.andThen((translation) => {
			// Build replacement: keep blockId with original text
			const separator = blockIdMatch ? "\n\n" : "\n";
			const replacement = `${rawInput}${separator}${translation}`;

			return ok([
				{
					kind: VaultActionKind.ProcessMdFile,
					payload: {
						after: replacement,
						before: rawInput,
						splitPath: input.commandContext.activeFile.splitPath,
					},
				},
			]);
		});
}
