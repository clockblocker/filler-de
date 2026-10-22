import { describe, expect, it } from "bun:test";
import {
	createVaultActionManager,
	type DispatchOrUndoOptions,
	dispatchOrUndoVia,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	splitPathCodec,
	type VamUndoPort,
	VamUndoReport,
	type VaultAction,
	VaultActionKind,
	vaultContentHash,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import type { TAbstractFile, TFile } from "obsidian";
import { makeVaultHarness } from "./helpers/vault-harness";

const md = (path: string) => splitPathCodec.parse(path) as SplitPathToMdFile;
const folder = (path: string) =>
	splitPathCodec.parse(path) as SplitPathToFolder;

const STOP = "Library/stop.md";

function setup() {
	const harness = makeVaultHarness();
	const { dispose, manager } = createVaultActionManager(harness.app, {
		fileSystem: { caseInsensitive: true },
	});
	const vault = harness.app.vault as unknown as {
		create: (path: string, content: string) => Promise<TFile>;
		getAbstractFileByPath: (path: string) => TAbstractFile | null;
	};
	const fileManager = harness.app.fileManager as unknown as {
		renameFile: (file: TAbstractFile, toPath: string) => Promise<void>;
	};
	const fileAt = (path: string) => vault.getAbstractFileByPath(path) as TFile;
	/**
	 * An action that fails as `conflict` after the ones before it ran,
	 * running `meanwhile` just before, as another writer would.
	 */
	const stop = (meanwhile?: () => void, at = STOP): VaultAction => {
		harness.addFile(at, "stop");
		harness.hooks.beforeProcess = (file) => {
			if (file.path !== at) return;
			harness.hooks.beforeProcess = undefined;
			meanwhile?.();
		};
		return swap(at, "not what it holds", "never");
	};
	/** The failure of a batch that must fail, after its undo. */
	const undoing = async (
		actions: readonly VaultAction[],
		options: Omit<DispatchOrUndoOptions, "caller"> = {},
	) => {
		const failure = await Effect.runPromise(
			manager
				.dispatchOrUndo(actions, { caller: "test", ...options })
				.pipe(Effect.flip),
		);
		await Effect.runPromise(dispose);
		const { undo } = failure.report;
		if (!undo) throw new Error("dispatchOrUndo answered no undo report");
		return { failure, undo };
	};
	return {
		dispose,
		fileAt,
		fileManager,
		harness,
		manager,
		stop,
		undoing,
		vault,
	};
}

const createMd = (path: string, content: string): VaultAction => ({
	kind: VaultActionKind.CreateMdFile,
	payload: { content, splitPath: md(path) },
});

const swap = (path: string, expected: string, next: string): VaultAction => ({
	kind: VaultActionKind.ProcessMdFile,
	payload: { expected, splitPath: md(path), transform: () => next },
});

const renameMd = (
	from: string,
	to: string,
	onCollision?: "fail" | "index" | "dedupe",
): VaultAction => ({
	kind: VaultActionKind.RenameMdFile,
	payload: {
		from: md(from),
		to: md(to),
		...(onCollision ? { onCollision } : {}),
	},
});

const trash = (path: string): VaultAction => ({
	kind: VaultActionKind.TrashMdFile,
	payload: { splitPath: md(path) },
});

function blocks(undo: VamUndoReport) {
	return undo.couldNotUndo.map(({ action, block }) => [action.kind, block]);
}

function kinds(entries: readonly { readonly action: VaultAction }[]) {
	return entries.map(({ action }) => action.kind);
}

describe("dispatchOrUndo", () => {
	it("answers the report and undoes nothing when the batch succeeds", async () => {
		const { dispose, harness, manager } = setup();
		const report = await Effect.runPromise(
			manager.dispatchOrUndo([createMd("Library/new.md", "fresh")], {
				caller: "test",
			}),
		);
		await Effect.runPromise(dispose);
		expect(report.undo).toBeUndefined();
		expect(report.executed.map((action) => action.kind)).toContain(
			VaultActionKind.CreateMdFile,
		);
		expect(harness.contents.get("Library/new.md")).toBe("fresh");
	});

	it("keeps the batch's failure and report, adding the undo", async () => {
		const { stop, undoing } = setup();
		const { failure } = await undoing([
			createMd("Library/new.md", "fresh"),
			stop(),
		]);
		expect(failure.reason._tag).toBe("VamDispatchError");
		expect(failure.report.entries.map((entry) => entry.status)).toEqual([
			"Done",
			"Failed",
		]);
		expect(failure.report.failed[0]?.kind).toBe("conflict");
	});

	it("runs the inverses under the batch's own caller and operation", async () => {
		const { dispose, harness, manager, stop } = setup();
		const batches: { caller: string; operationId?: string }[] = [];
		const port: VamUndoPort = {
			dispatchWithReport: (actions, options) => {
				batches.push({
					caller: options.caller,
					operationId: options.operationId,
				});
				return manager.dispatchWithReport(actions, options);
			},
			exists: (path) => manager.exists(path),
			readContent: (path) => manager.readContent(path),
		};
		harness.addFile("Library/a.md", "A");
		const failure = await Effect.runPromise(
			dispatchOrUndoVia(
				port,
				[
					createMd("Library/new.md", "fresh"),
					renameMd("Library/a.md", "Library/b.md"),
					stop(),
				],
				{ caller: "librarian" },
			).pipe(Effect.flip),
		);
		await Effect.runPromise(dispose);
		expect(failure.report.undo?.undone).toHaveLength(2);
		const [forward, ...inverses] = batches;
		expect(forward).toEqual({
			caller: "librarian",
			operationId: undefined,
		});
		expect(inverses).toEqual([
			{ caller: "librarian", operationId: failure.report.operationId },
			{ caller: "librarian", operationId: failure.report.operationId },
		]);
	});

	it("names one operation for the batch and its undo", async () => {
		const { stop, undoing } = setup();
		const { failure } = await undoing([
			createMd("Library/new.md", "fresh"),
			stop(),
		]);
		expect(failure.report.caller).toBe("test");
		expect(failure.report.operationId).toMatch(/^test#/);
	});

	it("undoes nothing for a batch VAM refused before running it", async () => {
		const harness = makeVaultHarness();
		harness.addFile("Exemplar/a.md", "kept");
		const { dispose, manager } = createVaultActionManager(harness.app, {
			fileSystem: { caseInsensitive: true },
			protectedPaths: ["Exemplar"],
		});
		const failure = await Effect.runPromise(
			manager
				.dispatchOrUndo([swap("Exemplar/a.md", "kept", "changed")], {
					caller: "test",
				})
				.pipe(Effect.flip),
		);
		await Effect.runPromise(dispose);
		expect(failure.reason._tag).toBe("VamProtectedPathError");
		expect(failure.report.undo).toEqual(VamUndoReport.empty);
		expect(harness.contents.get("Exemplar/a.md")).toBe("kept");
	});
});

describe("Created", () => {
	it("trashes a created note that still holds what it was created with", async () => {
		const { harness, stop, undoing } = setup();
		const { undo } = await undoing([
			createMd("Library/new.md", "fresh"),
			stop(),
		]);
		expect(undo.undone).toMatchObject([
			{
				action: { kind: VaultActionKind.CreateMdFile },
				inverse: {
					kind: VaultActionKind.TrashMdFile,
					payload: {
						ifContent: { hash: vaultContentHash("fresh") },
						splitPath: md("Library/new.md"),
					},
				},
			},
		]);
		expect(undo.complete).toBe(true);
		expect(harness.exists("Library/new.md")).toBe(false);
	});

	it("keeps a created note the user typed into", async () => {
		const { fileAt, harness, stop, undoing } = setup();
		const { undo } = await undoing([
			createMd("Library/new.md", "fresh"),
			stop(() => harness.editByHand(fileAt("Library/new.md"), "typed")),
		]);
		expect(undo.undone).toEqual([]);
		expect(blocks(undo)).toEqual([
			[VaultActionKind.CreateMdFile, "Changed"],
		]);
		expect(undo.couldNotUndo[0]?.error?._tag).toBe("VamDispatchError");
		expect(harness.contents.get("Library/new.md")).toBe("typed");
	});

	it("leaves a folder it created, and says so", async () => {
		const { harness, stop, undoing } = setup();
		harness.addFile("Library/kept.md", "");
		const { undo } = await undoing([
			createMd("Library/Fresh/new.md", "fresh"),
			// VAM runs deeper paths later.
			stop(undefined, "Other/Deeper/Still/stop.md"),
		]);
		expect(kinds(undo.undone)).toEqual([VaultActionKind.CreateMdFile]);
		expect(undo.notUndoable).toMatchObject([
			{
				action: {
					kind: VaultActionKind.CreateFolder,
					payload: { splitPath: folder("Library/Fresh") },
				},
				what: "Created",
			},
		]);
		expect(undo.complete).toBe(false);
		expect(harness.exists("Library/Fresh/new.md")).toBe(false);
		expect(harness.exists("Library/Fresh")).toBe(true);
	});
});

describe("Wrote", () => {
	it("restores the content the write replaced", async () => {
		const { harness, stop, undoing } = setup();
		harness.addFile("Library/a.md", "before");
		const { undo } = await undoing([
			swap("Library/a.md", "before", "after"),
			stop(),
		]);
		expect(undo.undone).toMatchObject([
			{
				inverse: {
					kind: VaultActionKind.ProcessMdFile,
					payload: { expected: { hash: vaultContentHash("after") } },
				},
			},
		]);
		expect(harness.contents.get("Library/a.md")).toBe("before");
	});

	it("keeps a written file the user changed since", async () => {
		const { fileAt, harness, stop, undoing } = setup();
		harness.addFile("Library/a.md", "before");
		const { undo } = await undoing([
			swap("Library/a.md", "before", "after"),
			stop(() => harness.editByHand(fileAt("Library/a.md"), "typed")),
		]);
		expect(blocks(undo)).toEqual([
			[VaultActionKind.ProcessMdFile, "Changed"],
		]);
		expect(harness.contents.get("Library/a.md")).toBe("typed");
	});

	it("cannot restore a file whose content was over the pre-image budget", async () => {
		const { harness, stop, undoing } = setup();
		harness.addFile("Library/a.md", "before");
		const { undo } = await undoing(
			[swap("Library/a.md", "before", "after"), stop()],
			{ maxPreImageChars: 3 },
		);
		expect(blocks(undo)).toEqual([
			[VaultActionKind.ProcessMdFile, "NoPreImage"],
		]);
		expect(harness.contents.get("Library/a.md")).toBe("after");
	});

	it("restores an upsert's overwrite, and trashes the file an upsert created", async () => {
		const { harness, stop, undoing } = setup();
		harness.addFile("Library/a.md", "before");
		const { undo } = await undoing([
			{
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "after", splitPath: md("Library/a.md") },
			},
			{
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "fresh", splitPath: md("Library/b.md") },
			},
			stop(),
		]);
		expect(undo.undone).toHaveLength(2);
		expect(harness.contents.get("Library/a.md")).toBe("before");
		expect(harness.exists("Library/b.md")).toBe(false);
	});
});

