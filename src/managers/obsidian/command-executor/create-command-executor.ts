import {
	splitPathCodec,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { Notice } from "obsidian";
import type { ClassifyCommander } from "../../../commanders/classify";
import type { LibrarianCommandKind } from "../../../commanders/librarian/commands/types";
import type { Librarian } from "../../../commanders/librarian/librarian";
import type { Textfresser } from "../../../commanders/textfresser/textfresser";
import { logger } from "../../../utils/logger";
import { CommandKind } from "./types";

/**
 * Managers needed to build command executor.
 */
type CommandExecutorManagers = {
	classify: ClassifyCommander;
	librarian: Librarian;
	textfresser: Textfresser;
	vam: VaultActionManager;
};

/**
 * Create command executor with injected managers.
 * Returns a function that executes commands by kind.
 */
export function createCommandExecutor(managers: CommandExecutorManagers) {
	const { classify, librarian, textfresser, vam } = managers;

	const notify = (message: string) => {
		new Notice(message);
	};

	/**
	 * Collect command context once at invocation.
	 */
	const collectContext = Effect.fn("createCommandExecutor.collectContext")(
		function* () {
			const context = yield* vam.getActiveEditorContext();
			return {
				activeFile: context
					? {
							content: context.content,
							splitPath: context.splitPath,
						}
					: null,
				selection: context?.selection ?? null,
			};
		},
	);

	return async function executeCommand(kind: CommandKind): Promise<void> {
		switch (kind) {
			case CommandKind.GoToPrevPage:
			case CommandKind.GoToNextPage:
			case CommandKind.SplitToPages:
			case CommandKind.SplitInBlocks: {
				const context = await Effect.runPromise(collectContext());
				// Delegate to librarian - codex guard handled internally
				const librarianKind = kind as LibrarianCommandKind;
				await Effect.runPromise(
					librarian
						.executeCommand(librarianKind, context, notify)
						.pipe(Effect.ignore),
				);
				break;
			}

			case CommandKind.TranslateSelection:
			case CommandKind.Generate:
			case CommandKind.Lemma: {
				await Effect.runPromise(
					collectContext().pipe(
						Effect.flatMap((context) =>
							textfresser.executeCommand(kind, context, notify),
						),
						Effect.ignore,
					),
				);
				break;
			}

			case CommandKind.Classify: {
				await Effect.runPromise(
					vam.getActiveEditorContext().pipe(
						Effect.flatMap((context) =>
							context
								? classify.execute(
										{
											content: context.content,
											scrollPath: splitPathCodec.format(
												context.splitPath,
											),
											selection: context.selectionRange,
										},
										notify,
									)
								: Effect.sync(() =>
										notify(
											"⚠ Open a Scroll to classify a selection",
										),
									),
						),
						Effect.catch((error) =>
							Effect.sync(() => {
								notify("⚠ Could not read the active editor");
								logger.warn(
									"[CommandExecutor] Classify could not read the editor:",
									error,
								);
							}),
						),
					),
				);
				break;
			}

			default: {
				const exhaustiveCheck: never = kind;
				logger.error(
					`[CommandExecutor] Unknown command kind: ${exhaustiveCheck}`,
				);
			}
		}
	};
}

/**
 * Type for the returned executor function.
 */
export type CommandExecutor = ReturnType<typeof createCommandExecutor>;
