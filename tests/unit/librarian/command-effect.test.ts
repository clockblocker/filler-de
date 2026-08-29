import { describe, expect, it } from "bun:test";
import {
	type SplitPathToMdFile,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import {
	VamPlanningError,
	type VaultActionManager,
} from "@textfresser/vault-action-manager/facade";
import { Effect, Result } from "effect";
import { goToNextPageCommand } from "../../../src/commanders/librarian/commands/navigate-pages";
import { splitInBlocksCommand } from "../../../src/commanders/librarian/commands/split-in-blocks";
import type { LibrarianCommandInput } from "../../../src/commanders/librarian/commands/types";
import type { Librarian } from "../../../src/commanders/librarian/librarian";
import { getAdjacentPageInfo } from "../../../src/commanders/librarian/pages/page-codec";
import { splitToPagesAction } from "../../../src/commanders/librarian/pages/split-to-pages-action";
import { setupGetParsedUserSettingsSpyWithHooks } from "../common-utils/setup-spy";

const SOURCE_PATH: SplitPathToMdFile = {
	basename: "Source",
	extension: "md",
	kind: "MdFile",
	pathParts: ["Library"],
};

const NEXT_PATH: SplitPathToMdFile = {
	...SOURCE_PATH,
	basename: "Next",
};

setupGetParsedUserSettingsSpyWithHooks();

function makeInput(options: {
	librarian?: Partial<Librarian>;
	notify?: (message: string) => void;
	selectionText?: string | null;
	vam: Partial<VaultActionManager>;
}): LibrarianCommandInput {
	return {
		commandContext: {
			activeFile: { content: "existing ^4", splitPath: SOURCE_PATH },
			selection: {
				selectionStartInBlock: 0,
				splitPathToFileWithSelection: SOURCE_PATH,
				surroundingRawBlock: options.selectionText ?? "",
				text: options.selectionText ?? null,
			},
		},
		librarianState: {
			librarian: options.librarian as Librarian,
			notify: options.notify ?? (() => {}),
			vam: options.vam as VaultActionManager,
		},
	};
}

describe("Librarian Effect commands", () => {
	it("reports a missing selection through the Effect error channel", async () => {
		const notifications: string[] = [];
		const input = makeInput({
			notify: (message) => notifications.push(message),
			selectionText: null,
			vam: {},
		});

		const result = await Effect.runPromise(
			splitInBlocksCommand(input).pipe(Effect.result),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure.kind).toBe("NoSelection");
		}
		expect(notifications).toEqual(["No text selected"]);
	});

	it("composes page navigation with the Effect VAM facade", async () => {
		const opened: SplitPathToMdFile[] = [];
		const input = makeInput({
			librarian: { getNextPage: () => NEXT_PATH },
			vam: {
				cd: (path) =>
					Effect.sync(() => {
						opened.push(path);
					}),
			},
		});

		await Effect.runPromise(goToNextPageCommand(input));

		expect(opened).toEqual([NEXT_PATH]);
	});

	it("dispatches block splitting and notifies from inside the Effect", async () => {
		const notifications: string[] = [];
		const dispatches: Array<readonly { kind: string }[]> = [];
		const input = makeInput({
			notify: (message) => notifications.push(message),
			selectionText: "First sentence. Second sentence.",
			vam: {
				dispatch: (actions) =>
					Effect.sync(() => {
						dispatches.push(actions);
					}),
			},
		});

		await Effect.runPromise(splitInBlocksCommand(input));

		expect(dispatches).toHaveLength(1);
		expect(dispatches[0]?.[0]?.kind).toBe(VaultActionKind.ProcessMdFile);
		expect(notifications).toEqual(["Split into 1 blocks"]);
	});

	it("maps Effect VAM dispatch failures into CommandError", async () => {
		const notifications: string[] = [];
		const input = makeInput({
			notify: (message) => notifications.push(message),
			selectionText: "Selected sentence.",
			vam: {
				dispatch: () =>
					Effect.fail(
						new VamPlanningError({
							cause: new Error("planning failed"),
							operation: "planDispatchBatch",
						}),
					),
			},
		});

		const result = await Effect.runPromise(
			splitInBlocksCommand(input).pipe(Effect.result),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure.kind).toBe("DispatchFailed");
			if (result.failure.kind === "DispatchFailed") {
				expect(result.failure.reason).toContain("planning failed");
			}
		}
		expect(notifications[0]).toContain("planning failed");
	});
});

describe("getAdjacentPageInfo", () => {
	it("lists adjacent pages through the Effect facade", async () => {
		const currentPage = {
			...SOURCE_PATH,
			basename: "Story_Page_001-Story",
			pathParts: ["Library", "Story"],
		};
		const vam = {
			list: () =>
				Effect.succeed([
					{ ...currentPage, basename: "Story_Page_000-Story" },
					{ ...currentPage, basename: "Story_Page_002-Story" },
				]),
		} as unknown as VaultActionManager;

		const result = await Effect.runPromise(
			getAdjacentPageInfo(vam, currentPage),
		);

		expect(result).toEqual({ hasNextPage: true, hasPrevPage: true });
	});
});

describe("splitToPagesAction", () => {
	it("sequences facade reads, dispatch, healing, and navigation in one Effect", async () => {
		const order: string[] = [];
		const vam = {
			cd: () => Effect.sync(() => order.push("cd")),
			dispatch: () => Effect.sync(() => order.push("dispatch")),
			getOpenedContent: () =>
				Effect.sync(() => {
					order.push("content");
					return "First sentence.\n\nSecond sentence.";
				}),
			mdPwd: () =>
				Effect.sync(() => {
					order.push("pwd");
					return SOURCE_PATH;
				}),
		} as unknown as VaultActionManager;

		await Effect.runPromise(
			splitToPagesAction(
				{
					onSectionCreated: () =>
						Effect.sync(() => order.push("heal")),
					vam,
				},
				{
					maxPageSizeChars: 30,
					minContentSizeChars: 1,
					preserveDialogues: true,
					preserveParagraphs: true,
					targetPageSizeChars: 20,
				},
			),
		);

		expect(order).toEqual(["pwd", "content", "dispatch", "heal", "cd"]);
	});
});
