/**
 * A delimiter change over a real VAM (#159): a rename that fails partway
 * through the batch must not leave the Library with mixed suffixes. The fake
 * app below refuses chosen renames, as Obsidian does when a file is locked.
 */
import { describe, expect, it } from "bun:test";
import {
	createVaultActionManager,
	SplitPathKind,
	type SplitPathToFolder,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { type App, type TAbstractFile, TFile, TFolder } from "obsidian";
import { DelimiterChangeService } from "../../../src/commanders/librarian/runtime/delimiter-change-service";
import { DelimiterMigrationCoordinator } from "../../../src/commanders/librarian/runtime/delimiter-migration-coordinator";
import { reportDelimiterMigration } from "../../../src/commanders/librarian/runtime/delimiter-migration-report";
import type { SuffixDelimiterConfig } from "../../../src/types";

const oldConfig = { padded: false, symbol: "-" } satisfies SuffixDelimiterConfig;
const newConfig = { padded: true, symbol: "~" } satisfies SuffixDelimiterConfig;
const libraryRoot: SplitPathToFolder = {
	basename: "Library",
	kind: SplitPathKind.Folder,
	pathParts: [],
};
const NOTES = [
	"Library/Soup/Ramen/Broth-Ramen-Soup.md",
	"Library/Soup/Ramen/Noodles-Ramen-Soup.md",
	"Library/Soup/Ramen/Toppings-Ramen-Soup.md",
];

/** A Library whose renames fail for the paths in `refuse`. */
function makeVault(refuse: Set<string>) {
	const byPath = new Map<string, TAbstractFile>();
	const root = new TFolder();
	root.path = "/";
	root.name = "";
	root.children = [];
	root.isRoot = () => true;

	const folderAt = (path: string): TFolder => {
		const known = byPath.get(path);
		if (known instanceof TFolder) return known;
		const slash = path.lastIndexOf("/");
		const parent = slash < 0 ? root : folderAt(path.slice(0, slash));
		const folder = new TFolder();
		folder.path = path;
		folder.name = path.slice(slash + 1);
		folder.children = [];
		folder.parent = parent;
		parent.children.push(folder);
		byPath.set(path, folder);
		return folder;
	};

	for (const path of NOTES) {
		const slash = path.lastIndexOf("/");
		const parent = folderAt(path.slice(0, slash));
		const file = new TFile();
		file.path = path;
		file.name = path.slice(slash + 1);
		file.extension = "md";
		file.basename = file.name.slice(0, -3);
		file.parent = parent;
		file.stat = { ctime: 1, mtime: 1, size: 0 };
		parent.children.push(file);
		byPath.set(path, file);
	}

	const rename = async (entry: TAbstractFile, toPath: string) => {
		if (refuse.has(entry.path)) {
			throw new Error(`EBUSY: ${entry.path} is locked`);
		}
		byPath.delete(entry.path);
		entry.path = toPath;
		entry.name = toPath.split("/").at(-1) ?? toPath;
		if (entry instanceof TFile) entry.basename = entry.name.slice(0, -3);
		byPath.set(toPath, entry);
	};

	const app = {
		fileManager: { renameFile: rename, trashFile: async () => {} },
		metadataCache: { getFirstLinkpathDest: () => null },
		vault: {
			cachedRead: async () => "",
			getAbstractFileByPath: (path: string) =>
				path === "/" ? root : (byPath.get(path) ?? null),
			getMarkdownFiles: () =>
				[...byPath.values()].filter(
					(file): file is TFile => file instanceof TFile,
				),
			getRoot: () => root,
			offref: () => {},
			on: (name: string, callback: unknown) => ({ callback, name }),
			read: async () => "",
			rename,
		},
		workspace: {
			getActiveViewOfType: () => null,
			getLeaf: () => ({ openFile: async () => {} }),
			getLeavesOfType: () => [],
			leftSplit: null,
			setActiveLeaf: () => {},
		},
	} as unknown as App;

	const notes = () =>
		[...byPath.keys()].filter((path) => path.endsWith(".md")).sort();
	return { app, notes };
}

async function migrate(refuse: Set<string>) {
	const { app, notes } = makeVault(refuse);
	const { dispose, manager } = createVaultActionManager(app);
	const restored: SuffixDelimiterConfig[] = [];
	const coordinator = new DelimiterMigrationCoordinator(
		new DelimiterChangeService(manager),
		{
			confirm: () => Effect.succeed(true),
			pause: () => Effect.void,
			restore: (config) =>
				Effect.sync(() => {
					restored.push({ ...config });
				}),
		},
	);
	const outcome = await Effect.runPromise(
		coordinator.migrate(oldConfig, newConfig, libraryRoot),
	);
	await Effect.runPromise(dispose);
	const report = reportDelimiterMigration(outcome, {
		newDelimiter: " ~ ",
		oldDelimiter: "-",
	});
	return { notes: notes(), outcome, report, restored };
}

describe("a delimiter change that fails partway", () => {
	it("renames every note back and keeps the old delimiter", async () => {
		const { notes, outcome, report, restored } = await migrate(
			new Set(["Library/Soup/Ramen/Noodles-Ramen-Soup.md"]),
		);

		expect(notes).toEqual(NOTES);
		expect(restored).toEqual([oldConfig]);
		expect(outcome.kind).toBe("Failed");
		expect(report.keepsNewDelimiter).toBe(false);
		expect(report.notice).toBe(
			'Delimiter change failed: could not rename Library/Soup/Ramen/Noodles-Ramen-Soup.md → Library/Soup/Ramen/Noodles ~ Ramen ~ Soup.md (EBUSY: Library/Soup/Ramen/Noodles-Ramen-Soup.md is locked). Renamed the 1 file(s) already changed back to "-". Kept the delimiter "-".',
		);
	});

	it("names the notes it could not rename back", async () => {
		const { notes, outcome, report, restored } = await migrate(
			new Set([
				"Library/Soup/Ramen/Noodles-Ramen-Soup.md",
				"Library/Soup/Ramen/Broth ~ Ramen ~ Soup.md",
			]),
		);

		expect(notes).toEqual([
			"Library/Soup/Ramen/Broth ~ Ramen ~ Soup.md",
			"Library/Soup/Ramen/Noodles-Ramen-Soup.md",
			"Library/Soup/Ramen/Toppings-Ramen-Soup.md",
		]);
		expect(restored).toEqual([oldConfig]);
		expect(outcome.kind).toBe("RollbackIncomplete");
		expect(report.persistent).toBe(true);
		expect(report.notice).toContain(
			'Could not rename these back, so they still use " ~ ": Library/Soup/Ramen/Broth ~ Ramen ~ Soup.md.',
		);
	});

	it("keeps the new delimiter when every rename succeeds", async () => {
		const { notes, outcome, restored } = await migrate(new Set());

		expect(outcome.kind).toBe("Completed");
		expect(restored).toEqual([newConfig]);
		expect(notes).toEqual([
			"Library/Soup/Ramen/Broth ~ Ramen ~ Soup.md",
			"Library/Soup/Ramen/Noodles ~ Ramen ~ Soup.md",
			"Library/Soup/Ramen/Toppings ~ Ramen ~ Soup.md",
		]);
	});
});
