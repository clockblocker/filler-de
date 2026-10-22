import { describe, expect, it } from "bun:test";
import {
	createVaultActionManager,
	isContentConflict,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	splitPathCodec,
	VamContentConflictError,
	type VamDispatchEntry,
	VamDispatchError,
	VamTargetExistsError,
	type VaultAction,
	VaultActionKind,
	vaultContentHash,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import type { TFile } from "obsidian";
import { OpenViewsDisagree } from "../../src/file-services/content-route";
import { makeVaultHarness } from "./helpers/vault-harness";

const md = (path: string) => splitPathCodec.parse(path) as SplitPathToMdFile;
const folder = (path: string) =>
	splitPathCodec.parse(path) as SplitPathToFolder;

function setup({ insensitive = true } = {}) {
	const harness = makeVaultHarness({ insensitive });
	const { dispose, manager } = createVaultActionManager(harness.app, {
		fileSystem: { caseInsensitive: insensitive },
	});
	/** The batch's report entries, whether it failed or not. */
	const entries = (actions: readonly VaultAction[]) =>
		Effect.runPromise(
			manager.dispatchWithReport(actions, { caller: "test" }).pipe(
				Effect.map((report) => report.entries),
				Effect.catchTag("VamDispatchFailure", (failure) =>
					Effect.succeed(failure.report.entries),
				),
			),
		);
	/** The entry of `action`, leaving out parent folders VAM added. */
	const run = async (action: VaultAction) => {
		const entry = (await entries([action])).find(
			(candidate) => candidate.action.kind === action.kind,
		);
		if (!entry) throw new Error("no report entry");
		return entry;
	};
	return { dispose, entries, harness, manager, run };
}

function failure(entry: VamDispatchEntry): VamDispatchError {
	if (entry.status !== "Failed")
		throw new Error(`Expected Failed, got ${entry.status}`);
	expect(entry.error).toBeInstanceOf(VamDispatchError);
	return entry.error;
}

const createMd = (path: string, content: string): VaultAction => ({
	kind: VaultActionKind.CreateMdFile,
	payload: { content, splitPath: md(path) },
});

const swap = (
	path: string,
	expected: string | { hash: string },
	next: string,
): VaultAction => ({
	kind: VaultActionKind.ProcessMdFile,
	payload: { expected, splitPath: md(path), transform: () => next },
});

const trashIf = (
	path: string,
	ifContent: string | { hash: string },
): VaultAction => ({
	kind: VaultActionKind.TrashMdFile,
	payload: { ifContent, splitPath: md(path) },
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

describe("CreateMdFile", () => {
	it("creates the file where none is", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/other.md", "other");
		const entry = await run(createMd("Library/note.md", "fresh"));
		await Effect.runPromise(dispose);
		expect(entry).toMatchObject({
			outcome: {
				_tag: "Created",
				contentHash: vaultContentHash("fresh"),
			},
			status: "Done",
		});
		expect(harness.contents.get("Library/note.md")).toBe("fresh");
	});

	it("fails with exists over a file that is there, writing nothing", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/note.md", "mine");
		const entry = await run(createMd("Library/note.md", "fresh"));
		await Effect.runPromise(dispose);
		const error = failure(entry);
		expect(error.kind).toBe("exists");
		expect(error.cause).toBeInstanceOf(VamTargetExistsError);
		expect(harness.contents.get("Library/note.md")).toBe("mine");
		expect(harness.writes).toEqual([]);
	});

	it("fails over a case variant where the file system ignores case, and creates where it does not", async () => {
		const insensitive = setup();
		insensitive.harness.addFile("Library/Note.md", "mine");
		const refused = await insensitive.run(createMd("Library/note.md", "x"));
		await Effect.runPromise(insensitive.dispose);
		expect(failure(refused).kind).toBe("exists");
		expect(
			(failure(refused).cause as VamTargetExistsError).occupiedBy,
		).toBe("Library/Note.md");
		expect(insensitive.harness.exists("Library/note.md")).toBe(false);

		const sensitive = setup({ insensitive: false });
		sensitive.harness.addFile("Library/Note.md", "mine");
		const created = await sensitive.run(createMd("Library/note.md", "x"));
		await Effect.runPromise(sensitive.dispose);
		expect(created.status).toBe("Done");
	});

	it("fails with exists when a file appears between the check and the create", async () => {
		const { dispose, harness, run } = setup();
		const vault = harness.app.vault as unknown as {
			create: (path: string, content: string) => Promise<TFile>;
		};
		vault.create = async (path) => {
			harness.addFile(path, "raced in");
			throw new Error("File already exists.");
		};
		const entry = await run(createMd("Library/note.md", "fresh"));
		await Effect.runPromise(dispose);
		expect(failure(entry).kind).toBe("exists");
		expect(harness.contents.get("Library/note.md")).toBe("raced in");
	});

	it("creates a later transform's content in the same batch", async () => {
		const { dispose, entries, harness } = setup();
		const report = await entries([
			createMd("Library/note.md", "fresh"),
			{
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: md("Library/note.md"),
					transform: (content) => `${content}!`,
				},
			},
		]);
		await Effect.runPromise(dispose);
		expect(report.map((entry) => entry.action.kind)).toEqual([
			VaultActionKind.CreateFolder,
			VaultActionKind.CreateMdFile,
		]);
		expect(harness.contents.get("Library/note.md")).toBe("fresh!");
	});
});

