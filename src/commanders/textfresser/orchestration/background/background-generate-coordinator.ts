import type { ResultAsync } from "neverthrow";
import type {
	VaultAction,
	VaultActionManager,
} from "../../../../managers/obsidian/vault-action-manager";
import { VaultActionKind } from "../../../../managers/obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import {
	decrementPending,
	incrementPending,
} from "../../../../utils/idle-tracker";
import { logger } from "../../../../utils/logger";
import type { CommandError, CommandInput } from "../../commands/types";
import { buildPolicyDestinationPath } from "../../common/lemma-link-routing";
import type {
	InFlightGenerate,
	PendingGenerate,
	TextfresserState,
} from "../../state/textfresser-state";
import {
	areSameSplitPath,
	stringifySplitPath,
} from "../shared/split-path-utils";

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
			notify,
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
			request.notify,
		)
			.catch((error) => {
				const reason =
					error instanceof Error ? error.message : String(error);
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
					!areSameSplitPath(pending.targetPath, request.targetPath)
				) {
					launchBackgroundGenerate(pending);
				}
			});

		state.inFlightGenerate = {
			lemma: request.lemma,
			promise,
			targetPath: request.targetPath,
		};
	}

	async function runBackgroundGenerate(
		targetPath: SplitPathToMdFile,
		lemma: string,
		notify: (message: string) => void,
	): Promise<void> {
		const targetExistedBefore = vam.exists(targetPath);
		const contentResult = await vam.readContent(targetPath);
		const content = contentResult.isOk() ? contentResult.value : "";

		const input: CommandInput = {
			commandContext: {
				activeFile: { content, splitPath: targetPath },
				selection: null,
			},
			resultingActions: [],
			textfresserState: state,
		};

		const generateResult = await runGenerateCommand(input);
		if (generateResult.isErr()) {
			const error = generateResult.error;
			const reason =
				"reason" in error
					? error.reason
					: `Command failed: ${error.kind}`;
			throw new Error(reason);
		}

		const upsertAction: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { splitPath: targetPath },
		};
		const allActions = [upsertAction, ...generateResult.value];

		const dispatchResult = await vam.dispatch(allActions);
		if (dispatchResult.isErr()) {
			const reason = dispatchResult.error.map((e) => e.error).join(", ");
			throw new Error(reason);
		}

		const finalContentResult = await vam.readContent(targetPath);
		if (finalContentResult.isErr()) {
			throw new Error(
				"Background generate finished but target note could not be read",
			);
		}
		if (finalContentResult.value.trim().length === 0) {
			if (!targetExistedBefore) {
				const rollbackResult = await vam.dispatch([
					{
						kind: VaultActionKind.TrashMdFile,
						payload: { splitPath: targetPath },
					},
				]);
				if (rollbackResult.isErr()) {
					logger.warn(
						"[Textfresser.backgroundGenerate] Failed to rollback empty generated note",
						{
							error: rollbackResult.error,
							targetPath,
						},
					);
				}
			}

			throw new Error(
				`Background generate produced empty target note: ${stringifySplitPath(targetPath)}`,
			);
		}

		const cache = state.latestLemmaInvocationCache;
		const generatedEntryId = state.targetBlockId;
		if (
			cache &&
			generatedEntryId &&
			areSameSplitPath(cache.resolvedTargetPath, targetPath)
		) {
			state.latestLemmaInvocationCache = {
				...cache,
				generatedEntryId,
			};
		}

		const failed = state.latestFailedSections;
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
			!areSameSplitPath(currentFile, inFlight.targetPath)
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
