import { PromptKind } from "@textfresser/lexical-generation";
import {
	type VaultAction,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { blockIdHelper } from "../../../../stateless-helpers/block-id";
import { markdownHelper } from "../../../../stateless-helpers/markdown-strip";
import { resultAsyncToEffect } from "../../orchestration/shared/effect-result";
import {
	type CommandError,
	CommandErrorKind,
	type CommandInput,
} from "../types";

export const translateCommand = Effect.fn("Textfresser.translateCommand")(
	function* (
		input: CommandInput,
	): Effect.fn.Return<VaultAction[], CommandError> {
		const { selection } = input.commandContext;
		const { promptRunner } = input.textfresserState;

		// Get input: selection or fallback to surrounding block
		const rawInput = selection?.text ?? selection?.surroundingRawBlock;
		if (!rawInput) {
			return yield* Effect.fail({ kind: CommandErrorKind.NoSelection });
		}

		// Check for blockId, strip for API call
		const blockIdMatch = blockIdHelper.matchesPattern(rawInput);
		const withoutBlockId = blockIdHelper.stripFromEnd(rawInput);
		// Strip wikilinks to surface text before API call
		const apiInput = markdownHelper.replaceWikilinks(withoutBlockId);

		const translation = yield* resultAsyncToEffect(
			promptRunner.generate(PromptKind.Translate, apiInput).mapErr(
				(e): CommandError => ({
					kind: CommandErrorKind.ApiError,
					reason: e.reason,
				}),
			),
		);
		// Build replacement: keep blockId with original text
		const separator = blockIdMatch ? "\n\n" : "\n";
		const replacement = `${rawInput}${separator}${translation}`;

		return [
			{
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					after: replacement,
					before: rawInput,
					splitPath: input.commandContext.activeFile.splitPath,
				},
			},
		];
	},
);