describe("ProcessMdFile expected", () => {
	it("writes when the file holds the expected content or its hash", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/a.md", "before");
		harness.addFile("Library/b.md", "before");
		const byContent = await run(swap("Library/a.md", "before", "after"));
		const byHash = await run(
			swap("Library/b.md", { hash: vaultContentHash("before") }, "after"),
		);
		await Effect.runPromise(dispose);
		for (const entry of [byContent, byHash])
			expect(entry).toMatchObject({
				outcome: {
					_tag: "Wrote",
					afterHash: vaultContentHash("after"),
					beforeHash: vaultContentHash("before"),
				},
				status: "Done",
			});
		expect(harness.contents.get("Library/a.md")).toBe("after");
		expect(harness.contents.get("Library/b.md")).toBe("after");
	});

	it("fails with conflict, writing nothing, when the file holds other content", async () => {
		const { dispose, harness, manager } = setup();
		harness.addFile("Library/a.md", "edited by hand");
		const failed = await Effect.runPromise(
			manager
				.dispatchWithReport([swap("Library/a.md", "before", "after")], {
					caller: "test",
				})
				.pipe(Effect.flip),
		);
		await Effect.runPromise(dispose);
		const [entry] = failed.report.entries;
		if (!entry) throw new Error("no entry");
		const error = failure(entry);
		expect(error.kind).toBe("conflict");
		expect(error.cause).toBeInstanceOf(VamContentConflictError);
		expect(isContentConflict(failed)).toBe(true);
		expect(harness.contents.get("Library/a.md")).toBe("edited by hand");
		expect(harness.writes).toEqual([]);
	});

	it("checks inside the write: an edit that lands as the write starts is kept", async () => {
		const { dispose, harness, run } = setup();
		const file = harness.addFile("Library/a.md", "before");
		// The caller read "before" and planned; the user types just as
		// Vault.process reads the file.
		harness.hooks.beforeProcess = () => {
			harness.hooks.beforeProcess = undefined;
			harness.editByHand(file, "typed meanwhile");
		};
		const entry = await run(swap("Library/a.md", "before", "after"));
		await Effect.runPromise(dispose);
		expect(failure(entry).kind).toBe("conflict");
		expect(harness.contents.get("Library/a.md")).toBe("typed meanwhile");
	});

	it("checks a before/after replacement too", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/a.md", "x before y");
		const entry = await run({
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				after: "after",
				before: "before",
				expected: "something else",
				splitPath: md("Library/a.md"),
			},
		});
		await Effect.runPromise(dispose);
		expect(failure(entry).kind).toBe("conflict");
		expect(harness.contents.get("Library/a.md")).toBe("x before y");
	});

	it("checks each composed transform against the content it receives", async () => {
		const { dispose, entries, harness } = setup();
		harness.addFile("Library/a.md", "one");
		const passing = await entries([
			swap("Library/a.md", "one", "two"),
			swap("Library/a.md", "two", "three"),
		]);
		expect(passing.map((entry) => entry.status)).toEqual(["Done"]);
		expect(harness.contents.get("Library/a.md")).toBe("three");

		const failing = await entries([
			swap("Library/a.md", "three", "four"),
			swap("Library/a.md", "three", "five"),
		]);
		await Effect.runPromise(dispose);
		expect(failing.map((entry) => entry.status)).toEqual(["Failed"]);
		expect(harness.contents.get("Library/a.md")).toBe("three");
	});
});

