import { describe, expect, it } from "bun:test";
import {
	createVaultActionManager,
	type DispatchOrUndoOptions,
	dispatchOrUndoVia,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	splitPathCodec,
	VamDispatchError,
	VamDispatchFailure,
	VamDispatchReport,
	type VamUndoPort,
	VamUndoReport,
	type VaultAction,
	VaultActionKind,
	vaultContentHash,
} from "@textfresser/vault-action-manager";
import { Cause, Effect, Exit } from "effect";
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

/**
 * A VAM whose worker is held by another batch's rename, so that a batch
 * `dispatchOrUndo` submits waits in the queue. `undoing` runs `meanwhile`
 * once the batch is submitted, after `dispatchOrUndo` looked the vault up,
 * then lets the queue run.
 */
function queuedBehindAnotherBatch() {
	const context = setup();
	const { fileManager, harness, manager } = context;
	harness.addFile("Library/held.md", "held");
	const undoing = async (
		actions: readonly VaultAction[],
		meanwhile: () => unknown,
	) => {
		const held = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		const rename = fileManager.renameFile;
		fileManager.renameFile = async (file, toPath) => {
			if (file.path !== "Library/held.md") return rename(file, toPath);
			held.resolve();
			await release.promise;
			return rename(file, toPath);
		};
		const earlier = Effect.runPromise(
			manager.dispatch(
				[renameMd("Library/held.md", "Library/released.md")],
				{ caller: "other" },
			),
		);
		await held.promise;
		const submitted = Promise.withResolvers<void>();
		const port: VamUndoPort = {
			dispatchWithReport: (batch, options) => {
				if (options.stopOnFirstFailure) submitted.resolve();
				return manager.dispatchWithReport(batch, options);
			},
			exists: (path) => manager.exists(path),
			readContent: (path) => manager.readContent(path),
		};
		const failing = Effect.runPromise(
			dispatchOrUndoVia(port, actions, { caller: "test" }).pipe(
				Effect.flip,
			),
		);
		await submitted.promise;
		meanwhile();
		release.resolve();
		await earlier;
		const failure = await failing;
		await Effect.runPromise(context.dispose);
		const { undo } = failure.report;
		if (!undo) throw new Error("dispatchOrUndo answered no undo report");
		return { failure, undo };
	};
	return { ...context, undoing };
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

const emptyUndo = new VamUndoReport({
	couldNotUndo: [],
	notUndoable: [],
	probed: [],
	undone: [],
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

	it("keeps a defect beside the batch's failure, after the failure with its undo", async () => {
		const { dispose, harness, manager, stop } = setup();
		const port: VamUndoPort = {
			dispatchWithReport: (actions, options) =>
				options.stopOnFirstFailure
					? manager
							.dispatchWithReport(actions, options)
							.pipe(
								Effect.ensuring(
									Effect.die(new Error("finalizer exploded")),
								),
							)
					: manager.dispatchWithReport(actions, options),
			exists: (path) => manager.exists(path),
			readContent: (path) => manager.readContent(path),
		};
		const exit = await Effect.runPromise(
			Effect.exit(
				dispatchOrUndoVia(
					port,
					[createMd("Library/new.md", "fresh"), stop()],
					{ caller: "test" },
				),
			),
		);
		await Effect.runPromise(dispose);
		if (!Exit.isFailure(exit)) throw new Error("dispatchOrUndo succeeded");
		const [first, ...others] = exit.cause.reasons;
		if (!first || !Cause.isFailReason(first))
			throw new Error("the cause's first reason is not a failure");
		// What callers branch on is the batch's failure, with its undo.
		expect(first.error.reason._tag).toBe("VamDispatchError");
		expect(first.error.report.undo?.undone).toHaveLength(1);
		expect(harness.exists("Library/new.md")).toBe(false);
		expect(
			others.map((reason) =>
				Cause.isDieReason(reason) ? String(reason.defect) : reason._tag,
			),
		).toEqual(["Error: finalizer exploded"]);
	});

	it("keeps a defect beside an inverse's failure", async () => {
		const { dispose, manager, stop } = setup();
		const port: VamUndoPort = {
			dispatchWithReport: (actions, options) => {
				if (options.stopOnFirstFailure)
					return manager.dispatchWithReport(actions, options);
				const [inverse] = actions;
				if (!inverse) throw new Error("an inverse batch is one action");
				const failure = VamDispatchFailure.ofReport(
					new VamDispatchReport({
						caller: options.caller,
						entries: [
							{
								action: inverse,
								error: new VamDispatchError({
									action: inverse,
									cause: new Error("typed into meanwhile"),
									kind: "conflict",
									operation: "dispatch",
								}),
								status: "Failed",
							},
						],
						operationId: options.operationId ?? "test#inverse",
					}),
				);
				if (!failure)
					throw new Error("the inverse's report failed nothing");
				return Effect.fail(failure).pipe(
					Effect.ensuring(
						Effect.die(new Error("inverse finalizer exploded")),
					),
				);
			},
			exists: (path) => manager.exists(path),
			readContent: (path) => manager.readContent(path),
		};
		const exit = await Effect.runPromise(
			Effect.exit(
				dispatchOrUndoVia(
					port,
					[createMd("Library/new.md", "fresh"), stop()],
					{ caller: "test" },
				),
			),
		);
		await Effect.runPromise(dispose);
		if (!Exit.isFailure(exit)) throw new Error("dispatchOrUndo succeeded");
		const failures = exit.cause.reasons.filter(Cause.isFailReason);
		// The inverse's failure is in the undo report, not beside it.
		expect(failures).toHaveLength(1);
		expect(blocks(failures[0]?.error.report.undo ?? emptyUndo)).toEqual([
			[VaultActionKind.CreateMdFile, "Changed"],
		]);
		expect(
			exit.cause.reasons
				.filter(Cause.isDieReason)
				.map(({ defect }) => String(defect)),
		).toEqual(["Error: inverse finalizer exploded"]);
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

describe("what was there before the batch", () => {
	it("never moves back a note that held the target before an uncertain indexed rename", async () => {
		const { fileManager, harness, undoing } = setup();
		harness.addFile("Library/a.md", "A");
		harness.addFile("Library/b.md", "theirs");
		const rename = fileManager.renameFile;
		fileManager.renameFile = async (file, toPath) => {
			await rename(file, toPath);
			throw new Error("selection restore failed");
		};
		const { undo } = await undoing([
			renameMd("Library/a.md", "Library/b.md", "index"),
		]);
		expect(undo.probed).toMatchObject([{ found: "Unknown" }]);
		expect(undo.undone).toEqual([]);
		expect(harness.contents.get("Library/b.md")).toBe("theirs");
		expect(harness.contents.get("Library/1_b.md")).toBe("A");
		expect(harness.exists("Library/a.md")).toBe(false);
	});

	it.each(["index", "dedupe"] as const)(
		"never moves back a note that reached the target of an onCollision %s rename while the batch was queued",
		async (onCollision) => {
			const queue = queuedBehindAnotherBatch();
			const { fileManager, harness } = queue;
			harness.addFile("Library/a.md", "A");
			const rename = fileManager.renameFile;
			fileManager.renameFile = async (file, toPath) => {
				await rename(file, toPath);
				if (toPath === "Library/1_b.md")
					throw new Error("selection restore failed");
			};
			const { failure, undo } = await queue.undoing(
				[renameMd("Library/a.md", "Library/b.md", onCollision)],
				// Arrives after the batch was submitted, before it runs.
				() => harness.addFile("Library/b.md", "theirs"),
			);
			expect(failure.report.entries).toMatchObject([
				{ status: "Uncertain", targetTaken: true },
			]);
			expect(undo.probed).toMatchObject([{ found: "Unknown" }]);
			expect(undo.undone).toEqual([]);
			expect(blocks(undo)).toEqual([
				[VaultActionKind.RenameMdFile, "Unknown"],
			]);
			expect(harness.contents.get("Library/b.md")).toBe("theirs");
			expect(harness.contents.get("Library/1_b.md")).toBe("A");
			expect(harness.exists("Library/a.md")).toBe(false);
		},
	);

	it("renames back a note whose target was freed while the batch was queued", async () => {
		const queue = queuedBehindAnotherBatch();
		const { fileAt, fileManager, harness } = queue;
		harness.addFile("Library/a.md", "A");
		harness.addFile("Library/b.md", "theirs");
		const rename = fileManager.renameFile;
		fileManager.renameFile = async (file, toPath) => {
			await rename(file, toPath);
			if (toPath === "Library/b.md")
				throw new Error("selection restore failed");
		};
		const { failure, undo } = await queue.undoing(
			[renameMd("Library/a.md", "Library/b.md")],
			() =>
				harness.app.vault.rename(
					fileAt("Library/b.md"),
					"Library/moved.md",
				),
		);
		expect(failure.report.entries).toMatchObject([
			{ status: "Uncertain", targetTaken: false },
		]);
		expect(undo.probed).toMatchObject([{ found: "Landed" }]);
		expect(kinds(undo.undone)).toEqual([VaultActionKind.RenameMdFile]);
		expect(harness.contents.get("Library/a.md")).toBe("A");
		expect(harness.contents.get("Library/moved.md")).toBe("theirs");
		expect(harness.exists("Library/b.md")).toBe(false);
	});

	it("counts a target taken by another case of its name while the batch was queued", async () => {
		const queue = queuedBehindAnotherBatch();
		const { fileManager, harness } = queue;
		harness.addFile("Library/a.md", "A");
		const rename = fileManager.renameFile;
		fileManager.renameFile = async (file, toPath) => {
			await rename(file, toPath);
			if (toPath === "Library/1_b.md")
				throw new Error("selection restore failed");
		};
		const { failure, undo } = await queue.undoing(
			[renameMd("Library/a.md", "Library/b.md", "index")],
			() => harness.addFile("Library/B.md", "theirs"),
		);
		expect(failure.report.entries).toMatchObject([
			{ status: "Uncertain", targetTaken: true },
		]);
		expect(undo.probed).toMatchObject([{ found: "Unknown" }]);
		expect(undo.undone).toEqual([]);
		expect(harness.contents.get("Library/B.md")).toBe("theirs");
		expect(harness.contents.get("Library/1_b.md")).toBe("A");
	});

	it("never moves back a note that reached the target while the rename read a protected file ahead of its move", async () => {
		const harness = makeVaultHarness();
		const { dispose, manager } = createVaultActionManager(harness.app, {
			fileSystem: { caseInsensitive: true },
			protectedPaths: ["Exemplar"],
		});
		harness.addFile("Library/a.md", "A");
		harness.addFile("Exemplar/x.md", "[[a]]");
		harness.resolvedLinks["Exemplar/x.md"] = { "Library/a.md": 1 };
		const vault = harness.app.vault as unknown as {
			read: (file: TFile) => Promise<string>;
		};
		const read = vault.read;
		vault.read = async (file) => {
			// Arrives while VAM reads the exemplar's pre-image, after the
			// batch began and before the move.
			if (
				file.path === "Exemplar/x.md" &&
				!harness.exists("Library/b.md")
			)
				harness.addFile("Library/b.md", "theirs");
			return read(file);
		};
		const fileManager = harness.app.fileManager as unknown as {
			renameFile: (file: TAbstractFile, toPath: string) => Promise<void>;
		};
		const rename = fileManager.renameFile;
		fileManager.renameFile = async (file, toPath) => {
			await rename(file, toPath);
			if (toPath === "Library/1_b.md")
				throw new Error("selection restore failed");
		};
		const failure = await Effect.runPromise(
			manager
				.dispatchOrUndo(
					[renameMd("Library/a.md", "Library/b.md", "index")],
					{ caller: "test" },
				)
				.pipe(Effect.flip),
		);
		await Effect.runPromise(dispose);
		expect(failure.report.entries).toMatchObject([
			{ status: "Uncertain", targetTaken: true },
		]);
		expect(failure.report.undo?.probed).toMatchObject([
			{ found: "Unknown" },
		]);
		expect(failure.report.undo?.undone).toEqual([]);
		expect(harness.contents.get("Library/b.md")).toBe("theirs");
		expect(harness.contents.get("Library/1_b.md")).toBe("A");
		expect(harness.exists("Library/a.md")).toBe(false);
	});

	it("never trashes a note that was there before, when the dispatch dies", async () => {
		const files = new Map([["Library/kept.md", "same"]]);
		const inverses: VaultAction[] = [];
		const port: VamUndoPort = {
			dispatchWithReport: (actions, { stopOnFirstFailure }) => {
				if (!stopOnFirstFailure) inverses.push(...actions);
				return Effect.die(new Error("dispatch exploded"));
			},
			exists: (path) =>
				Effect.succeed(files.has(splitPathCodec.format(path))),
			readContent: (path) =>
				Effect.succeed(files.get(splitPathCodec.format(path)) ?? ""),
		};
		const failure = await Effect.runPromise(
			dispatchOrUndoVia(port, [createMd("Library/kept.md", "same")], {
				caller: "test",
			}).pipe(Effect.flip),
		);
		expect(failure.report.undo?.probed).toMatchObject([
			{ found: "NotLanded" },
		]);
		expect(inverses).toEqual([]);
	});
});
