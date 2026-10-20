import { describe, expect, it } from "bun:test";
import {
	type BulkMdModifyEvent,
	type BulkVaultEvent,
	createVaultActionManager,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	splitPathCodec,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { type App, type TAbstractFile, TFile, TFolder } from "obsidian";

const worter: SplitPathToFolder = {
	basename: "Worter",
	kind: "Folder",
	pathParts: [],
};

const hundPath: SplitPathToMdFile = {
	basename: "Hund",
	extension: "md",
	kind: "MdFile",
	pathParts: ["Worter"],
};

/** A vault whose writes fire Obsidian's modify callback before resolving. */
function makeVaultHarness() {
	const callbacks = new Map<string, (...args: never[]) => void>();
	const contents = new Map<string, string>();
	const byPath = new Map<string, TAbstractFile>();
	let clock = 100;

	const root = new TFolder();
	root.path = "Worter";
	root.name = "Worter";
	root.children = [];
	byPath.set(root.path, root);

	const addFile = (path: string, content: string) => {
		const file = new TFile();
		file.path = path;
		const name = path.split("/").at(-1) ?? path;
		file.extension = name.split(".").at(-1) ?? "";
		file.basename = name.slice(0, -(file.extension.length + 1));
		file.name = name;
		file.parent = root;
		file.stat = { ctime: 1, mtime: clock, size: content.length };
		root.children.push(file);
		byPath.set(path, file);
		contents.set(path, content);
		return file;
	};

	const write = (file: TFile, content: string) => {
		clock += 1;
		contents.set(file.path, content);
		file.stat = { ...file.stat, mtime: clock, size: content.length };
		callbacks.get("modify")?.(file as never);
	};

	const app = {
		fileManager: {
			renameFile: async () => {},
			trashFile: async () => {},
		},
		metadataCache: { getFirstLinkpathDest: () => null },
		vault: {
			create: async () => {
				throw new Error("not used");
			},
			createFolder: async () => root,
			getAbstractFileByPath: (path: string) => byPath.get(path) ?? null,
			getMarkdownFiles: () =>
				[...byPath.values()].filter(
					(file): file is TFile => file instanceof TFile,
				),
			modify: async (file: TFile, content: string) =>
				write(file, content),
			offref: () => {},
			on: (name: string, callback: (...args: never[]) => void) => {
				callbacks.set(name, callback);
				return { callback, name };
			},
			// Mirrors Obsidian: write, and fire modify, only on a change.
			process: async (file: TFile, fn: (content: string) => string) => {
				const read = contents.get(file.path) ?? "";
				const next = fn(read);
				if (next !== read) write(file, next);
				return next;
			},
			read: async (file: TFile) => contents.get(file.path) ?? "",
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
		addFile,
		app,
		/** A note Obsidian reports as created, which VAM did not create. */
		createByHand: (path: string, content: string) =>
			callbacks.get("create")?.(addFile(path, content) as never),
		/** An edit Obsidian reports but VAM did not make. */
		editByHand: (file: TFile, content: string) => write(file, content),
	};
}

describe("VaultActionManager Markdown modifications", () => {
	it("delivers hand edits below the folder once and filters VAM's own writes", async () => {
		const harness = makeVaultHarness();
		const hund = harness.addFile("Worter/Hund.md", "# Hund");
		const outside = harness.addFile("Notes/Other.md", "# Other");
		const { dispose, manager, testing } = createVaultActionManager(
			harness.app,
		);
		const received: BulkMdModifyEvent[] = [];

		await Effect.runPromise(
			Effect.gen(function* () {
				yield* manager.startListening();
				yield* manager.subscribeToMdModifications(worter, (event) =>
					Effect.sync(() => {
						received.push(event);
					}),
				);

				const append = (suffix: string) =>
					manager.dispatch([
						{
							kind: VaultActionKind.ProcessMdFile,
							payload: {
								splitPath: hundPath,
								transform: (content) =>
									`${content}\n\n${suffix}`,
							},
						},
					]);
				yield* append("first VAM write");
				yield* append("second VAM write");
				yield* testing.whenSettled();
				expect(received).toEqual([]);

				harness.editByHand(hund, "# Hund\n\nhand edit");
				harness.editByHand(hund, "# Hund\n\nhand edit, again");
				harness.editByHand(outside, "# Other\n\nignored");
				yield* testing.whenSettled();
			}),
		);

		expect(received).toHaveLength(1);
		expect(received[0]?.modifications).toEqual([
			{
				splitPath: hundPath,
				stat: {
					ctime: 1,
					mtime: hund.stat.mtime,
					size: "# Hund\n\nhand edit, again".length,
				},
			},
		]);
		await Effect.runPromise(dispose);
	});

	it("exposes stats on reads and stat scans without changing scan", async () => {
		const harness = makeVaultHarness();
		harness.addFile("Worter/Hund.md", "# Hund");
		harness.addFile("Worter/picture.png", "png");
		const { dispose, manager } = createVaultActionManager(harness.app);

		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const read = yield* manager.readContentWithStat(hundPath);
				const plain = yield* manager.scan(worter);
				const withStat = yield* manager.scanWithStat(worter);
				return { plain, read, withStat };
			}),
		);

		expect(result.read).toEqual({
			content: "# Hund",
			stat: { ctime: 1, mtime: 100, size: 6 },
		});
		expect(result.plain.entries.some((entry) => "stat" in entry)).toBe(
			false,
		);
		expect(result.withStat.kind).toBe("Complete");
		expect(
			result.withStat.entries.map((entry) => [
				splitPathCodec.format(entry),
				entry.stat,
			]),
		).toEqual([
			["Worter/Hund.md", { ctime: 1, mtime: 100, size: 6 }],
			["Worter/picture.png", { ctime: 1, mtime: 100, size: 3 }],
		]);
		const markdown = result.withStat.entries.find(
			(entry) => entry.kind === "MdFile",
		);
		expect(
			markdown && "read" in markdown
				? await Effect.runPromise(markdown.read())
				: null,
		).toBe("# Hund");
		await Effect.runPromise(dispose);
	});

	it("reports a file without a stat as a scanFile diagnostic", async () => {
		const harness = makeVaultHarness();
		const broken = harness.addFile("Worter/Broken.md", "x");
		harness.addFile("Worter/Hund.md", "# Hund");
		(broken as { stat: unknown }).stat = undefined;
		const { dispose, manager } = createVaultActionManager(harness.app);

		const scan = await Effect.runPromise(manager.scanWithStat(worter));

		expect(scan.kind).toBe("Partial");
		expect(scan.entries.map(splitPathCodec.format)).toEqual([
			"Worter/Hund.md",
		]);
		expect(scan.diagnostics[0]?.operation).toBe("scanFile");
		expect(scan.diagnostics[0]?.path).toBe("Worter/Broken.md");
		await Effect.runPromise(dispose);
	});
});

