import type { VaultActionManager } from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { Notice } from "obsidian";
import type { LibrarianCommandKind } from "../../../commanders/librarian/commands/types";
import type { Librarian } from "../../../commanders/librarian/librarian";
import type { Textfresser } from "../../../commanders/textfresser/textfresser";
import { logger } from "../../../utils/logger";
import { type CommandContext, CommandKind } from "./types";

/**
 * Managers needed to build command executor.
 */
type CommandExecutorManagers = {
	librarian: Librarian;
	textfresser: Textfresser;
	vam: VaultActionManager;
};

/**
 * Create command executor with injected managers.
 * Returns a function that executes commands by kind.
 */
export function createCommandExecutor(managers: CommandExecutorManagers) {
	const { librarian, textfresser, vam } = managers;

	const notify = (message: string) => {
		new Notice(message);
	};

	/**
	 * Collect command context once at invocation.
	 */
	const collectContext = Effect.fn("createCommandExecutor.collectContext")(
		function* () {
			const splitPath = yield* vam
				.mdPwd()
				.pipe(Effect.catch(() => Effect.succeed(null)));
			let activeFile: CommandContext["activeFile"] = null;
			if (splitPath) {
				activeFile = yield* vam.getOpenedContent().pipe(
					Effect.map((content) => ({ content, splitPath })),
					Effect.catch(() => Effect.succeed(null)),
				);
			}
			const selection = yield* vam
				.getSelectionInfo()
				.pipe(Effect.catch(() => Effect.succeed(null)));
			return {
				activeFile,
				selection,
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
