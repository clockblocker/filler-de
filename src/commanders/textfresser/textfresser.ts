/**
 * Textfresser commander - thin orchestrator for vocabulary commands.
 */

import { errAsync } from "neverthrow";
import type { CommandContext } from "../../managers/obsidian/command-executor";
import type { WikilinkClickPayload } from "../../managers/obsidian/user-event-interceptor/events";
import type { EventHandler } from "../../managers/obsidian/user-event-interceptor/types/handler";
import type { VaultActionManager } from "../../managers/obsidian/vault-action-manager";
import type { ApiService } from "../../stateless-helpers/api-service";
import type { LanguagesConfig } from "../../types";
import { logger } from "../../utils/logger";
import { actionCommandFnForCommandKind } from "./commands";
import type { CommandInput, TextfresserCommandKind } from "./commands/types";
import type { PathLookupFn } from "./common/target-path-resolver";
import { CommandErrorKind } from "./errors";
import {
	type BackgroundGenerateCoordinator,
	createBackgroundGenerateCoordinator,
} from "./orchestration/background/background-generate-coordinator";
import { createWikilinkClickHandler } from "./orchestration/handlers/wikilink-click-handler";
import { executeLemmaFlow } from "./orchestration/lemma/execute-lemma-flow";
import { dispatchActions } from "./orchestration/shared/dispatch-actions";
import {
	createInitialTextfresserState,
	type TextfresserState,
} from "./state/textfresser-state";

export type {
	InFlightGenerate,
	LemmaInvocationCache,
	PendingGenerate,
	TextfresserState,
} from "./state/textfresser-state";

export class Textfresser {
	private state: TextfresserState;
	private backgroundGenerateCoordinator: BackgroundGenerateCoordinator;

	constructor(
		private readonly vam: VaultActionManager,
		languages: LanguagesConfig,
		apiService: ApiService,
	) {
		this.state = createInitialTextfresserState({
			apiService,
			languages,
			vam,
		});

		this.backgroundGenerateCoordinator =
			createBackgroundGenerateCoordinator({
				runGenerateCommand: actionCommandFnForCommandKind.Generate,
				scrollToTargetBlock: () => this.scrollToTargetBlock(),
				state: this.state,
				vam: this.vam,
			});
	}

	executeCommand(
		commandName: TextfresserCommandKind,
		context: CommandContext,
		notify: (message: string) => void,
	) {
		if (!context.activeFile) {
			return errAsync({ kind: CommandErrorKind.NotMdFile });
		}

		if (commandName === "Lemma") {
			return executeLemmaFlow({
				context: {
					...context,
					activeFile: context.activeFile,
				},
				notify,
				requestBackgroundGenerate:
					this.backgroundGenerateCoordinator
						.requestBackgroundGenerate,
				state: this.state,
				vam: this.vam,
			});
		}

		const commandFn = actionCommandFnForCommandKind[commandName];
		const input: CommandInput = {
			commandContext: { ...context, activeFile: context.activeFile },
			resultingActions: [],
			textfresserState: this.state,
		};

		return commandFn(input)
			.andThen((actions) => dispatchActions(this.vam, actions))
			.map(() => {
				const lemma = this.state.latestLemmaResult;
				if (commandName === "Generate" && lemma) {
					const failed = this.state.latestFailedSections;
					if (failed.length > 0) {
						notify(
							`⚠ Entry created for ${lemma.lemma} (failed: ${failed.join(", ")})`,
						);
					} else {
						notify(`✓ Entry created for ${lemma.lemma}`);
					}
					this.scrollToTargetBlock();
				}
			})
			.mapErr((error) => {
				const reason =
					"reason" in error
						? error.reason
						: `Command failed: ${error.kind}`;
				notify(`⚠ ${reason}`);
				logger.warn(`[Textfresser.${commandName}] Failed:`, error);
				return error;
			});
	}

	createHandler(): EventHandler<WikilinkClickPayload> {
		return createWikilinkClickHandler({
			awaitGenerateAndScroll:
				this.backgroundGenerateCoordinator.awaitGenerateAndScroll,
			state: this.state,
			vam: this.vam,
		});
	}

	getState() {
		return this.state;
	}

	setLibrarianLookup(fn: PathLookupFn): void {
		this.state.lookupInLibrary = fn;
	}

	private scrollToTargetBlock(): void {
		const blockId = this.state.targetBlockId;
		if (!blockId) return;
		this.state.targetBlockId = undefined;

		const contentResult = this.vam.activeFileService.getContent();
		if (contentResult.isErr()) return;

		const marker = `^${blockId}`;
		const lineIndex = contentResult.value
			.split("\n")
			.findIndex((line) => line.includes(marker));
		if (lineIndex < 0) return;

		this.vam.activeFileService.scrollToLine(lineIndex);
	}
}
