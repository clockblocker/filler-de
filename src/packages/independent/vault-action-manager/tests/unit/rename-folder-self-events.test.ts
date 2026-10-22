import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { type App, type TAbstractFile, TFile, TFolder } from "obsidian";
import { createVaultActionManager, splitPathCodec } from "../../src";
import type { BulkVaultEvent } from "../../src/impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event";
import type { SplitPathToFolder } from "../../src/types/split-path";
import {
	type VaultAction,
	VaultActionKind,
} from "../../src/types/vault-action";
import type { VaultEvent } from "../../src/types/vault-event";

type Callback = (...args: never[]) => void;

const folder = (pathParts: string[], basename: string): SplitPathToFolder => ({
	basename,
	kind: "Folder",
	pathParts,
});

/**
 * An in-memory vault. Renaming a folder reports a rename for the folder and
 * then for every descendant, as Obsidian does.
 */
function makeVault(initialFiles: readonly string[]) {
	const callbacks = new Map<string, Callback>();
	const byPath = new Map<string, TAbstractFile>();
	const fire = (name: string, ...args: unknown[]) =>
		callbacks.get(name)?.(...(args as never[]));

	const attach = (entry: TAbstractFile, path: string) => {
		entry.path = path;
		entry.name = path.split("/").at(-1) ?? path;
		if (entry instanceof TFile) {
			const dot = entry.name.lastIndexOf(".");
			entry.basename = entry.name.slice(0, dot);
			entry.extension = entry.name.slice(dot + 1);
		}
		const parentPath = path.split("/").slice(0, -1).join("/");
		const parent = byPath.get(parentPath);
		if (parent instanceof TFolder) {
			entry.parent = parent;
			parent.children.push(entry);
		}
		byPath.set(path, entry);
	};
	const ensureFolders = (path: string) => {
		const parts = path.split("/");
		for (let i = 1; i < parts.length; i++) {
			const folderPath = parts.slice(0, i).join("/");
			if (byPath.has(folderPath)) continue;
			const entry = new TFolder();
			entry.children = [];
			attach(entry, folderPath);
		}
	};
	/** Adds a file without reporting it, as if it predates listening. */
	const seed = (path: string) => {
		ensureFolders(path);
		const file = new TFile();
		attach(file, path);
		return file;
	};
	for (const path of initialFiles) seed(path);

	const rename = async (entry: TAbstractFile, toPath: string) => {
		const fromPath = entry.path;
		const moved = [...byPath.values()].filter((e) =>
			e.path.startsWith(`${fromPath}/`),
		);
		const parent = entry.parent;
		if (parent) {
			parent.children = parent.children.filter((c) => c !== entry);
		}
		byPath.delete(fromPath);
		ensureFolders(toPath);
		attach(entry, toPath);
		const reported: [TAbstractFile, string][] = [[entry, fromPath]];
		for (const descendant of moved) {
			const oldPath = descendant.path;
			byPath.delete(oldPath);
			descendant.path = `${toPath}${oldPath.slice(fromPath.length)}`;
			byPath.set(descendant.path, descendant);
			reported.push([descendant, oldPath]);
		}
		for (const [e, oldPath] of reported) fire("rename", e, oldPath);
	};

	const app = {
		fileManager: { renameFile: rename, trashFile: async () => {} },
		metadataCache: { getFirstLinkpathDest: () => null },
		vault: {
			getAbstractFileByPath: (path: string) => byPath.get(path) ?? null,
			getMarkdownFiles: () => [],
			offref: () => {},
			on: (name: string, callback: Callback) => {
				callbacks.set(name, callback);
				return { callback, name };
			},
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

	return {
		app,
		/** A file the user creates in Obsidian. */
		createByHand: (path: string) => fire("create", seed(path)),
		/** A rename the user makes in Obsidian. */
		renameByHand: (from: string, to: string) => {
			const entry = byPath.get(from);
			if (!entry) throw new Error(`missing ${from}`);
			return rename(entry, to);
		},
		seed,
	};
}

function describeEvent(event: VaultEvent): string {
	return "from" in event
		? `${event.kind} ${splitPathCodec.format(event.from)} -> ${splitPathCodec.format(event.to)}`
		: `${event.kind} ${splitPathCodec.format(event.splitPath)}`;
}

/**
 * Starts VAM over `vault`, dispatches `RenameFolder Library/Old ->
 * Library/New`, runs `duringWindow` while that action's Self Event window is
 * still open, settles, and returns every event subscribers received.
 */
async function renameOldToNew(
	vault: ReturnType<typeof makeVault>,
	duringWindow: () => Promise<void> = async () => {},
): Promise<string[]> {
	const { events } = await dispatchObserved(
		vault,
		[
			{
				kind: VaultActionKind.RenameFolder,
				payload: {
					from: folder(["Library"], "Old"),
					to: folder(["Library"], "New"),
				},
			},
		],
		duringWindow,
	);
	return events;
}

/**
 * Starts VAM over `vault`, dispatches `actions`, runs `duringWindow` while
 * their Self Event windows are open, settles, and returns the outcomes and
 * every event subscribers received.
 */
async function dispatchObserved(
	vault: ReturnType<typeof makeVault>,
	actions: readonly VaultAction[],
	duringWindow: () => Promise<void> = async () => {},
) {
	const { dispose, manager, testing } = createVaultActionManager(vault.app);
	const bulks: BulkVaultEvent[] = [];
	try {
		const report = await Effect.runPromise(
			Effect.gen(function* () {
				yield* manager.startListening();
				yield* manager.subscribeToBulk((bulk) =>
					Effect.sync(() => {
						bulks.push(bulk);
					}),
				);
				const report = yield* manager.dispatchWithReport(actions, {
					caller: "test",
				});
				yield* Effect.promise(duringWindow);
				yield* testing.whenSettled();
				return report;
			}),
		);
		return {
			events: bulks.flatMap((bulk) => bulk.events.map(describeEvent)),
			outcomes: report.entries.map((entry) =>
				entry.status === "Done" ? entry.outcome : entry.status,
			),
		};
	} finally {
		await Effect.runPromise(dispose);
	}
}

const nestedLibrary = [
	"Library/Old/a.md",
	"Library/Old/Sub/b.md",
	"Library/Old/Sub/Inner/c.md",
];

describe("RenameFolder Self Events", () => {
	it("publishes none of the renames Obsidian reports for VAM's own folder rename, at any depth", async () => {
		const vault = makeVault(nestedLibrary);

		expect(await renameOldToNew(vault)).toEqual([]);
	});

	it("still publishes a file the user creates in the destination while the window is open", async () => {
		const vault = makeVault(nestedLibrary);

		const events = await renameOldToNew(vault, async () => {
			vault.createByHand("Library/New/Sub/user.md");
		});

		expect(events).toEqual(["FileCreated Library/New/Sub/user.md"]);
	});

	it("still publishes a user rename from elsewhere into the destination", async () => {
		const vault = makeVault([...nestedLibrary, "Inbox/note.md"]);

		const events = await renameOldToNew(vault, () =>
			vault.renameByHand("Inbox/note.md", "Library/New/Sub/note.md"),
		);

		expect(events).toEqual([
			"FileRenamed Inbox/note.md -> Library/New/Sub/note.md",
		]);
	});

	it("still publishes a rename out of the source to a different place under the destination", async () => {
		const vault = makeVault(nestedLibrary);

		const events = await renameOldToNew(vault, async () => {
			// The user recreates a note at the old location and moves it.
			vault.seed("Library/Old/late.md");
			await vault.renameByHand(
				"Library/Old/late.md",
				"Library/New/Sub/late.md",
			);
		});

		expect(events).toEqual([
			"FileRenamed Library/Old/late.md -> Library/New/Sub/late.md",
		]);
	});
});

describe("Renames that land on an indexed destination (#175)", () => {
	const takenLibrary = [...nestedLibrary, "Library/New/kept.md"];
	const renameFolderToTaken: VaultAction = {
		kind: VaultActionKind.RenameFolder,
		payload: {
			from: folder(["Library"], "Old"),
			to: folder(["Library"], "New"),
		},
	};

	it("publishes none of the renames Obsidian reports for a folder moved to its indexed name", async () => {
		const vault = makeVault(takenLibrary);

		const { events, outcomes } = await dispatchObserved(vault, [
			renameFolderToTaken,
		]);

		expect(outcomes).toEqual([
			{ _tag: "RenamedToIndexed", to: folder(["Library"], "1_New") },
		]);
		expect(events).toEqual([]);
	});

	it("still publishes a file the user creates in the indexed destination while the window is open", async () => {
		const vault = makeVault(takenLibrary);

		const { events } = await dispatchObserved(
			vault,
			[renameFolderToTaken],
			async () => {
				vault.createByHand("Library/1_New/Sub/user.md");
			},
		);

		expect(events).toEqual(["FileCreated Library/1_New/Sub/user.md"]);
	});

	it("still publishes a user rename into the planned destination, where nothing of VAM's lands", async () => {
		const vault = makeVault([...takenLibrary, "Inbox/note.md"]);

		const { events } = await dispatchObserved(
			vault,
			[renameFolderToTaken],
			() => vault.renameByHand("Inbox/note.md", "Library/New/note.md"),
		);

		expect(events).toEqual([
			"FileRenamed Inbox/note.md -> Library/New/note.md",
		]);
	});

	it("publishes no event for a note moved to its indexed name", async () => {
		const vault = makeVault(["Library/a.md", "Library/b.md"]);

		const { events, outcomes } = await dispatchObserved(vault, [
			{
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: {
						basename: "a",
						extension: "md",
						kind: "MdFile",
						pathParts: ["Library"],
					},
					onCollision: "index",
					to: {
						basename: "b",
						extension: "md",
						kind: "MdFile",
						pathParts: ["Library"],
					},
				},
			},
		]);

		expect(outcomes).toEqual([
			{
				_tag: "RenamedToIndexed",
				to: {
					basename: "1_b",
					extension: "md",
					kind: "MdFile",
					pathParts: ["Library"],
				},
			},
		]);
		expect(events).toEqual([]);
	});
});