describe("TrashMdFile ifContent", () => {
	it("trashes a file that holds the content, by content or hash", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/a.md", "read");
		harness.addFile("Library/b.md", "read");
		const byContent = await run(trashIf("Library/a.md", "read"));
		const byHash = await run(
			trashIf("Library/b.md", { hash: vaultContentHash("read") }),
		);
		await Effect.runPromise(dispose);
		expect(byContent).toMatchObject({
			outcome: { _tag: "Trashed" },
			status: "Done",
		});
		expect(byHash.status).toBe("Done");
		expect(harness.exists("Library/a.md")).toBe(false);
		expect(harness.exists("Library/b.md")).toBe(false);
	});

	it("keeps a file the user changed after the caller read it, failing with conflict", async () => {
		const { dispose, harness, run } = setup();
		const file = harness.addFile("Library/a.md", "read");
		// The caller read "read" and planned the trash; the user types.
		harness.editByHand(file, "read, then typed");
		const entry = await run(trashIf("Library/a.md", "read"));
		await Effect.runPromise(dispose);
		const error = failure(entry);
		expect(error.kind).toBe("conflict");
		expect(error.cause).toBeInstanceOf(VamContentConflictError);
		expect(harness.contents.get("Library/a.md")).toBe("read, then typed");
		expect(harness.writes.some((write) => write.startsWith("trash"))).toBe(
			false,
		);
	});

	it("does nothing for a file already gone", async () => {
		const { dispose, entries } = setup();
		const report = await entries([trashIf("Library/gone.md", "read")]);
		await Effect.runPromise(dispose);
		expect(report.every((entry) => entry.status !== "Failed")).toBe(true);
	});
});

