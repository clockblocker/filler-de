import type { CommandContext } from "../../../../managers/obsidian/command-executor";
import type { VaultActionManager } from "../../../../managers/obsidian/vault-action-manager";
import { errAsync, ResultAsync } from "neverthrow";
import { logger } from "../../../../utils/logger";
import type { CommandError, CommandInput } from "../../commands/types";
import { CommandErrorKind } from "../../errors";
import { buildPolicyDestinationPath } from "../../common/lemma-link-routing";
import type { TextfresserState } from "../../state/textfresser-state";
import {
	buildLemmaInvocationKey,
	getValidLemmaInvocationCache,
	handleLemmaCacheHit,
} from "./lemma-cache";
import { runLemmaTwoPhase } from "./run-lemma-two-phase";
import { resolveAttestation } from "../../commands/lemma/lemma-command";

export function executeLemmaFlow(params: {
	context: CommandContext & {
		activeFile: NonNullable<CommandContext["activeFile"]>;
	};
	state: TextfresserState;
	vam: VaultActionManager;
	notify: (message: string) => void;
	requestBackgroundGenerate: (notify: (message: string) => void) => void;
}): ResultAsync<void, CommandError> {
	const { context, notify, requestBackgroundGenerate, state, vam } = params;
	const input: CommandInput = {
		commandContext: context,
		resultingActions: [],
		textfresserState: state,
	};

	const attestation = resolveAttestation(input);
	if (!attestation) {
		return errAsync({
			kind: CommandErrorKind.NotEligible,
			reason: "No attestation context available — select a word or click a wikilink first",
		});
	}

	const invocationKey = buildLemmaInvocationKey(attestation);
	const cachedInvocation = getValidLemmaInvocationCache(state, invocationKey);

	if (cachedInvocation) {
		return new ResultAsync(
			handleLemmaCacheHit({
				cache: cachedInvocation,
				onRefetch: () => requestBackgroundGenerate(() => {}),
				readContent: (splitPath) => vam.readContent(splitPath),
				state,
			}),
		).mapErr((error) => {
			const reason =
				"reason" in error ? error.reason : `Command failed: ${error.kind}`;
			notify(`⚠ ${reason}`);
			logger.warn("[Textfresser.Lemma] Failed:", error);
			return error;
		});
	}

	return new ResultAsync(
		runLemmaTwoPhase({
			input,
			preResolvedAttestation: attestation,
			state,
			vam,
		}),
	)
		.map(() => {
			const lemma = state.latestLemmaResult;
			if (!lemma) {
				return;
			}

			state.latestLemmaInvocationCache = {
				cachedAtMs: Date.now(),
				key: invocationKey,
				lemmaResult: lemma,
				resolvedTargetPath:
					state.latestResolvedLemmaTargetPath ??
					buildPolicyDestinationPath({
						lemma: lemma.lemma,
						linguisticUnit: lemma.linguisticUnit,
						posLikeKind:
							lemma.linguisticUnit === "Lexem"
								? lemma.posLikeKind
								: null,
						surfaceKind: lemma.surfaceKind,
						targetLanguage: state.languages.target,
					}),
			};

			const pos = lemma.linguisticUnit === "Lexem" ? ` (${lemma.posLikeKind})` : "";
			notify(`✓ ${lemma.lemma}${pos}`);
			requestBackgroundGenerate(notify);
		})
		.mapErr((error) => {
			const reason =
				"reason" in error ? error.reason : `Command failed: ${error.kind}`;
			notify(`⚠ ${reason}`);
			logger.warn("[Textfresser.Lemma] Failed:", error);
			return error;
		});
}
