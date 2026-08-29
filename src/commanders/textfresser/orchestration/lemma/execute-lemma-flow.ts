import type { VaultActionManager } from "@textfresser/vault-action-manager";
import { Clock, Effect } from "effect";
import type { CommandContext } from "../../../../managers/obsidian/command-executor";
import { logger } from "../../../../utils/logger";
import { resolveAttestation } from "../../commands/lemma/lemma-command";
import type { CommandError, CommandInput } from "../../commands/types";
import { buildPolicyDestinationPath } from "../../common/lemma-link-routing";
import { CommandErrorKind, commandApiError } from "../../errors";
import type { TextfresserState } from "../../state/textfresser-state";
import {
	buildLemmaInvocationKey,
	getValidLemmaInvocationCache,
	handleLemmaCacheHit,
} from "./lemma-cache";
import { runLemmaTwoPhase } from "./run-lemma-two-phase";

type ExecuteLemmaFlowParams = {
	context: CommandContext & {
		activeFile: NonNullable<CommandContext["activeFile"]>;
	};
	state: TextfresserState;
	vam: VaultActionManager;
	notify: (message: string) => void;
	requestBackgroundGenerate: (notify: (message: string) => void) => void;
};

const executeLemmaFlowProgram = Effect.fn("Textfresser.executeLemmaFlow")(
	function* (
		params: ExecuteLemmaFlowParams,
	): Effect.fn.Return<void, CommandError> {
		const { context, notify, requestBackgroundGenerate, state, vam } =
			params;
		if (state.lexicalGenerationInitError) {
			return yield* Effect.fail(
				commandApiError({
					lexicalGenerationError: state.lexicalGenerationInitError,
					reason: state.lexicalGenerationInitError.message,
				}),
			);
		}

		const input: CommandInput = {
			commandContext: context,
			resultingActions: [],
			textfresserState: state,
		};

		const attestation = resolveAttestation(input);
		if (!attestation) {
			return yield* Effect.fail({
				kind: CommandErrorKind.NotEligible,
				reason: "No attestation context available — select a word or click a wikilink first",
			});
		}

		const invocationKey = buildLemmaInvocationKey(attestation);
		const nowMs = yield* Clock.currentTimeMillis;
		const cachedInvocation = getValidLemmaInvocationCache(
			state,
			invocationKey,
			nowMs,
		);

		if (cachedInvocation) {
			yield* handleLemmaCacheHit({
				cache: cachedInvocation,
				onRefetch: () => requestBackgroundGenerate(() => {}),
				readContent: (splitPath) => vam.readContent(splitPath),
				state,
			});
			return;
		}

		yield* runLemmaTwoPhase({
			input,
			preResolvedAttestation: attestation,
			state,
			vam,
		});
		const lemma = state.latestLemmaResult;
		if (!lemma) return;
		const cachedAtMs = yield* Clock.currentTimeMillis;

		state.latestLemmaInvocationCache = {
			cachedAtMs,
			key: invocationKey,
			lemmaResult: lemma,
			resolvedTargetPath:
				state.latestResolvedLemmaTargetPath ??
				buildPolicyDestinationPath({
					lemma: lemma.lemma,
					linguisticUnit: lemma.linguisticUnit,
					posLikeKind:
						lemma.linguisticUnit === "Lexeme"
							? lemma.posLikeKind
							: null,
					surfaceKind: lemma.surfaceKind,
					targetLanguage: state.languages.target,
				}),
		};

		const pos =
			lemma.linguisticUnit === "Lexeme" ? ` (${lemma.posLikeKind})` : "";
		notify(`✓ ${lemma.lemma}${pos}`);
		requestBackgroundGenerate(notify);
	},
);

export function executeLemmaFlow(
	params: ExecuteLemmaFlowParams,
): Effect.Effect<void, CommandError> {
	return executeLemmaFlowProgram(params).pipe(
		Effect.tapError((error) =>
			Effect.sync(() => {
				const reason =
					"reason" in error
						? error.reason
						: `Command failed: ${error.kind}`;
				params.notify(`⚠ ${reason}`);
				logger.warn("[Textfresser.Lemma] Failed:", error);
			}),
		),
	);
}
