import { afterEach, describe, expect, it, type spyOn } from "bun:test";
import { makeCodexBasename } from "@textfresser/library-core";
import {
	MD,
	SplitPathKind,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	type VaultScanResult,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import {
	Librarian,
	type LibrarianVam,
} from "../../../src/commanders/librarian/librarian";
import { CommandKind } from "../../../src/managers/obsidian/command-executor";
import { getContextMenuFile } from "../../../src/managers/overlay-manager/context-menu/context-menu";
import { setupGetParsedUserSettingsSpy } from "../../unit/common-utils/setup-spy";

let settingsSpy: ReturnType<typeof spyOn> | null = null;

afterEach(() => {
	settingsSpy?.mockRestore();
	settingsSpy = null;
});

function md(pathParts: string[], basename: string): SplitPathToMdFile {
	return { basename, extension: MD, kind: SplitPathKind.MdFile, pathParts };
}

function folder(pathParts: string[], basename: string): SplitPathToFolder {
	return { basename, kind: SplitPathKind.Folder, pathParts };
}

function makeVam(active: () => SplitPathToMdFile): LibrarianVam {
	const emptyScan: VaultScanResult = {
		counts: { folderCount: 1, markdownFileCount: 0, otherFileCount: 0 },
		diagnostics: [],
		entries: [],
		kind: "Complete",
	};
	return {
		cd: () => Effect.void,
		dispatch: () => Effect.void,
		getActiveEditorContext: () =>
			Effect.sync(() => ({
				content: "Some text.",
				currentLine: "Some text.",
				cursor: { ch: 0, line: 0 },
				selection: {
					selectionStartInBlock: null,
					splitPathToFileWithSelection: active(),
					surroundingRawBlock: "",
					text: null,
				},
				selectionRange: null,
				splitPath: active(),
			})),
		getOpenedContent: () => Effect.succeed("Some text."),
		mdPwd: () => Effect.sync(() => active()),
		scan: () => Effect.succeed(emptyScan),
		subscribeToBulk: () => Effect.succeed({ close: Effect.void }),
	};
}

async function startLibrarian(root: SplitPathToFolder) {
	settingsSpy = setupGetParsedUserSettingsSpy({ splitPathToLibraryRoot: root });
	let active = md([], "README");
	const vam = makeVam(() => active);
	const librarian = new Librarian(vam);
	await Effect.runPromise(librarian.init());
	const contextMenuAccepts = (splitPath: SplitPathToMdFile): boolean => {
		active = splitPath;
		return Effect.runSync(getContextMenuFile(vam, librarian)) !== null;
	};
	return { contextMenuAccepts, librarian };
}

describe("Librarian library membership", () => {
	it("answers false before init", () => {
		const librarian = new Librarian(makeVam(() => md([], "README")));
		expect(librarian.isInsideLibrary(md(["Library"], "Scroll"))).toBe(false);
	});

	describe("default root (Library)", () => {
		it("places only paths under Library inside the Library", async () => {
			const { librarian } = await startLibrarian(folder([], "Library"));
			expect(librarian.isInsideLibrary(md(["Library"], "Scroll"))).toBe(
				true,
			);
			expect(
				librarian.isInsideLibrary(md(["Library", "A"], "Scroll-A")),
			).toBe(true);
			expect(librarian.isInsideLibrary(folder([], "Library"))).toBe(true);
			expect(librarian.isInsideLibrary(md([], "README"))).toBe(false);
			expect(librarian.isInsideLibrary(md(["Notes"], "x"))).toBe(false);
			expect(librarian.isInsideLibrary(md(["Library2"], "x"))).toBe(false);
			await Effect.runPromise(librarian.unsubscribe());
		});

		it("offers the context menu only to files inside the Library", async () => {
			const { contextMenuAccepts, librarian } = await startLibrarian(
				folder([], "Library"),
			);
			expect(contextMenuAccepts(md(["Library", "A"], "Scroll-A"))).toBe(
				true,
			);
			expect(contextMenuAccepts(md([], "README"))).toBe(false);
			expect(contextMenuAccepts(md(["Notes"], "x"))).toBe(false);
			expect(contextMenuAccepts(md(["Library2"], "x"))).toBe(false);
			await Effect.runPromise(librarian.unsubscribe());
		});
	});

	describe("nested root (Books/Library)", () => {
		it("places only paths under Books/Library inside the Library", async () => {
			const { librarian } = await startLibrarian(
				folder(["Books"], "Library"),
			);
			expect(
				librarian.isInsideLibrary(md(["Books", "Library"], "Scroll")),
			).toBe(true);
			expect(librarian.isInsideLibrary(folder(["Books"], "Library"))).toBe(
				true,
			);
			expect(librarian.isInsideLibrary(md(["Books"], "x"))).toBe(false);
			expect(librarian.isInsideLibrary(md(["Library"], "x"))).toBe(false);
			expect(
				librarian.isInsideLibrary(md(["Books", "Library2"], "x")),
			).toBe(false);
			await Effect.runPromise(librarian.unsubscribe());
		});

		it("still lists Library commands for files under the nested root", async () => {
			const { librarian } = await startLibrarian(
				folder(["Books"], "Library"),
			);
			expect(
				librarian.listCommandsExecutableIn(
					md(["Books", "Library", "A"], "Scroll-A"),
				),
			).toContain(CommandKind.SplitInBlocks);
			expect(
				librarian.listCommandsExecutableIn(md(["Books"], "Scroll-A")),
			).toEqual([]);
			await Effect.runPromise(librarian.unsubscribe());
		});

		it("offers the context menu only to files under Books/Library", async () => {
			const { contextMenuAccepts, librarian } = await startLibrarian(
				folder(["Books"], "Library"),
			);
			expect(
				contextMenuAccepts(md(["Books", "Library", "A"], "Scroll-A")),
			).toBe(true);
			expect(contextMenuAccepts(md(["Books"], "x"))).toBe(false);
			expect(contextMenuAccepts(md(["Library"], "x"))).toBe(false);
			expect(contextMenuAccepts(md(["Books", "Library2"], "x"))).toBe(
				false,
			);
			await Effect.runPromise(librarian.unsubscribe());
		});
	});

	it("detects codex files by the codex prefix", async () => {
		const { librarian } = await startLibrarian(folder([], "Library"));
		const codexPath = md(
			["Library", "A"],
			makeCodexBasename(["Library", "A"]),
		);
		expect(librarian.isCodex(codexPath)).toBe(true);
		expect(librarian.isCodex(md(["Library", "A"], "Scroll-A"))).toBe(false);
		expect(librarian.isCodex(md(["Library", "A"], "_Scroll-A"))).toBe(false);
		await Effect.runPromise(librarian.unsubscribe());
	});
});
