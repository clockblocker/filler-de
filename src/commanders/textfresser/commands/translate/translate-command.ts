/**
 * Translate: writes the translation of the selection, or of the caret's
 * block without one, under it in the reading note. dumgen's
 * `translate.sentence` writes it on the plugin's one dumgen instance, with
 * the Sentences around the selection as context. A failure, a missing
 * OpenAI key included, becomes a command error the orchestrator shows as a
 * notice.
 */
import {
	type VaultAction,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import type { TranslateSentenceInput } from "dumgen";
import { Effect } from "effect";
import { blockIdHelper } from "../../../../stateless-helpers/block-id";
import { markdownHelper } from "../../../../stateless-helpers/markdown-strip";
import type { KnownLanguage } from "../../../../types";
import { getErrorMessage } from "../../../../utils/get-error-message";
import {
	type CommandError,
	CommandErrorKind,
	type CommandInput,
	commandApiError,
} from "../types";
import { neighbourSentences } from "./neighbour-sentences";

/** The Dumrel translation language for the reader's known language. */
const TRANSLATION_LANGUAGE_FOR_KNOWN = {
	English: "en",
	Russian: "ru",
} as const satisfies Record<KnownLanguage, TranslateSentenceInput["into"]>;

const translationFailed = (message: string): CommandError =>
	commandApiError({ reason: `Translation failed: ${message}` });

export const translateCommand = Effect.fn("Textfresser.translateCommand")(
	function* (
		input: CommandInput,
	): Effect.fn.Return<VaultAction[], CommandError> {
		const { activeFile, selection } = input.commandContext;
		const { getDumgen, languages } = input.textfresserState;

		// Get input: selection or fallback to surrounding block
		const rawInput = selection?.text ?? selection?.surroundingRawBlock;
		if (!selection || !rawInput) {
			return yield* Effect.fail({ kind: CommandErrorKind.NoSelection });
		}

		// Check for blockId, strip it and wikilinks from what is translated
		const blockIdMatch = blockIdHelper.matchesPattern(rawInput);
		const sentence = markdownHelper
			.replaceWikilinks(blockIdHelper.stripFromEnd(rawInput))
			.trim();
		if (!sentence) {
			return yield* Effect.fail({ kind: CommandErrorKind.NoSelection });
		}
		if (languages.target !== "German") {
			return yield* Effect.fail({
				kind: CommandErrorKind.NotEligible,
				reason: "Translate reads German texts only",
			});
		}

		const neighbours = neighbourSentences({
			block: selection.surroundingRawBlock,
			content: activeFile.content,
			selection: selection.text,
			selectionStartInBlock: selection.selectionStartInBlock,
		});
		const translation = yield* Effect.try({
			catch: (error) => translationFailed(getErrorMessage(error)),
			try: getDumgen,
		}).pipe(
			Effect.flatMap((instance) =>
				instance.translate
					.sentence({
						into: TRANSLATION_LANGUAGE_FOR_KNOWN[languages.known],
						language: "de",
						neighbours,
						sentence,
					})
					.pipe(
						Effect.mapError((failure) =>
							translationFailed(failure.message),
						),
					),
			),
			Effect.catchDefect((defect) =>
				Effect.fail(translationFailed(getErrorMessage(defect))),
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
					splitPath: activeFile.splitPath,
				},
			},
		];
	},
);