describe("a file open in a background pane", () => {
	const trashes = (writes: readonly string[]) =>
		writes.filter((write) => write.startsWith("trash"));

	it("keeps unsaved typing: a trash guarded by the disk content fails with conflict", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/a.md", "saved");
		const pane = harness.open("Library/a.md", {
			buffer: "saved, then typed",
		});
		const entry = await run(trashIf("Library/a.md", "saved"));
		await Effect.runPromise(dispose);
		const error = failure(entry);
		expect(error.kind).toBe("conflict");
		expect(error.cause).toBeInstanceOf(VamContentConflictError);
		expect(harness.exists("Library/a.md")).toBe(true);
		expect(trashes(harness.writes)).toEqual([]);
		expect(harness.shown(pane)).toBe("saved, then typed");
	});

	it("keeps unsaved typing: a process guarded by the disk content fails with conflict", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/a.md", "saved");
		const pane = harness.open("Library/a.md", {
			buffer: "saved, then typed",
		});
		const entry = await run(swap("Library/a.md", "saved", "rewritten"));
		await Effect.runPromise(dispose);
		expect(failure(entry).kind).toBe("conflict");
		expect(harness.contents.get("Library/a.md")).toBe("saved");
		expect(harness.writes).toEqual([]);
		expect(harness.shown(pane)).toBe("saved, then typed");
	});

	it("reads the unsaved buffer, and a write guarded by it goes through that pane's editor", async () => {
		const { dispose, harness, manager, run } = setup();
		harness.addFile("Library/a.md", "saved");
		const pane = harness.open("Library/a.md", {
			buffer: "saved\ntyped",
		});
		const read = await Effect.runPromise(
			manager.readContent(md("Library/a.md")),
		);
		const entry = await run(
			swap("Library/a.md", read, "saved\ntyped\nappended"),
		);
		await Effect.runPromise(dispose);
		expect(read).toBe("saved\ntyped");
		expect(entry).toMatchObject({
			outcome: {
				_tag: "Wrote",
				afterHash: vaultContentHash("saved\ntyped\nappended"),
				beforeHash: vaultContentHash("saved\ntyped"),
			},
			status: "Done",
		});
		// Obsidian saves the pane's buffer on its own schedule.
		expect(harness.shown(pane)).toBe("saved\ntyped\nappended");
		expect(harness.contents.get("Library/a.md")).toBe("saved");
		expect(harness.writes).toEqual([]);
	});

	it("proceeds through the disk when the pane holds no unsaved typing", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/a.md", "saved");
		harness.addFile("Library/b.md", "saved");
		const pane = harness.open("Library/a.md");
		harness.open("Library/b.md");
		const written = await run(swap("Library/a.md", "saved", "rewritten"));
		const trashed = await run(trashIf("Library/b.md", "saved"));
		await Effect.runPromise(dispose);
		expect(written).toMatchObject({
			outcome: { _tag: "Wrote" },
			status: "Done",
		});
		expect(harness.contents.get("Library/a.md")).toBe("rewritten");
		expect(harness.shown(pane)).toBe("rewritten");
		expect(trashed).toMatchObject({
			outcome: { _tag: "Trashed" },
			status: "Done",
		});
		expect(harness.exists("Library/b.md")).toBe(false);
	});

	it("two panes with the same unsaved typing: reads it, and a guarded write lands once in both", async () => {
		const { dispose, harness, manager, run } = setup();
		harness.addFile("Library/a.md", "saved");
		const first = harness.open("Library/a.md", { buffer: "typed" });
		const second = harness.open("Library/a.md", { buffer: "typed" });
		const read = await Effect.runPromise(
			manager.readContent(md("Library/a.md")),
		);
		const stale = await run(trashIf("Library/a.md", "saved"));
		const written = await run(swap("Library/a.md", "typed", "typed!"));
		await Effect.runPromise(dispose);
		expect(read).toBe("typed");
		expect(failure(stale).kind).toBe("conflict");
		expect(written.status).toBe("Done");
		expect(harness.shown(first)).toBe("typed!");
		expect(harness.shown(second)).toBe("typed!");
		expect(harness.writes).toEqual([]);
	});

	it("two panes with different unsaved typing: reads, writes and trashes fail with conflict and change nothing", async () => {
		const { dispose, harness, manager, run } = setup();
		harness.addFile("Library/a.md", "saved");
		const first = harness.open("Library/a.md", { buffer: "typed here" });
		const second = harness.open("Library/a.md", {
			buffer: "typed there",
		});
		const readFailure = await Effect.runPromise(
			manager.readContent(md("Library/a.md")).pipe(Effect.flip),
		);
		const written = await run(swap("Library/a.md", "saved", "rewritten"));
		const trashed = await run(trashIf("Library/a.md", "saved"));
		await Effect.runPromise(dispose);
		expect(readFailure).toBeInstanceOf(VamContentConflictError);
		expect((readFailure as VamContentConflictError).cause).toBeInstanceOf(
			OpenViewsDisagree,
		);
		for (const entry of [written, trashed]) {
			const error = failure(entry);
			expect(error.kind).toBe("conflict");
			expect(
				(error.cause as VamContentConflictError).cause,
			).toBeInstanceOf(OpenViewsDisagree);
		}
		expect(harness.exists("Library/a.md")).toBe(true);
		expect(harness.contents.get("Library/a.md")).toBe("saved");
		expect(harness.writes).toEqual([]);
		expect(harness.shown(first)).toBe("typed here");
		expect(harness.shown(second)).toBe("typed there");
	});

	it("a typed pane beside a clean one: the typing is the content", async () => {
		const { dispose, harness, manager, run } = setup();
		harness.addFile("Library/a.md", "saved");
		const typed = harness.open("Library/a.md", { buffer: "typed here" });
		const clean = harness.open("Library/a.md");
		const read = await Effect.runPromise(
			manager.readContent(md("Library/a.md")),
		);
		const stale = await run(trashIf("Library/a.md", "saved"));
		const written = await run(
			swap("Library/a.md", "typed here", "typed here!"),
		);
		await Effect.runPromise(dispose);
		expect(read).toBe("typed here");
		expect(failure(stale).kind).toBe("conflict");
		expect(written.status).toBe("Done");
		expect(harness.shown(typed)).toBe("typed here!");
		expect(harness.shown(clean)).toBe("typed here!");
		expect(harness.writes).toEqual([]);
	});

	it("a clean pane not yet reloaded after a disk write is not taken for typing", async () => {
		const { dispose, harness, manager, run } = setup();
		harness.addFile("Library/a.md", "new");
		// Obsidian reloads a clean view after a write with an async read;
		// until then it holds what it last loaded.
		harness.open("Library/a.md", { buffer: "old", clean: true });
		const read = await Effect.runPromise(
			manager.readContent(md("Library/a.md")),
		);
		const written = await run(swap("Library/a.md", "new", "newer"));
		await Effect.runPromise(dispose);
		expect(read).toBe("new");
		expect(written).toMatchObject({
			outcome: { _tag: "Wrote" },
			status: "Done",
		});
		expect(harness.contents.get("Library/a.md")).toBe("newer");
	});

	it("a pane in reading mode is judged by what it shows, not by its lagging editor", async () => {
		const { dispose, harness, manager, run } = setup();
		harness.addFile("Library/a.md", "saved");
		harness.open("Library/a.md", { editor: "older", mode: "preview" });
		const read = await Effect.runPromise(
			manager.readContent(md("Library/a.md")),
		);
		const trashed = await run(trashIf("Library/a.md", "saved"));
		await Effect.runPromise(dispose);
		expect(read).toBe("saved");
		expect(trashed).toMatchObject({
			outcome: { _tag: "Trashed" },
			status: "Done",
		});
	});
});

