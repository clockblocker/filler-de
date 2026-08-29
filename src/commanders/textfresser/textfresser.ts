/**
 * Textfresser commander - thin orchestrator for vocabulary commands.
 */

import type { LexicalGenerationSettings } from "@textfresser/lexical-generation";
import type {
	UserEventHandler,
	UserEventKind,
} from "@textfresser/obsidian-event-layer";
import type { VaultActionManager } from "@textfresser/vault-action-manager";
import { Effect, Option } from "effect";
import type { CommandContext } from "../../managers/obsidian/command-executor";
import type { ApiService } from "../../stateless-helpers/api-service";
import type { LanguagesConfig } from "../../types";
import { logger } from "../../utils/logger";
import { actionCommandFnForCommandKind } from "./commands";
import type {
	CommandError,
	CommandInput,
	TextfresserCommandKind,
} from "./commands/types";
import type { PathLookupFn } from "./common/target-path-resolver";
import type { LibraryBasenameParser } from "./domain/linguistic-wikilink";
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

const scrollToTargetBlockProgram = Effect.fn("Textfresser.scrollToTargetBlock")(
	function* (state: TextfresserState, vam: VaultActionManager) {
		const blockId = state.targetBlockId;
		if (!blockId) return;
		state.targetBlockId = undefined;

		const contentResult = yield* vam.getOpenedContent().pipe(Effect.option);
		if (Option.isNone(contentResult)) return;

		const marker = `^${blockId}`;
		const lineIndex = contentResult.value
			.split("\n")
			.findIndex((line) => line.includes(marker));
		if (lineIndex < 0) return;

		yield* vam.scrollOpenedFileToLine(lineIndex).pipe(Effect.ignore);
	},
);

export class Textfresser {
	private state: TextfresserState;
	private backgroundGenerateCoordinator: BackgroundGenerateCoordinator;

	constructor(
		private readonly vam: VaultActionManager,
		languages: LanguagesConfig,
		apiService: ApiService,
		lexicalGenerationSettings: LexicalGenerationSettings,
	) {
		this.state = createInitialTextfresserState({
			apiService,
			languages,
			lexicalGenerationSettings,
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
	): Effect.Effect<void, CommandError> {
		if (!context.activeFile) {
			return Effect.fail({ kind: CommandErrorKind.NotMdFile });
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

		return commandFn(input).pipe(
			Effect.flatMap((actions) => dispatchActions(this.vam, actions)),
			Effect.tap(() => {
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
					return this.scrollToTargetBlock();
				}
				return Effect.void;
			}),
			Effect.tapError((error) =>
				Effect.sync(() => {
					const reason =
						"reason" in error
							? error.reason
							: `Command failed: ${error.kind}`;
					notify(`⚠ ${reason}`);
					logger.warn(`[Textfresser.${commandName}] Failed:`, error);
				}),
			),
		);
	}

	createHandler(): UserEventHandler<typeof UserEventKind.WikilinkClicked> {
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

	setLibrarianResolvers(params: {
		lookupInLibraryByCoreName: PathLookupFn;
		parseLibraryBasename: LibraryBasenameParser;
	}): void {
		this.state.lookupInLibrary = params.lookupInLibraryByCoreName;
		this.state.parseLibraryBasename = params.parseLibraryBasename;
		this.state.isLibraryLookupAvailable = true;
	}

	clearLibrarianLookup(): void {
		this.state.lookupInLibrary = () => [];
		this.state.parseLibraryBasename = () => null;
		this.state.isLibraryLookupAvailable = false;
	}

	private scrollToTargetBlock(): Effect.Effect<void> {
		return scrollToTargetBlockProgram(this.state, this.vam);
	}
}