describe("Renamed", () => {
	it("renames back, failing rather than landing on a taken name", async () => {
		const { harness, stop, undoing } = setup();
		harness.addFile("Library/a.md", "A");
		const { undo } = await undoing([
			{
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: md("Library/a.md"),
					to: md("Library/b.md"),
					updateLinks: false,
				},
			},
			stop(),
		]);
		expect(undo.undone).toMatchObject([
			{
				inverse: {
					kind: VaultActionKind.RenameMdFile,
					payload: {
						from: md("Library/b.md"),
						onCollision: "fail",
						to: md("Library/a.md"),
						updateLinks: false,
					},
				},
			},
		]);
		expect(harness.contents.get("Library/a.md")).toBe("A");
		expect(harness.exists("Library/b.md")).toBe(false);
	});

	it("leaves a note whose old name was taken meanwhile", async () => {
		const { harness, stop, undoing } = setup();
		harness.addFile("Library/a.md", "A");
		const { undo } = await undoing([
			renameMd("Library/a.md", "Library/b.md"),
			stop(() => harness.addFile("Library/a.md", "other")),
		]);
		expect(blocks(undo)).toEqual([[VaultActionKind.RenameMdFile, "Taken"]]);
		expect(harness.contents.get("Library/a.md")).toBe("other");
		expect(harness.contents.get("Library/b.md")).toBe("A");
	});

	it("leaves a note the user moved on", async () => {
		const { fileAt, harness, stop, undoing } = setup();
		harness.addFile("Library/a.md", "A");
		const { undo } = await undoing([
			renameMd("Library/a.md", "Library/b.md"),
			stop(() => {
				const moved = fileAt("Library/b.md");
				harness.app.vault.rename(moved, "Library/c.md");
			}),
		]);
		expect(blocks(undo)).toEqual([
			[VaultActionKind.RenameMdFile, "Missing"],
		]);
		expect(harness.contents.get("Library/c.md")).toBe("A");
		expect(harness.exists("Library/a.md")).toBe(false);
	});

	it("renames back from the indexed name a collision moved the note to", async () => {
		const { harness, stop, undoing } = setup();
		harness.addFile("Library/a.md", "A");
		harness.addFile("Library/b.md", "B");
		const { failure, undo } = await undoing([
			renameMd("Library/a.md", "Library/b.md", "index"),
			stop(),
		]);
		expect(failure.report.entries[0]).toMatchObject({
			outcome: { _tag: "RenamedToIndexed", to: md("Library/1_b.md") },
		});
		expect(undo.undone).toMatchObject([
			{
				inverse: {
					payload: {
						from: md("Library/1_b.md"),
						to: md("Library/a.md"),
					},
				},
			},
		]);
		expect(harness.contents.get("Library/a.md")).toBe("A");
		expect(harness.contents.get("Library/b.md")).toBe("B");
		expect(harness.exists("Library/1_b.md")).toBe(false);
	});
});

