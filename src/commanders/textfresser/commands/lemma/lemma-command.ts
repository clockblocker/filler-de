import { errAsync, ok, ResultAsync } from "neverthrow";
import type { VaultAction } from "../../../../managers/obsidian/vault-action-manager";
import { PromptKind } from "../../../../prompt-smith/codegen/consts";
import {
	type CommandError,
	CommandErrorKind,
	type CommandInput,
} from "../types";

/** Lemma command: classify a word and store result in state (recon only, no vault actions). */
export function lemmaCommand(
	input: CommandInput,
): ResultAsync<VaultAction[], CommandError> {
	const { textfresserState } = input;
	const attestation = textfresserState.attestationForLatestNavigated;

	if (!attestation) {
		return errAsync({
			kind: CommandErrorKind.NotEligible,
			reason: "No attestation context available",
		});
	}

	const surface = attestation.target.surface;
	const context = attestation.source.textWithOnlyTargetMarked;

	return ResultAsync.fromPromise(
		textfresserState.promptRunner.generate(PromptKind.Lemma, {
			context,
			surface,
		}),
		(e): CommandError => ({
			kind: CommandErrorKind.ApiError,
			reason: e instanceof Error ? e.message : String(e),
		}),
	).andThen((apiResult) => {
		textfresserState.latestLemmaResult = {
			...apiResult,
			attestation,
		};
		return ok([] as VaultAction[]);
	});
}