describe("the active pane in reading mode", () => {
	const trashes = (writes: readonly string[]) =>
		writes.filter((write) => write.startsWith("trash"));

	it("reads the note, and a guarded write and trash go through the disk", async () => {
		const { dispose, harness, manager, run } = setup();
		harness.addFile("Library/a.md", "saved");
		harness.addFile("Library/b.md", "saved");
		// Reading mode updates only what it renders; the editor lags.
		const pane = harness.open("Library/a.md", {
			active: true,
			editor: "older",
			mode: "preview",
		});
		const read = await Effect.runPromise(
			manager.readContent(md("Library/a.md")),
		);
		const withStat = await Effect.runPromise(
			manager.readContentWithStat(md("Library/a.md")),
		);
		const written = await run(swap("Library/a.md", read, "rewritten"));
		await Effect.runPromise(dispose);
		expect(read).toBe("saved");
		expect(withStat.content).toBe("saved");
		expect(written).toMatchObject({
			outcome: {
				_tag: "Wrote",
				afterHash: vaultContentHash("rewritten"),
				beforeHash: vaultContentHash("saved"),
			},
			status: "Done",
		});
		// Written to disk; Obsidian reloads the pane from it.
		expect(harness.contents.get("Library/a.md")).toBe("rewritten");
		expect(harness.writes).toEqual(["Library/a.md"]);
		expect(harness.shown(pane)).toBe("rewritten");

		const trash = setup();
		trash.harness.addFile("Library/a.md", "saved");
		trash.harness.open("Library/a.md", {
			active: true,
			editor: "older",
			mode: "preview",
		});
		const trashed = await trash.run(trashIf("Library/a.md", "saved"));
		await Effect.runPromise(trash.dispose);
		expect(trashed).toMatchObject({
			outcome: { _tag: "Trashed" },
			status: "Done",
		});
		expect(trash.harness.exists("Library/a.md")).toBe(false);
	});

	it("a disk change the pane has not reloaded yet: the disk is the content", async () => {
		const { dispose, harness, manager, run } = setup();
		harness.addFile("Library/a.md", "synced");
		// Sync wrote the file; Obsidian reloads the clean pane with an
		// async read, and until then it shows what it last loaded.
		harness.open("Library/a.md", {
			active: true,
			buffer: "old",
			clean: true,
			editor: "older",
			mode: "preview",
		});
		const read = await Effect.runPromise(
			manager.readContent(md("Library/a.md")),
		);
		const stale = await run(swap("Library/a.md", "old", "from old"));
		const written = await run(swap("Library/a.md", "synced", "synced!"));
		const trashed = await run(trashIf("Library/a.md", "synced!"));
		await Effect.runPromise(dispose);
		expect(read).toBe("synced");
		expect(failure(stale).kind).toBe("conflict");
		expect(written).toMatchObject({
			outcome: { _tag: "Wrote" },
			status: "Done",
		});
		expect(trashed).toMatchObject({
			outcome: { _tag: "Trashed" },
			status: "Done",
		});
		expect(harness.writes).toEqual(["Library/a.md", "trash Library/a.md"]);
	});

	it("content not saved yet: reads it, keeps it from a stale guard, and writes nothing through reading mode", async () => {
		const { dispose, harness, manager, run } = setup();
		harness.addFile("Library/a.md", "- [ ] task");
		// A checkbox ticked in reading view, its save still running.
		const pane = harness.open("Library/a.md", {
			active: true,
			buffer: "- [x] task",
			editor: "- [ ] task",
			mode: "preview",
		});
		const read = await Effect.runPromise(
			manager.readContent(md("Library/a.md")),
		);
		const stale = await run(trashIf("Library/a.md", "- [ ] task"));
		const written = await run(
			swap("Library/a.md", "- [x] task", "- [x] task\nmore"),
		);
		await Effect.runPromise(dispose);
		expect(read).toBe("- [x] task");
		expect(failure(stale).kind).toBe("conflict");
		const error = failure(written);
		expect(error.kind).toBe("conflict");
		expect(error.cause).toMatchObject({
			_tag: "VamActiveEditorError",
			reason: "WrongMode",
		});
		expect(error.message).toContain("reading view");
		expect(harness.exists("Library/a.md")).toBe(true);
		expect(trashes(harness.writes)).toEqual([]);
		expect(harness.writes).toEqual([]);
		expect(harness.shown(pane)).toBe("- [x] task");
	});

	it("typing in a background source pane: writes go through that pane's editor", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/a.md", "saved");
		// Obsidian copies the typing into the reading pane it shows.
		const reading = harness.open("Library/a.md", {
			active: true,
			buffer: "saved\ntyped",
			editor: "saved",
			mode: "preview",
		});
		const source = harness.open("Library/a.md", {
			buffer: "saved\ntyped",
		});
		const written = await run(
			swap("Library/a.md", "saved\ntyped", "saved\ntyped\nmore"),
		);
		await Effect.runPromise(dispose);
		expect(written.status).toBe("Done");
		expect(harness.shown(source)).toBe("saved\ntyped\nmore");
		expect(harness.shown(reading)).toBe("saved\ntyped\nmore");
		expect(harness.writes).toEqual([]);
	});
});