describe("Trashed", () => {
	it("is reported as not undoable", async () => {
		const { harness, stop, undoing } = setup();
		harness.addFile("Library/t.md", "T");
		const { undo } = await undoing([trash("Library/t.md"), stop()]);
		expect(undo.notUndoable).toMatchObject([
			{ action: { kind: VaultActionKind.TrashMdFile }, what: "Trashed" },
		]);
		expect(undo.undone).toEqual([]);
		expect(undo.complete).toBe(false);
	});
});

describe("partial undo", () => {
	it("takes back what it can, newest first, and reports the rest", async () => {
		const { fileAt, harness, stop, undoing } = setup();
		harness.addFile("Library/a.md", "A");
		harness.addFile("Library/c.md", "before");
		const { undo } = await undoing([
			createMd("Library/new.md", "fresh"),
			renameMd("Library/a.md", "Library/b.md"),
			swap("Library/c.md", "before", "after"),
			stop(() => harness.editByHand(fileAt("Library/c.md"), "typed")),
		]);
		expect(kinds(undo.undone)).toEqual([
			VaultActionKind.RenameMdFile,
			VaultActionKind.CreateMdFile,
		]);
		expect(blocks(undo)).toEqual([
			[VaultActionKind.ProcessMdFile, "Changed"],
		]);
		expect(harness.exists("Library/new.md")).toBe(false);
		expect(harness.contents.get("Library/a.md")).toBe("A");
		expect(harness.contents.get("Library/c.md")).toBe("typed");
	});
});

