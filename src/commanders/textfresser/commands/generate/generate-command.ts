import type { VaultAction } from "@textfresser/vault-action-manager";
import { VaultActionKind } from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import {
	resultAsyncToEffect,
	resultToEffect,
} from "../../orchestration/shared/effect-result";
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
export const generateCommand = Effect.fn("Textfresser.generateCommand")(
	function* (
		input: CommandInput,
	): Effect.fn.Return<VaultAction[], CommandError> {
		if (input.textfresserState.lexicalGenerationInitError) {
			return yield* Effect.fail(
				commandApiError({
					lexicalGenerationError:
						input.textfresserState.lexicalGenerationInitError,
					reason: input.textfresserState.lexicalGenerationInitError
						.message,
				}),
			);
		}

		const state: CommandState = { ...input, actions: [] };
		const resolved = yield* resultToEffect(
			checkAttestation(state)
				.andThen(checkEligibility)
				.andThen(checkLemmaResult)
				.andThen(resolveExistingEntry),
		);
		const generated = yield* resultAsyncToEffect(
			generateSections(resolved),
		);
		const propagated = yield* propagateGeneratedSections(generated);
		const serialized = yield* resultToEffect(serializeEntry(propagated));
		const moved = yield* resultToEffect(moveToWorter(serialized));
		const activeFile = moved.commandContext.activeFile;
		const writeAction = {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: activeFile.splitPath,
				transform: () => activeFile.content,
			},
		} as const;
		return [...moved.actions, writeAction];
	},
);
