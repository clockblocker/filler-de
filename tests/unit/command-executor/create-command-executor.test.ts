import { describe, expect, it } from "bun:test";
import {
	type SplitPathToMdFile,
	splitPathCodec,
	VamActiveEditorError,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import type { ClassifyCommander } from "../../../src/commanders/classify";
import type { Librarian } from "../../../src/commanders/librarian/librarian";
import type { Textfresser } from "../../../src/commanders/textfresser/textfresser";
import {
	type CommandContext,
	CommandKind,
} from "../../../src/managers/obsidian/command-executor";
import { createCommandExecutor } from "../../../src/managers/obsidian/command-executor/create-command-executor";
import { Notices } from "../../../src/managers/obsidian/host";

const page = splitPathCodec.parse("Library/Book/Page-001.md") as SplitPathToMdFile;

/** A note shown in reading view: no editor context, but readable. */
function inReadingView() {
	const received: { kind: string; context: CommandContext }[] = [];
	const vam = {
		getActiveEditorContext: () =>
			Effect.fail(
				new VamActiveEditorError({
					cause: new Error("the note is shown in reading view"),
					operation: "requireSourceMode",
					path: "Library/Book/Page-001.md",
					reason: "WrongMode",
				}),
			),
		mdPwd: () => Effect.succeed(page),
		readContent: () => Effect.succeed("page content"),
	};
	const librarian = {
		executeCommand: (kind: string, context: CommandContext) =>
			Effect.sync(() => {
				received.push({ context, kind });
			}),
	};
	const program = createCommandExecutor({
		classify: {} as unknown as ClassifyCommander,
		librarian: librarian as unknown as Librarian,
		notices: Notices.over({
			open: () => ({ hide() {}, setMessage() {}, showing: () => true }),
			show: () => {},
		}),
		textfresser: {} as unknown as Textfresser,
		vam: vam as unknown as VaultActionManager,
	});
	const execute = (kind: CommandKind) => Effect.runPromise(program(kind));
	return { execute, received };
}

describe("createCommandExecutor in reading view", () => {
	it("turns the page from the note itself, without an editor", async () => {
		const { execute, received } = inReadingView();
		await execute(CommandKind.GoToNextPage);
		await execute(CommandKind.GoToPrevPage);
		expect(received).toEqual([
			{
				context: {
					activeFile: { content: "page content", splitPath: page },
					selection: null,
				},
				kind: CommandKind.GoToNextPage,
			},
			{
				context: {
					activeFile: { content: "page content", splitPath: page },
					selection: null,
				},
				kind: CommandKind.GoToPrevPage,
			},
		]);
	});

	it("reports, instead of throwing, a command that needs the editor", async () => {
		const { execute, received } = inReadingView();
		await execute(CommandKind.SplitToPages);
		await execute(CommandKind.SplitInBlocks);
		await execute(CommandKind.TranslateSelection);
		expect(received).toEqual([]);
	});
});