describe("VaultActionManager Bulk Vault Events beside a modify subscriber", () => {
	async function observeBulk(withModifySubscriber: boolean) {
		const harness = makeVaultHarness();
		const hund = harness.addFile("Worter/Hund.md", "# Hund");
		const { dispose, manager, testing } = createVaultActionManager(
			harness.app,
		);
		const bulk: BulkVaultEvent[] = [];
		const modified: BulkMdModifyEvent[] = [];

		await Effect.runPromise(
			Effect.gen(function* () {
				yield* manager.startListening();
				yield* manager.subscribeToBulk((event) =>
					Effect.sync(() => {
						bulk.push(event);
					}),
				);
				if (withModifySubscriber) {
					yield* manager.subscribeToMdModifications(worter, (event) =>
						Effect.sync(() => {
							modified.push(event);
						}),
					);
				}

				harness.createByHand("Worter/Maus.md", "# Maus");
				harness.editByHand(hund, "# Hund\n\nhand edit");
				yield* testing.whenSettled();
			}),
		);
		await Effect.runPromise(dispose);
		return {
			bulk: bulk.map(({ events, roots }) => ({ events, roots })),
			modified: modified.flatMap((event) =>
				event.modifications.map(({ splitPath }) =>
					splitPathCodec.format(splitPath),
				),
			),
		};
	}

	it("publishes the same Bulk Vault Events with or without a modify subscriber", async () => {
		const without = await observeBulk(false);
		const withModify = await observeBulk(true);

		expect(without.bulk).toHaveLength(1);
		expect(without.bulk[0]?.events).toHaveLength(1);
		expect(withModify.bulk).toEqual(without.bulk);
		expect(withModify.modified).toEqual(["Worter/Hund.md"]);
	});
});
