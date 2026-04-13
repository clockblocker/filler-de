import type { VaultAction } from "@textfresser/vault-action-manager";
import { VaultActionKind } from "@textfresser/vault-action-manager";
import { errAsync, ok, ResultAsync } from "neverthrow";

import type { CommandError, CommandInput, CommandState } from "../types";
import { commandApiError } from "../types";
import { checkAttestation } from "./steps/check-attestation";
import { checkEligibility } from "./steps/check-eligibility";
import { checkLemmaResult } from "./steps/check-lemma-result";
import { generateSections } from "./steps/generate-sections";
import { moveToWorter } from "./steps/move-to-worter";
import { propagateGeneratedSections } from "./steps/propagate-generated-sections";
import { resolveExistingEntry } from "./steps/resolve-existing-entry";
import { serializeEntry } from "./steps/serialize-entry";

/**
 * Pipeline:
 * checkAttestation → checkEligibility → checkLemmaResult
 * → resolveExistingEntry (parse existing entries)
 * → generateSections (async: LLM calls or append attestation)
 * → propagateGeneratedSections (core propagation + post-propagation decoration)
 * → serializeEntry (includes noteKind meta) → moveToWorter(policy destination)
 * → addWriteAction
 */
export function generateCommand(
	input: CommandInput,
): ResultAsync<VaultAction[], CommandError> {
	if (input.textfresserState.lexicalGenerationInitError) {
		return errAsync(
			commandApiError({
				lexicalGenerationError:
					input.textfresserState.lexicalGenerationInitError,
				reason: input.textfresserState.lexicalGenerationInitError
					.message,
			}),
		);
	}

	const state: CommandState = { ...input, actions: [] };

	return new ResultAsync(
		Promise.resolve(
			checkAttestation(state)
				.andThen(checkEligibility)
				.andThen(checkLemmaResult)
				.andThen(resolveExistingEntry),
		),
	)
		.andThen(generateSections)
		.andThen(propagateGeneratedSections)
		.andThen(serializeEntry)
		.andThen(moveToWorter)
		.andThen((c) => {
			const activeFile = c.commandContext.activeFile;
			const writeAction = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: activeFile.splitPath,
					transform: () => activeFile.content,
				},
			} as const;
			return ok([...c.actions, writeAction]);
		});
}
