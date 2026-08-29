import type {
	SplitPathToMdFile,
	VaultAction,
} from "@textfresser/vault-action-manager";
import { VaultActionKind } from "@textfresser/vault-action-manager";
import type { VaultActionManager } from "@textfresser/vault-action-manager/facade";
import { Effect, Option, Result } from "effect";
import {
	splitPathsEqual,
	stringifySplitPath,
} from "../../../../stateless-helpers/split-path-comparison";
import { getErrorMessage } from "../../../../utils/get-error-message";
import {
	decrementPending,
	incrementPending,
} from "../../../../utils/idle-tracker";
import { logger } from "../../../../utils/logger";
import { sleep } from "../../../../utils/sleep";
import type { LemmaResult } from "../../commands/lemma/types";
import type { CommandError, CommandInput } from "../../commands/types";
import { buildPolicyDestinationPath } from "../../common/lemma-link-routing";
import type {
	InFlightGenerate,
	PendingGenerate,
	TextfresserState,
} from "../../state/textfresser-state";
import {
	describeVamFailure,
	vamDispatchFailureToCommandError,
} from "../shared/vam-failure";

type GenerateCommandFn = (
	input: CommandInput,
) => Effect.Effect<VaultAction[], CommandError>;

export type BackgroundGenerateCoordinator = {
	requestBackgroundGenerate: (notify: (message: string) => void) => void;
	awaitGenerateAndScroll: (inFlight: InFlightGenerate) => Effect.Effect<void>;
};