describe("the active pane in source mode", () => {
	it("is the route, unsaved typing and all, as before", async () => {
		const { dispose, harness, manager, run } = setup();
		harness.addFile("Library/a.md", "saved");
		const pane = harness.open("Library/a.md", {
			active: true,
			buffer: "saved\ntyped",
		});
		const read = await Effect.runPromise(
			manager.readContent(md("Library/a.md")),
		);
		const stale = await run(trashIf("Library/a.md", "saved"));
		const staleWrite = await run(swap("Library/a.md", "saved", "x"));
		const written = await run(
			swap("Library/a.md", read, "saved\ntyped\nmore"),
		);
		await Effect.runPromise(dispose);
		expect(read).toBe("saved\ntyped");
		expect(failure(stale).kind).toBe("conflict");
		expect(failure(staleWrite).kind).toBe("conflict");
		expect(written).toMatchObject({
			outcome: { _tag: "Wrote" },
			status: "Done",
		});
		expect(harness.shown(pane)).toBe("saved\ntyped\nmore");
		expect(harness.contents.get("Library/a.md")).toBe("saved");
		expect(harness.writes).toEqual([]);
	});
});

describe("RenameMdFile onCollision", () => {
	it("fail: refuses a taken target and moves nothing", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/a.md", "a");
		harness.addFile("Library/b.md", "a");
		const entry = await run(
			renameMd("Library/a.md", "Library/b.md", "fail"),
		);
		await Effect.runPromise(dispose);
		const error = failure(entry);
		expect(error.kind).toBe("exists");
		expect(error.cause).toBeInstanceOf(VamTargetExistsError);
		expect(harness.exists("Library/a.md")).toBe(true);
		expect(harness.contents.get("Library/b.md")).toBe("a");
		expect(harness.writes).toEqual([]);
	});

	it("fail: refuses a case variant of the target where case is ignored", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/a.md", "a");
		harness.addFile("Library/B.md", "b");
		const entry = await run(
			renameMd("Library/a.md", "Library/b.md", "fail"),
		);
		await Effect.runPromise(dispose);
		expect(failure(entry).kind).toBe("exists");
		expect(harness.exists("Library/a.md")).toBe(true);
	});

	it("fail: a missing source fails with missing, though the target is there", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/b.md", "b");
		const entry = await run(
			renameMd("Library/a.md", "Library/b.md", "fail"),
		);
		await Effect.runPromise(dispose);
		expect(failure(entry).kind).toBe("missing");
	});

	it("a rename that changes only case is no collision", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/note.md", "a");
		const entry = await run(
			renameMd("Library/note.md", "Library/Note.md", "fail"),
		);
		await Effect.runPromise(dispose);
		expect(entry).toMatchObject({
			outcome: { _tag: "Renamed" },
			status: "Done",
		});
		expect(harness.exists("Library/Note.md")).toBe(true);
	});

	it("index: moves to the indexed name even when the content is the same", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/a.md", "same");
		harness.addFile("Library/b.md", "same");
		const entry = await run(
			renameMd("Library/a.md", "Library/b.md", "index"),
		);
		await Effect.runPromise(dispose);
		expect(entry).toMatchObject({
			outcome: { _tag: "RenamedToIndexed", to: md("Library/1_b.md") },
			status: "Done",
		});
		expect(harness.contents.get("Library/1_b.md")).toBe("same");
	});

	it("dedupe, the default: trashes an identical source, indexes a different one, and counts a done move as done", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/copy.md", "same");
		harness.addFile("Library/original.md", "same");
		harness.addFile("Library/other.md", "other");
		harness.addFile("Library/taken.md", "taken");
		harness.addFile("Library/moved.md", "moved");
		const duplicate = await run(
			renameMd("Library/copy.md", "Library/original.md"),
		);
		const indexed = await run(
			renameMd("Library/other.md", "Library/taken.md"),
		);
		const done = await run(renameMd("Library/gone.md", "Library/moved.md"));
		await Effect.runPromise(dispose);
		expect(duplicate).toMatchObject({
			outcome: { _tag: "TrashedDuplicate" },
			status: "Done",
		});
		expect(indexed).toMatchObject({
			outcome: { _tag: "RenamedToIndexed", to: md("Library/1_taken.md") },
			status: "Done",
		});
		expect(done).toMatchObject({
			outcome: { _tag: "NoOp" },
			status: "Done",
		});
	});

	it("an indexed name taken in another case is skipped where case is ignored", async () => {
		const insensitive = setup();
		insensitive.harness.addFile("Library/a.md", "a");
		insensitive.harness.addFile("Library/Foo.md", "foo");
		insensitive.harness.addFile("Library/1_foo.md", "one");
		const skipped = await insensitive.run(
			renameMd("Library/a.md", "Library/Foo.md", "index"),
		);
		await Effect.runPromise(insensitive.dispose);
		expect(skipped).toMatchObject({
			outcome: { _tag: "RenamedToIndexed", to: md("Library/2_Foo.md") },
		});
		expect(insensitive.harness.contents.get("Library/1_foo.md")).toBe(
			"one",
		);

		const sensitive = setup({ insensitive: false });
		sensitive.harness.addFile("Library/a.md", "a");
		sensitive.harness.addFile("Library/Foo.md", "foo");
		sensitive.harness.addFile("Library/1_foo.md", "one");
		const taken = await sensitive.run(
			renameMd("Library/a.md", "Library/Foo.md", "index"),
		);
		await Effect.runPromise(sensitive.dispose);
		expect(taken).toMatchObject({
			outcome: { _tag: "RenamedToIndexed", to: md("Library/1_Foo.md") },
		});
	});
});

