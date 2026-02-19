import type { ResultAsync } from "neverthrow";
import type {
	VaultAction,
	VaultActionManager,
} from "../../../../managers/obsidian/vault-action-manager";
import { VaultActionKind } from "../../../../managers/obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
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
import type { LemmaResult } from "../../commands/lemma/types";
import type { CommandError, CommandInput } from "../../commands/types";
import { buildPolicyDestinationPath } from "../../common/lemma-link-routing";
import type {
	InFlightGenerate,
	PendingGenerate,
	TextfresserState,
} from "../../state/textfresser-state";

type GenerateCommandFn = (
	input: CommandInput,
) => ResultAsync<VaultAction[], CommandError>;

export type BackgroundGenerateCoordinator = {
	requestBackgroundGenerate: (notify: (message: string) => void) => void;
	awaitGenerateAndScroll: (inFlight: InFlightGenerate) => Promise<void>;
};

export function createBackgroundGenerateCoordinator(params: {
	state: TextfresserState;
	vam: VaultActionManager;
	runGenerateCommand: GenerateCommandFn;
	scrollToTargetBlock: () => void;
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
					lemmaResult.linguisticUnit === "Lexem"
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
		const promise = runBackgroundGenerate(
			request.targetPath,
			request.lemma,
			request.lemmaResult,
			request.targetOwnedByInvocation,
			request.notify,
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

	async function runBackgroundGenerate(
		targetPath: SplitPathToMdFile,
		lemma: string,
		lemmaResult: LemmaResult,
		targetOwnedByInvocation: boolean,
		notify: (message: string) => void,
	): Promise<void> {
		const targetExistedBefore = vam.exists(targetPath);

		async function cleanupIfEmpty(): Promise<string> {
			const shouldCleanup =
				targetOwnedByInvocation || !targetExistedBefore;
			if (!shouldCleanup) return "skipped";

			const currentContent = await vam.readContent(targetPath);
			if (currentContent.isErr()) return "gone";
			if (currentContent.value.trim().length > 0) return "has-content";

			const rollbackResult = await vam.dispatch([
				{
					kind: VaultActionKind.TrashMdFile,
					payload: { splitPath: targetPath },
				},
			]);
			if (rollbackResult.isErr()) {
				const rollbackReason = rollbackResult.error
					.map((e) => e.error)
					.join(", ");
				logger.warn(
					"[Textfresser.backgroundGenerate] Failed to rollback empty generated note",
					{ error: rollbackResult.error, targetPath },
				);
				return `failed (${rollbackReason})`;
			}
			return "deleted";
		}

		const contentResult = await vam.readContent(targetPath);
		const content = contentResult.isOk() ? contentResult.value : "";

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

		const generateResult = await runGenerateCommand(input);
		if (generateResult.isErr()) {
			const cleanupSummary = await cleanupIfEmpty();
			const error = generateResult.error;
			const reason =
				"reason" in error
					? error.reason
					: `Command failed: ${error.kind}`;
			throw new Error(
				`${reason} (cleanup=${cleanupSummary}, owned=${targetOwnedByInvocation}, existedBefore=${targetExistedBefore})`,
			);
		}

		const upsertAction: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { splitPath: targetPath },
		};
		const allActions = [upsertAction, ...generateResult.value];

		const dispatchResult = await vam.dispatch(allActions);
		if (dispatchResult.isErr()) {
			const cleanupSummary = await cleanupIfEmpty();
			const reason = dispatchResult.error.map((e) => e.error).join(", ");
			throw new Error(
				`${reason} (cleanup=${cleanupSummary}, owned=${targetOwnedByInvocation}, existedBefore=${targetExistedBefore})`,
			);
		}

		const finalContentResult = await vam.readContent(targetPath);
		if (finalContentResult.isErr()) {
			throw new Error(
				"Background generate finished but target note could not be read",
			);
		}
		if (finalContentResult.value.trim().length === 0) {
			const cleanupSummary = await cleanupIfEmpty();
			throw new Error(
				`Background generate produced empty target note: ${stringifySplitPath(targetPath)} (cleanup=${cleanupSummary}, owned=${targetOwnedByInvocation}, existedBefore=${targetExistedBefore})`,
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
	}

	async function awaitGenerateAndScroll(
		inFlight: InFlightGenerate,
	): Promise<void> {
		try {
			await inFlight.promise;
		} catch {
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, 300));

		const currentFile = vam.mdPwd();
		if (
			!currentFile ||
			!splitPathsEqual(currentFile, inFlight.targetPath)
		) {
			return;
		}

		scrollToTargetBlock();
	}

	return {
		awaitGenerateAndScroll,
		requestBackgroundGenerate,
	};
}
