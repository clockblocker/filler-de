import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { type App, type TAbstractFile, TFile, TFolder } from "obsidian";
import { createVaultActionManager } from "../../src";
import type {
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../src/types/split-path";
import { VaultActionKind } from "../../src/types/vault-action";

const folder = (basename: string): SplitPathToFolder => ({
	basename,
	kind: "Folder",
	pathParts: [],
});

/** One folder, and a log of which Obsidian API renamed it. */
function makeApp() {
	const calls: string[] = [];
	const byPath = new Map<string, TAbstractFile>();
	const worter = new TFolder();
	worter.path = "Worter";
	worter.name = "Worter";
	worter.children = [];
	byPath.set("Worter", worter);
	const stray = new TFile();
	stray.path = "Worter/Fahrer.md";
	stray.name = "Fahrer.md";
	stray.basename = "Fahrer";
	stray.extension = "md";
	stray.parent = worter;
	worter.children.push(stray);
	byPath.set(stray.path, stray);
	const move = (entry: TAbstractFile, toPath: string) => {
		byPath.delete(entry.path);
		entry.path = toPath;
		byPath.set(toPath, entry);
	};
	const app = {
		fileManager: {
			renameFile: async (entry: TAbstractFile, toPath: string) => {
				calls.push("fileManager.renameFile");
				move(entry, toPath);
			},
			trashFile: async () => {},
		},
		metadataCache: { getFirstLinkpathDest: () => null, resolvedLinks: {} },
		vault: {
			getAbstractFileByPath: (path: string) => byPath.get(path) ?? null,
			getMarkdownFiles: () => [],
			getRoot: () => byPath.get("") ?? null,
			offref: () => {},
			on: (name: string, callback: unknown) => ({ callback, name }),
			rename: async (entry: TAbstractFile, toPath: string) => {
				calls.push("vault.rename");
				move(entry, toPath);
			},
		},
		workspace: {
			getActiveViewOfType: () => null,
			getLeaf: () => ({ openFile: async () => {} }),
			getLeavesOfType: () => [],
			leftSplit: null,
			setActiveLeaf: () => {},
		},
	} as unknown as App;
	return { app, calls };
}

async function renameWorter(updateLinks?: boolean) {
	const { app, calls } = makeApp();
	const { dispose, manager } = createVaultActionManager(app);
	await Effect.runPromise(
		manager.dispatchStopOnFirstFailure(
			[
				{
					kind: VaultActionKind.RenameFolder,
					payload: {
						from: folder("Worter"),
						to: folder("Backup"),
						...(updateLinks === undefined ? {} : { updateLinks }),
					},
				},
			],
			{ caller: "test" },
		),
	);
	await Effect.runPromise(dispose);
	return calls;
}

describe("RenameFolder and Obsidian's link updates", () => {
	it("renames through FileManager by default, so links follow the move", async () => {
		expect(await renameWorter()).toEqual(["fileManager.renameFile"]);
	});

	it("renames through Vault with updateLinks false, so no content changes", async () => {
		expect(await renameWorter(false)).toEqual(["vault.rename"]);
	});
});

const note = (pathParts: string[], basename: string): SplitPathToMdFile => ({
	basename,
	extension: "md",
	kind: "MdFile",
	pathParts,
});

async function moveStray(updateLinks?: boolean) {
	const { app, calls } = makeApp();
	const { dispose, manager } = createVaultActionManager(app);
	await Effect.runPromise(
		manager.dispatchStopOnFirstFailure(
			[
				{
					kind: VaultActionKind.RenameMdFile,
					payload: {
						from: note(["Worter"], "Fahrer"),
						to: note(["Worter"], "fahrer"),
						...(updateLinks === undefined ? {} : { updateLinks }),
					},
				},
			],
			{ caller: "test" },
		),
	);
	await Effect.runPromise(dispose);
	return calls;
}

describe("RenameMdFile and Obsidian's link updates", () => {
	it("renames through FileManager by default, so links follow the move", async () => {
		expect(await moveStray()).toEqual(["fileManager.renameFile"]);
	});

	it("renames through Vault with updateLinks false, so no content changes", async () => {
		expect(await moveStray(false)).toEqual(["vault.rename"]);
	});
});