describe("Uncertain", () => {
	it("probes a create that failed after landing, and trashes it", async () => {
		const { harness, undoing, vault } = setup();
		vault.create = async (path, content) => {
			const file = harness.addFile(path, content);
			if (path === "Library/new.md") throw new Error("disk hiccup");
			return file;
		};
		const { failure, undo } = await undoing([
			createMd("Library/new.md", "fresh"),
		]);
		expect(failure.report.uncertain).toHaveLength(1);
		expect(undo.probed).toMatchObject([
			{ action: { kind: VaultActionKind.CreateMdFile }, found: "Landed" },
		]);
		expect(kinds(undo.undone)).toEqual([VaultActionKind.CreateMdFile]);
		expect(harness.exists("Library/new.md")).toBe(false);
	});

	it("reports a create that did not land, inverting nothing", async () => {
		const { harness, undoing, vault } = setup();
		vault.create = async () => {
			throw new Error("disk hiccup");
		};
		const { undo } = await undoing([createMd("Library/new.md", "fresh")]);
		expect(undo.probed).toMatchObject([{ found: "NotLanded" }]);
		expect(undo.undone).toEqual([]);
		expect(undo.couldNotUndo).toEqual([]);
		expect(harness.writes).toEqual([]);
	});

	it("never inverts a rename the vault cannot explain", async () => {
		const { fileManager, harness, undoing } = setup();
		harness.addFile("Library/a.md", "A");
		fileManager.renameFile = async (_file, toPath) => {
			harness.addFile(toPath, "half-copied");
			throw new Error("EBUSY");
		};
		const { undo } = await undoing([
			renameMd("Library/a.md", "Library/b.md"),
		]);
		expect(undo.probed).toMatchObject([{ found: "Unknown" }]);
		expect(blocks(undo)).toEqual([
			[VaultActionKind.RenameMdFile, "Unknown"],
		]);
		expect(harness.contents.get("Library/a.md")).toBe("A");
		expect(harness.contents.get("Library/b.md")).toBe("half-copied");
	});

	it("probes an inverse that ends uncertain too", async () => {
		const { fileManager, harness, stop, undoing } = setup();
		harness.addFile("Library/a.md", "A");
		const rename = fileManager.renameFile;
		const { undo } = await undoing([
			renameMd("Library/a.md", "Library/b.md"),
			stop(() => {
				// The rename back moves the note, then fails.
				fileManager.renameFile = async (file, toPath) => {
					await rename(file, toPath);
					throw new Error("selection restore failed");
				};
			}),
		]);
		expect(kinds(undo.undone)).toEqual([VaultActionKind.RenameMdFile]);
		expect(harness.contents.get("Library/a.md")).toBe("A");
	});
});