describe("RenameFolder onCollision", () => {
	const renameFolder = (
		from: string,
		to: string,
		onCollision?: "fail" | "index",
	): VaultAction => ({
		kind: VaultActionKind.RenameFolder,
		payload: {
			from: folder(from),
			to: folder(to),
			...(onCollision ? { onCollision } : {}),
		},
	});

	it("fail: refuses a taken target and moves nothing", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/Old/a.md", "a");
		harness.addFile("Library/New/b.md", "b");
		const entry = await run(
			renameFolder("Library/Old", "Library/New", "fail"),
		);
		await Effect.runPromise(dispose);
		const error = failure(entry);
		expect(error.kind).toBe("exists");
		expect(error.cause).toBeInstanceOf(VamTargetExistsError);
		expect(harness.writes).toEqual([]);
	});

	it("index, the default: moves to the indexed name", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/Old/a.md", "a");
		harness.addFile("Library/New/b.md", "b");
		const entry = await run(renameFolder("Library/Old", "Library/New"));
		await Effect.runPromise(dispose);
		expect(entry).toMatchObject({
			outcome: { _tag: "RenamedToIndexed", to: folder("Library/1_New") },
			status: "Done",
		});
	});

	it("fail: a source already moved fails with missing instead of counting as done", async () => {
		const { dispose, harness, run } = setup();
		harness.addFile("Library/New/b.md", "b");
		const strict = await run(
			renameFolder("Library/Old", "Library/New", "fail"),
		);
		const lenient = await run(renameFolder("Library/Old", "Library/New"));
		await Effect.runPromise(dispose);
		expect(failure(strict).kind).toBe("missing");
		expect(lenient).toMatchObject({
			outcome: { _tag: "NoOp" },
			status: "Done",
		});
	});
});
