import {
	splitPathCodec,
	VamActiveEditorError,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Cause, Effect } from "effect";
import type { ClassifyCommander } from "../../../commanders/classify";
import type { LibrarianCommandKind } from "../../../commanders/librarian/commands/types";
import type { Librarian } from "../../../commanders/librarian/librarian";
import type { Textfresser } from "../../../commanders/textfresser/textfresser";
import type { Notices } from "../host/notices";
import { type CommandContext, CommandKind } from "./types";

/**
 * Managers needed to build command executor.
 */
type CommandExecutorManagers = {
	classify: ClassifyCommander;
	librarian: Librarian;
	/** What a command tells the user. */
	notices: Notices["Service"];
	textfresser: Textfresser;
	vam: VaultActionManager;
};

/**
 * Create command executor with injected managers.
 * Returns a function that answers each command kind's program.
 */
export function createCommandExecutor(managers: CommandExecutorManagers) {
	const { classify, librarian, notices, textfresser, vam } = managers;
	const notify = (message: string) => notices.sink.show(message);

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

	/**
	 * Context for page navigation, which needs only the note: read as VAM
	 * routes it, so it works in reading view, which has no editor to read
	 * a cursor or selection from.
	 */
	const collectNoteContext = Effect.fn(
		"createCommandExecutor.collectNoteContext",
	)(function* () {
		const splitPath = yield* vam.mdPwd();
		const context: CommandContext = splitPath
			? {
					activeFile: {
						content: yield* vam.readContent(splitPath),
						splitPath,
					},
					selection: null,
				}
			: { activeFile: null, selection: null };
		return context;
	});

	/** Tells the user why a command could not read the active note. */
	const reportUnreadEditor = (command: string) => (error: unknown) =>
		Effect.sync(() =>
			notify(
				error instanceof VamActiveEditorError &&
					error.reason === "WrongMode"
					? `⚠ Switch the note to editing view to ${command}`
					: "⚠ Could not read the active note",
			),
		).pipe(
			Effect.andThen(
				Effect.logWarning(
					`[CommandExecutor] Could not read the active note to ${command}:`,
					Cause.fail(error),
				),
			),
		);

	/** The program of the command `kind`; it reports its own failures. */
	return function commandProgram(kind: CommandKind): Effect.Effect<void> {
		switch (kind) {
			case CommandKind.GoToPrevPage:
			case CommandKind.GoToNextPage:
			case CommandKind.SplitToPages:
			case CommandKind.SplitInBlocks: {
				const navigates =
					kind === CommandKind.GoToPrevPage ||
					kind === CommandKind.GoToNextPage;
				// Delegate to librarian - codex guard handled internally
				const librarianKind = kind as LibrarianCommandKind;
				return (
					navigates ? collectNoteContext() : collectContext()
				).pipe(
					Effect.flatMap((context) =>
						librarian
							.executeCommand(librarianKind, context, notify)
							.pipe(Effect.ignore),
					),
					Effect.catch(
						reportUnreadEditor(
							navigates
								? "turn the page"
								: kind === CommandKind.SplitToPages
									? "split it into pages"
									: "split it into sentence blocks",
						),
					),
				);
			}

			case CommandKind.TranslateSelection:
				return collectContext().pipe(
					Effect.flatMap((context) =>
						textfresser
							.executeCommand(kind, context, notify)
							.pipe(Effect.ignore),
					),
					Effect.catch(reportUnreadEditor("translate a selection")),
				);

			case CommandKind.Classify:
				return vam.getActiveEditorContext().pipe(
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
					Effect.catch(reportUnreadEditor("classify a selection")),
				);

			default: {
				const exhaustiveCheck: never = kind;
				return Effect.logError(
					`[CommandExecutor] Unknown command kind: ${exhaustiveCheck}`,
				);
			}
		}
	};
}

/** Runs a command on the plugin runtime, once the plugin has launched. */
export type CommandExecutor = (kind: CommandKind) => Promise<void>;