export function createBackgroundGenerateCoordinator(params: {
	state: TextfresserState;
	vam: VaultActionManager;
	runGenerateCommand: GenerateCommandFn;
	scrollToTargetBlock: () => Effect.Effect<void>;
}): BackgroundGenerateCoordinator {
	const { runGenerateCommand, scrollToTargetBlock, state, vam } = params;

	function requestBackgroundGenerate(
		notify: (message: string) => void,
	): void {
		const lemmaResult = state.latestLemmaResult;
		if (!lemmaResult) return;

		const targetPath =
			state.latestResolvedLemmaTargetPath ??
			buildPolicyDestinationPath({
				lemma: lemmaResult.lemma,
				linguisticUnit: lemmaResult.linguisticUnit,
				posLikeKind:
					lemmaResult.linguisticUnit === "Lexeme"
						? lemmaResult.posLikeKind
						: null,
				surfaceKind: lemmaResult.surfaceKind,
				targetLanguage: state.languages.target,
			});
		const request: PendingGenerate = {
			lemma: lemmaResult.lemma,
			lemmaResult,
			notify,
			targetOwnedByInvocation: state.latestLemmaTargetOwnedByInvocation,
			targetPath,
		};

		if (state.inFlightGenerate) {
			state.pendingGenerate = request;
			return;
		}

		launchBackgroundGenerate(request);
	}

	function launchBackgroundGenerate(request: PendingGenerate): void {
		incrementPending();
		const promise = Effect.runPromise(
			runBackgroundGenerate(
				request.targetPath,
				request.lemma,
				request.lemmaResult,
				request.targetOwnedByInvocation,
				request.notify,
			),
		)
			.catch((error) => {
				const reason = getErrorMessage(error);
				logger.warn("[Textfresser.backgroundGenerate] Failed:", reason);
				request.notify(`⚠ Background generate failed: ${reason}`);
			})
			.finally(() => {
				decrementPending();
				state.inFlightGenerate = null;

				const pending = state.pendingGenerate;
				state.pendingGenerate = null;
				if (
					pending &&
					!splitPathsEqual(pending.targetPath, request.targetPath)
				) {
					launchBackgroundGenerate(pending);
				}
			});

		state.inFlightGenerate = {
			lemma: request.lemma,
			promise,
			targetOwnedByInvocation: request.targetOwnedByInvocation,
			targetPath: request.targetPath,
		};
	}

	const runBackgroundGenerate = Effect.fn(
		"Textfresser.runBackgroundGenerate",
	)(function* (
		targetPath: SplitPathToMdFile,
		lemma: string,
		lemmaResult: LemmaResult,
		targetOwnedByInvocation: boolean,
		notify: (message: string) => void,
	): Effect.fn.Return<void, Error> {
		const targetExistedBefore = yield* vam
			.exists(targetPath)
			.pipe(
				Effect.mapError(
					(error) => new Error(describeVamFailure(error)),
				),
			);

		function readTargetContent() {
			// Single retry layer lives in VaultReader/TFileHelper.
			return vam.readContent(targetPath);
		}

		const cleanupIfEmpty = Effect.fn(
			"Textfresser.cleanupEmptyBackgroundTarget",
		)(function* (): Effect.fn.Return<string> {
			const shouldCleanup =
				targetOwnedByInvocation || !targetExistedBefore;
			if (!shouldCleanup) return "skipped";

			const currentContent = yield* readTargetContent().pipe(
				Effect.option,
			);
			if (Option.isNone(currentContent)) return "gone";
			if (currentContent.value.trim().length > 0) return "has-content";

			const rollbackActions: VaultAction[] = [
				{
					kind: VaultActionKind.TrashMdFile,
					payload: { splitPath: targetPath },
				},
			];
			const rollbackResult = yield* vam
				.dispatch(rollbackActions)
				.pipe(Effect.result);
			if (Result.isFailure(rollbackResult)) {
				const rollbackError = vamDispatchFailureToCommandError(
					rollbackResult.failure,
					rollbackActions,
				);
				logger.warn(
					"[Textfresser.backgroundGenerate] Failed to rollback empty generated note",
					{ error: rollbackResult.failure, targetPath },
				);
				const rollbackReason =
					"reason" in rollbackError
						? rollbackError.reason
						: `Command failed: ${rollbackError.kind}`;
				return `failed (${rollbackReason})`;
			}
			return "deleted";
		});

		const contentResult = yield* readTargetContent().pipe(Effect.option);
		const content = Option.getOrElse(contentResult, () => "");

		const stateSnapshot: TextfresserState = {
			...state,
			latestLemmaResult: lemmaResult,
		};
		const input: CommandInput = {
			commandContext: {
				activeFile: { content, splitPath: targetPath },
				selection: null,
			},
			resultingActions: [],
			textfresserState: stateSnapshot,
		};

		const generateResult = yield* runGenerateCommand(input).pipe(
			Effect.result,
		);
		if (Result.isFailure(generateResult)) {
			const cleanupSummary = yield* cleanupIfEmpty();
			const error = generateResult.failure;
			const reason =
				"reason" in error
					? error.reason
					: `Command failed: ${error.kind}`;
			return yield* Effect.fail(
				new Error(
					`${reason} (cleanup=${cleanupSummary}, owned=${targetOwnedByInvocation}, existedBefore=${targetExistedBefore})`,
				),
			);
		}

		const upsertAction: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { splitPath: targetPath },
		};
		const allActions = [upsertAction, ...generateResult.success];

		const dispatchResult = yield* vam
			.dispatch(allActions)
			.pipe(Effect.result);
		if (Result.isFailure(dispatchResult)) {
			const cleanupSummary = yield* cleanupIfEmpty();
			const dispatchError = vamDispatchFailureToCommandError(
				dispatchResult.failure,
				allActions,
			);
			const dispatchReason =
				"reason" in dispatchError
					? dispatchError.reason
					: `Command failed: ${dispatchError.kind}`;
			return yield* Effect.fail(
				new Error(
					`${dispatchReason} (cleanup=${cleanupSummary}, owned=${targetOwnedByInvocation}, existedBefore=${targetExistedBefore})`,
				),
			);
		}

		const finalContentResult = yield* readTargetContent().pipe(
			Effect.mapError(
				() =>
					new Error(
						"Background generate finished but target note could not be read",
					),
			),
		);
		if (finalContentResult.trim().length === 0) {
			const cleanupSummary = yield* cleanupIfEmpty();
			return yield* Effect.fail(
				new Error(
					`Background generate produced empty target note: ${stringifySplitPath(targetPath)} (cleanup=${cleanupSummary}, owned=${targetOwnedByInvocation}, existedBefore=${targetExistedBefore})`,
				),
			);
		}

		// Propagate output side-effects from snapshot back to live state
		state.targetBlockId = stateSnapshot.targetBlockId;
		state.latestFailedSections = stateSnapshot.latestFailedSections;

		const cache = state.latestLemmaInvocationCache;
		const generatedEntryId = stateSnapshot.targetBlockId;
		if (
			cache &&
			generatedEntryId &&
			splitPathsEqual(cache.resolvedTargetPath, targetPath)
		) {
			state.latestLemmaInvocationCache = {
				...cache,
				generatedEntryId,
			};
		}

		const failed = stateSnapshot.latestFailedSections;
		if (failed.length > 0) {
			notify(
				`⚠ Entry created for ${lemma} (failed: ${failed.join(", ")})`,
			);
		} else {
			notify(`✓ Entry created for ${lemma}`);
		}
	});

	const awaitGenerateAndScroll = Effect.fn(
		"Textfresser.awaitGenerateAndScroll",
	)(function* (inFlight: InFlightGenerate) {
		const completed = yield* Effect.promise(() => inFlight.promise).pipe(
			Effect.as(true),
			Effect.catch(() => Effect.succeed(false)),
		);
		if (!completed) return;

		yield* Effect.promise(() => sleep(300));

		const currentFile = yield* vam.mdPwd().pipe(Effect.option);
		if (
			Option.isNone(currentFile) ||
			!currentFile.value ||
			!splitPathsEqual(currentFile.value, inFlight.targetPath)
		) {
			return;
		}

		yield* scrollToTargetBlock();
	});

	return {
		awaitGenerateAndScroll,
		requestBackgroundGenerate,
	};
}
