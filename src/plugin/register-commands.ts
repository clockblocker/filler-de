/**
 * The plugin's palette commands: one table of `PluginHost` commands over
 * Effects, each run under `command.<id>`. The launch registers them in the
 * scope it builds the services in, so unloading removes them with the
 * services: the launch commands before it builds the services, so a build
 * that fails still leaves "Copy recent trace", the others once it built
 * them.
 */
import type { VaultActionManager } from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import {
	CANCEL_RESET_COMMAND_NAME,
	RESET_COMMAND_NAME,
} from "../commanders/dictionary-reset/command-names";
import { RESTART_LIBRARIAN_COMMAND_NAME } from "../commanders/librarian/runtime/describe-librarian-stop";
import type { Lifecycle } from "../lifecycle/lifecycle-supervisor";
import { tagLineCopyEmbedBehavior } from "../managers/obsidian/behavior-manager";
import {
	CommandKind,
	createCommandExecutor,
} from "../managers/obsidian/command-executor";
import {
	type HostCommand,
	type Notices,
	PluginHost,
} from "../managers/obsidian/host";
import type { IdleTrackerService } from "../utils/idle-tracker";
import { recentTrace } from "../utils/recent-trace";
import type {
	ClassifyServices,
	DictionaryReset,
	TextfresserCommands,
} from "./plugin-services";

/** What the commands reach: the runtime's services and the launch's. */
export type PluginCommandDeps = {
	readonly lifecycle: Lifecycle["Service"];
	readonly vam: VaultActionManager;
	readonly classify: ClassifyServices["Service"];
	readonly textfresser: TextfresserCommands["Service"];
	readonly dictionaryReset: DictionaryReset["Service"];
	readonly notices: Notices["Service"];
	readonly idle: IdleTrackerService;
};

/**
 * The program of a Textfresser, Librarian or Classify command on the active
 * note, counted as pending work while it runs. Until the launch is done,
 * it does nothing.
 */
export const commandKindProgram =
	(deps: PluginCommandDeps) =>
	(kind: CommandKind): Effect.Effect<void> =>
		Effect.suspend(() => {
			const librarian = deps.lifecycle.librarian();
			if (deps.lifecycle.state().kind !== "Running" || !librarian)
				return Effect.void;
			return deps.idle.track(
				Effect.flatMap(deps.textfresser.current, (textfresser) =>
					createCommandExecutor({
						classify: deps.classify.classify,
						librarian,
						notices: deps.notices,
						textfresser,
						vam: deps.vam,
					})(kind),
				),
			);
		});

/** What the launch commands reach: nothing the launch builds. */
export type LaunchCommandDeps = Pick<
	PluginCommandDeps,
	"lifecycle" | "notices"
>;

/** The commands over the launch's services. */
export function serviceCommands(
	deps: PluginCommandDeps,
): readonly HostCommand<never, never>[] {
	const program = commandKindProgram(deps);
	const { dictionaryReset, notices, vam } = deps;
	return [
		{
			editor: true,
			id: "translate-selection",
			name: "Translate selected text",
			run: program(CommandKind.TranslateSelection),
		},
		{
			editor: true,
			id: "split-selection-in-blocks",
			name: "Split selected text in blocks",
			// With no selection, it tags the cursor's line and copies its embed.
			run: vam.getSelectionInfo().pipe(
				Effect.option,
				Effect.flatMap((selection) =>
					selection._tag === "Some" && selection.value
						? program(CommandKind.SplitInBlocks)
						: tagLineCopyEmbedBehavior(vam, notices),
				),
			),
		},
		{
			editor: true,
			id: "classify-selection",
			name: "Classify selection",
			run: program(CommandKind.Classify),
		},
		{
			id: "cancel-knowledge-generation",
			name: "Cancel background Knowledge generation",
			run: Effect.flatMap(
				deps.classify.knowledgeQueue.cancelAll,
				(cancelled) =>
					notices.show(
						cancelled > 0
							? `Cancelled Knowledge generation for ${cancelled} Reading${cancelled === 1 ? "" : "s"}`
							: "No Knowledge generation is running",
					),
			),
		},
		{
			id: "reset-dictionary-from-old-notes",
			name: RESET_COMMAND_NAME,
			// It starts at once, so E2E finds the opening right after the command.
			run: dictionaryReset.open,
		},
		{
			id: "cancel-dictionary-reset",
			name: CANCEL_RESET_COMMAND_NAME,
			run: Effect.flatMap(dictionaryReset.cancel, (cancelled) =>
				notices.show(
					cancelled
						? "Cancelling the dictionary reset after its current step"
						: "No dictionary reset is running",
				),
			),
		},
		{
			editor: true,
			id: "split-to-pages",
			name: "Split file into pages",
			run: program(CommandKind.SplitToPages),
		},
	];
}

/** The commands that need only the runtime's services. */
export function launchCommands({
	lifecycle,
	notices,
}: LaunchCommandDeps): readonly HostCommand<never, never>[] {
	return [
		{
			id: "restart-librarian",
			name: RESTART_LIBRARIAN_COMMAND_NAME,
			run: lifecycle.restart,
		},

		{
			id: "copy-recent-trace",
			name: "Copy recent trace",
			// The trace renders the spans that ended, so not this one.
			run: Effect.tryPromise(() =>
				navigator.clipboard.writeText(recentTrace.render()),
			).pipe(
				Effect.matchEffect({
					onFailure: () =>
						notices.show("⚠ Could not copy the recent trace"),
					onSuccess: () => notices.show("Copied the recent trace"),
				}),
			),
		},
		{
			id: "textfresser-testing-expose-opened-service",
			name: "Testing: expose opened file service",
			run: lifecycle.whenLaunched,
		},
	];
}

/** Registers `commands` in the caller's scope. */
export const registerCommands = Effect.fn("registerCommands")(function* (
	commands: readonly HostCommand<never, never>[],
) {
	const host = yield* PluginHost;
	for (const command of commands) yield* host.command(command);
});
