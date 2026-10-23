import { describe, expect, it } from "bun:test";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { SelfEventTracker } from "../../src/impl/event-processing/self-event-tracker";
import { MD } from "../../src/types/literals";
import type {
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../src/types/split-path";
import { SplitPathKind } from "../../src/types/split-path";
import type { VaultAction } from "../../src/types/vault-action";
import { VaultActionKind } from "../../src/types/vault-action";
import { selfOf, TEST_OPERATION } from "./helpers/self-events";

const folder = (
	basename: string,
	pathParts: string[] = [],
): SplitPathToFolder => ({
	basename,
	kind: SplitPathKind.Folder,
	pathParts,
});

const mdFile = (
	basename: string,
	pathParts: string[] = [],
): SplitPathToMdFile => ({
	basename,
	extension: MD,
	kind: SplitPathKind.MdFile,
	pathParts,
});

function makeTracker() {
	const tracker = Effect.runSync(SelfEventTracker.makeEffect());
	return {
		getRegisteredFilePaths: () =>
			Effect.runSync(tracker.getRegisteredFilePathsEffect()),
		register: (actions: readonly VaultAction[]) =>
			Effect.runSync(tracker.registerEffect(actions, TEST_OPERATION)),
		shouldIgnore: (path: string) =>
			Effect.runSync(selfOf(tracker.attributeEffect(path))),
		shouldIgnoreRename: (oldPath: string, newPath: string) =>
			Effect.runSync(
				selfOf(tracker.attributeRenameEffect(oldPath, newPath)),
			),
		waitForAllRegistered: () =>
			Effect.runPromise(tracker.waitForAllRegisteredEffect()),
	};
}

describe("SelfEventTracker", () => {
	it("shouldIgnore pops exact path on first match, returns false on second", () => {
		const tracker = makeTracker();
		const actions: VaultAction[] = [
			{
				kind: VaultActionKind.UpsertMdFile,
				payload: { splitPath: mdFile("note", ["Library"]) },
			},
		];

		tracker.register(actions);

		// Matching normalizes leading, trailing, and Windows-style separators.
		expect(tracker.shouldIgnore("\\Library\\note.md\\")).toBe(true);
		// Second call: already popped, returns false
		expect(tracker.shouldIgnore("Library/note.md")).toBe(false);
	});

	it("CreateFolder is an exact match and does not hide later descendants", () => {
		const tracker = makeTracker();
		const actions: VaultAction[] = [
			{
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("Section", ["Library"]) },
			},
		];

		tracker.register(actions);

		expect(tracker.shouldIgnore("Library/Section")).toBe(true);
		expect(tracker.shouldIgnore("Library/Section")).toBe(false);
		expect(tracker.shouldIgnore("Library/Section/user-created.md")).toBe(
			false,
		);
	});

	it("UpsertMdFile tracks only the file and not its parent folders", () => {
		const tracker = makeTracker();
		const actions: VaultAction[] = [
			{
				kind: VaultActionKind.UpsertMdFile,
				payload: {
					splitPath: mdFile("note", ["Library", "Section"]),
				},
			},
		];

		tracker.register(actions);

		expect(tracker.shouldIgnore("Library")).toBe(false);
		expect(tracker.shouldIgnore("Library/Section")).toBe(false);
		expect(tracker.shouldIgnore("Library/Section/note.md")).toBe(true);
	});

	it("rename: both from and to paths are tracked and independently poppable", () => {
		const tracker = makeTracker();
		const actions: VaultAction[] = [
			{
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: mdFile("old", ["Library"]),
					to: mdFile("new", ["Library"]),
				},
			},
		];

		tracker.register(actions);

		// Pop newPath first
		expect(tracker.shouldIgnore("Library/new.md")).toBe(true);
		// oldPath must STILL be poppable (not lost due to short-circuit)
		expect(tracker.shouldIgnore("Library/old.md")).toBe(true);
	});

	it("rename: popping oldPath first does not affect newPath", () => {
		const tracker = makeTracker();
		const actions: VaultAction[] = [
			{
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: mdFile("old", ["Library"]),
					to: mdFile("new", ["Library"]),
				},
			},
		];

		tracker.register(actions);

		// Pop oldPath first
		expect(tracker.shouldIgnore("Library/old.md")).toBe(true);
		// newPath must still be poppable
		expect(tracker.shouldIgnore("Library/new.md")).toBe(true);
	});

	it("waitForAllRegistered resolves only after ALL rename paths are popped", async () => {
		const tracker = makeTracker();
		const actions: VaultAction[] = [
			{
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: mdFile("old", ["Library"]),
					to: mdFile("new", ["Library"]),
				},
			},
		];

		tracker.register(actions);

		let resolved = false;
		const promise = tracker.waitForAllRegistered().then(() => {
			resolved = true;
		});

		// Pop one — should NOT resolve yet
		tracker.shouldIgnore("Library/new.md");
		// Give microtask a chance to run
		await Promise.resolve();
		expect(resolved).toBe(false);

		// Pop the other — should resolve
		tracker.shouldIgnore("Library/old.md");
		await promise;
		expect(resolved).toBe(true);
	});

	it("prefix tracking for TrashFolder does not pop on match", () => {
		const tracker = makeTracker();
		const actions: VaultAction[] = [
			{
				kind: VaultActionKind.TrashFolder,
				payload: { splitPath: folder("target", ["Library"]) },
			},
		];

		tracker.register(actions);

		// Prefix match: descendant files should all be ignored
		expect(tracker.shouldIgnore("Library/target/child.md")).toBe(true);
		// Prefix persists — another descendant also ignored
		expect(tracker.shouldIgnore("Library/target/other.md")).toBe(true);
		// The folder itself (exact match) should also be ignored (popped)
		expect(tracker.shouldIgnore("Library/target")).toBe(true);
		// After exact pop, prefix still works for descendants
		expect(tracker.shouldIgnore("Library/target/yet-another.md")).toBe(
			true,
		);
	});

	it("RenameFolder keeps only the source prefix after exact paths pop", () => {
		const tracker = makeTracker();
		const actions: VaultAction[] = [
			{
				kind: VaultActionKind.RenameFolder,
				payload: {
					from: folder("old", ["Library"]),
					to: folder("new", ["Library"]),
				},
			},
		];

		tracker.register(actions);

		// The exact source entry pops, but its prefix continues to cover descendants.
		expect(tracker.shouldIgnore("Library/old")).toBe(true);
		expect(tracker.shouldIgnore("Library/old/first.md")).toBe(true);
		expect(tracker.shouldIgnore("Library/old/second.md")).toBe(true);

		// The destination is exact-only so later user changes remain observable.
		expect(tracker.shouldIgnore("Library/new")).toBe(true);
		expect(tracker.shouldIgnore("Library/new")).toBe(false);
		expect(tracker.shouldIgnore("Library/new/user-created.md")).toBe(false);
	});

	it("RenameFolder makes each descendant rename to the same place under the destination Self", () => {
		const tracker = makeTracker();
		tracker.register([
			{
				kind: VaultActionKind.RenameFolder,
				payload: {
					from: folder("old", ["Library"]),
					to: folder("new", ["Library"]),
				},
			},
		]);

		// Descendant pairs never pop, at any depth, and with stray separators.
		expect(
			tracker.shouldIgnoreRename("Library/old/a.md", "Library/new/a.md"),
		).toBe(true);
		expect(
			tracker.shouldIgnoreRename("Library/old/a.md", "Library/new/a.md"),
		).toBe(true);
		expect(
			tracker.shouldIgnoreRename(
				"\\Library\\old\\Sub\\Inner\\b.md",
				"/Library/new/Sub/Inner/b.md/",
			),
		).toBe(true);
		expect(
			tracker.shouldIgnoreRename("Library/old/Sub", "Library/new/Sub"),
		).toBe(true);
		// The folder itself pops its exact entries.
		expect(tracker.shouldIgnoreRename("Library/old", "Library/new")).toBe(
			true,
		);
		expect(tracker.shouldIgnoreRename("Library/old", "Library/new")).toBe(
			false,
		);
	});

	it("RenameFolder leaves other renames into or out of its folders observable", () => {
		const tracker = makeTracker();
		tracker.register([
			{
				kind: VaultActionKind.RenameFolder,
				payload: {
					from: folder("old", ["Library"]),
					to: folder("new", ["Library"]),
				},
			},
		]);

		// A different remainder under the destination.
		expect(
			tracker.shouldIgnoreRename("Library/old/a.md", "Library/new/b.md"),
		).toBe(false);
		expect(
			tracker.shouldIgnoreRename(
				"Library/old/Sub/a.md",
				"Library/new/a.md",
			),
		).toBe(false);
		// From elsewhere into the destination.
		expect(
			tracker.shouldIgnoreRename("Inbox/a.md", "Library/new/a.md"),
		).toBe(false);
		// A sibling whose name only starts like the source.
		expect(
			tracker.shouldIgnoreRename(
				"Library/older/a.md",
				"Library/new/a.md",
			),
		).toBe(false);
		// Paths compare case-sensitively after VaultPath normalization, like
		// every match.
		expect(
			tracker.shouldIgnoreRename("Library/Old/a.md", "Library/new/a.md"),
		).toBe(false);
	});

	it("RenameFolder matches descendants whatever their Unicode composition", () => {
		const tracker = makeTracker();
		tracker.register([
			{
				kind: VaultActionKind.RenameFolder,
				payload: {
					from: folder("old", ["Library"]),
					to: folder("new", ["Library"]),
				},
			},
		]);

		// Obsidian composes every path to NFC, so NFC and NFD spell one path.
		expect(
			tracker.shouldIgnoreRename(
				"Library/old/Cafe\u0301.md",
				"Library/new/Caf\u00e9.md",
			),
		).toBe(true);
	});

	it("RenameFolder into the vault root maps descendants to root paths", () => {
		const tracker = makeTracker();
		tracker.register([
			{
				kind: VaultActionKind.RenameFolder,
				payload: {
					from: folder("old", ["Library"]),
					to: folder(""),
				},
			},
		]);

		expect(tracker.shouldIgnoreRename("Library/old/a.md", "a.md")).toBe(
			true,
		);
		expect(tracker.shouldIgnoreRename("Library/old/a.md", "/a.md")).toBe(
			true,
		);
		expect(
			tracker.shouldIgnoreRename("Library/old/a.md", "Library/a.md"),
		).toBe(false);
	});

	it("RenameFolder from the vault root matches no descendant pair", () => {
		const tracker = makeTracker();
		tracker.register([
			{
				kind: VaultActionKind.RenameFolder,
				payload: {
					from: folder(""),
					to: folder("new", ["Library"]),
				},
			},
		]);

		expect(tracker.shouldIgnoreRename("a.md", "Library/new/a.md")).toBe(
			false,
		);
	});

	it("TrashMdFile tracks one exact path and no descendants", () => {
		const tracker = makeTracker();
		const actions: VaultAction[] = [
			{
				kind: VaultActionKind.TrashMdFile,
				payload: { splitPath: mdFile("note", ["Library"]) },
			},
		];

		tracker.register(actions);

		expect(tracker.shouldIgnore("Library/note.md")).toBe(true);
		expect(tracker.shouldIgnore("Library/note.md")).toBe(false);
		expect(tracker.shouldIgnore("Library/note.md/child")).toBe(false);
	});

	it("ProcessMdFile paths are NOT registered", () => {
		const tracker = makeTracker();
		const actions: VaultAction[] = [
			{
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("note", ["Library"]),
					transform: (content: string) => content,
				},
			},
		];

		tracker.register(actions);

		// ProcessMdFile should NOT cause the path to be tracked
		expect(tracker.shouldIgnore("Library/note.md")).toBe(false);
	});

	it("ProcessMdFile does not appear in registered file paths", () => {
		const tracker = makeTracker();
		const actions: VaultAction[] = [
			{
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("note", ["Library"]),
					transform: (content: string) => content,
				},
			},
		];

		tracker.register(actions);

		expect(tracker.getRegisteredFilePaths()).toEqual([]);
	});

	it("reports only file destinations that should become queryable", () => {
		const tracker = makeTracker();
		const actions: VaultAction[] = [
			{
				kind: VaultActionKind.UpsertMdFile,
				payload: {
					splitPath: mdFile("created", ["Library"]),
				},
			},
			{
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: mdFile("old", ["Library"]),
					to: mdFile("new", ["Library"]),
				},
			},
			{
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("Section", ["Library"]) },
			},
			{
				kind: VaultActionKind.TrashMdFile,
				payload: { splitPath: mdFile("deleted", ["Library"]) },
			},
		];

		tracker.register(actions);

		expect([...tracker.getRegisteredFilePaths()].sort()).toEqual([
			"Library/created.md",
			"Library/new.md",
		]);
	});

	it("stops listing the file of an action that did not complete", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const tracker = yield* SelfEventTracker.makeEffect();
				const create = (basename: string): VaultAction => ({
					kind: VaultActionKind.UpsertMdFile,
					payload: { splitPath: mdFile(basename, ["Library"]) },
				});
				yield* tracker.beginEffect(create("done"), TEST_OPERATION);
				yield* tracker.beginEffect(create("failed"), TEST_OPERATION);

				yield* tracker.finishEffect(create("done"), true);
				yield* tracker.finishEffect(create("failed"), false);

				// The failed create still attributes a late event as Self.
				expect(yield* tracker.getRegisteredFilePathsEffect()).toEqual([
					"Library/done.md",
				]);
				expect(
					yield* selfOf(tracker.attributeEffect("Library/failed.md")),
				).toBe(true);
			}).pipe(Effect.provide(TestClock.layer())),
		);
	});

	it("expires exact entries and releases waiters through TestClock", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const tracker = yield* SelfEventTracker.makeEffect({
					ttlMs: 5000,
				});
				yield* tracker.registerEffect(
					[
						{
							kind: VaultActionKind.UpsertMdFile,
							payload: {
								splitPath: mdFile("note", ["Library"]),
							},
						},
					],
					TEST_OPERATION,
				);
				const waiter = yield* tracker
					.waitForAllRegisteredEffect()
					.pipe(Effect.forkChild);

				yield* TestClock.adjust(4999);
				expect(yield* tracker.getRegisteredFilePathsEffect()).toEqual([
					"Library/note.md",
				]);

				yield* TestClock.adjust(1);
				yield* Fiber.join(waiter);
				expect(yield* tracker.getRegisteredFilePathsEffect()).toEqual(
					[],
				);
			}).pipe(Effect.provide(TestClock.layer())),
		);
	});

	it("keeps folder prefixes until their TestClock expiration", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const tracker = yield* SelfEventTracker.makeEffect({
					ttlMs: 5000,
				});
				yield* tracker.registerEffect(
					[
						{
							kind: VaultActionKind.TrashFolder,
							payload: {
								splitPath: folder("target", ["Library"]),
							},
						},
					],
					TEST_OPERATION,
				);

				yield* TestClock.adjust(4999);
				expect(
					yield* selfOf(
						tracker.attributeEffect("Library/target/first.md"),
					),
				).toBe(true);
				expect(
					yield* selfOf(
						tracker.attributeEffect("Library/target/second.md"),
					),
				).toBe(true);

				yield* TestClock.adjust(1);
				expect(
					yield* selfOf(
						tracker.attributeEffect("Library/target/expired.md"),
					),
				).toBe(false);
			}).pipe(Effect.provide(TestClock.layer())),
		);
	});

	it("matches a redirected folder rename at its actual destination until one TTL after the action finishes (#175)", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const tracker = yield* SelfEventTracker.makeEffect({
					ttlMs: 5000,
				});
				const action: VaultAction = {
					kind: VaultActionKind.RenameFolder,
					payload: {
						from: folder("old", ["Library"]),
						to: folder("new", ["Library"]),
					},
				};
				yield* tracker.beginEffect(action, TEST_OPERATION);
				yield* tracker.expectRenameDestinationEffect({
					actual: "Library/1_new",
					from: "Library/old",
					isFolder: true,
					planned: "Library/new",
				});

				yield* TestClock.adjust(60_000);
				// The folder's own rename and a descendant's, at the actual
				// destination; nothing at the planned one any more.
				expect(
					yield* selfOf(
						tracker.attributeRenameEffect(
							"Library/old",
							"Library/1_new",
						),
					),
				).toBe(true);
				expect(
					yield* selfOf(
						tracker.attributeRenameEffect(
							"Library/old/a.md",
							"Library/1_new/a.md",
						),
					),
				).toBe(true);
				expect(
					yield* selfOf(
						tracker.attributeRenameEffect(
							"Library/old/b.md",
							"Library/new/b.md",
						),
					),
				).toBe(false);
				expect(
					yield* selfOf(tracker.attributeEffect("Library/new")),
				).toBe(false);

				yield* tracker.finishEffect(action);
				yield* TestClock.adjust(4999);
				expect(
					yield* selfOf(
						tracker.attributeRenameEffect(
							"Library/old/c.md",
							"Library/1_new/c.md",
						),
					),
				).toBe(true);
				yield* TestClock.adjust(1);
				expect(
					yield* selfOf(
						tracker.attributeRenameEffect(
							"Library/old/d.md",
							"Library/1_new/d.md",
						),
					),
				).toBe(false);
				// Nothing is left to hold the settle barrier.
				yield* tracker.waitForAllRegisteredEffect();
			}).pipe(Effect.provide(TestClock.layer())),
		);
	});

	it("keeps folder rename pairs until one TTL after the action finishes", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const tracker = yield* SelfEventTracker.makeEffect({
					ttlMs: 5000,
				});
				const action: VaultAction = {
					kind: VaultActionKind.RenameFolder,
					payload: {
						from: folder("old", ["Library"]),
						to: folder("new", ["Library"]),
					},
				};
				yield* tracker.beginEffect(action, TEST_OPERATION);

				yield* TestClock.adjust(60_000);
				expect(
					yield* selfOf(
						tracker.attributeRenameEffect(
							"Library/old/a.md",
							"Library/new/a.md",
						),
					),
				).toBe(true);

				yield* tracker.finishEffect(action);
				yield* TestClock.adjust(4999);
				expect(
					yield* selfOf(
						tracker.attributeRenameEffect(
							"Library/old/b.md",
							"Library/new/b.md",
						),
					),
				).toBe(true);

				yield* TestClock.adjust(1);
				expect(
					yield* selfOf(
						tracker.attributeRenameEffect(
							"Library/old/c.md",
							"Library/new/c.md",
						),
					),
				).toBe(false);
			}).pipe(Effect.provide(TestClock.layer())),
		);
	});

	it("wakes waitForAllRegistered when the final exact entry pops", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const tracker = yield* SelfEventTracker.makeEffect({
					ttlMs: 5000,
				});
				yield* tracker.registerEffect(
					[
						{
							kind: VaultActionKind.UpsertMdFile,
							payload: {
								splitPath: mdFile("note", ["Library"]),
							},
						},
					],
					TEST_OPERATION,
				);
				const waiter = yield* tracker
					.waitForAllRegisteredEffect()
					.pipe(Effect.forkChild);
				yield* Effect.yieldNow;

				expect(
					yield* selfOf(tracker.attributeEffect("Library/note.md")),
				).toBe(true);
				yield* Fiber.join(waiter);
			}),
		);
	});
});

describe("SelfEventTracker modify expectations", () => {
	it("pops one expectation per expected write", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const tracker = yield* SelfEventTracker.makeEffect();
				yield* tracker.expectModifyEffect("Worter/Hund.md");
				yield* tracker.expectModifyEffect("/Worter/Hund.md");

				expect(
					yield* selfOf(
						tracker.attributeModifyEffect("Worter\\Hund.md"),
					),
				).toBe(true);
				expect(
					yield* selfOf(
						tracker.attributeModifyEffect("Worter/Hund.md"),
					),
				).toBe(true);
				expect(
					yield* selfOf(
						tracker.attributeModifyEffect("Worter/Hund.md"),
					),
				).toBe(false);
				expect(
					yield* selfOf(
						tracker.attributeModifyEffect("Worter/Katze.md"),
					),
				).toBe(false);
			}),
		);
	});

	it("withdraws an expectation after a failed write", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const tracker = yield* SelfEventTracker.makeEffect();
				yield* tracker.expectModifyEffect("Worter/Hund.md");
				yield* tracker.forgetModifyEffect("Worter/Hund.md");

				expect(
					yield* selfOf(
						tracker.attributeModifyEffect("Worter/Hund.md"),
					),
				).toBe(false);
			}),
		);
	});

	it("expires modify expectations after the TTL", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const tracker = yield* SelfEventTracker.makeEffect({
					ttlMs: 5000,
				});
				yield* tracker.expectModifyEffect("Worter/Hund.md");
				yield* tracker.expectModifyEffect("Worter/Katze.md");

				yield* TestClock.adjust(4999);
				expect(
					yield* selfOf(
						tracker.attributeModifyEffect("Worter/Hund.md"),
					),
				).toBe(true);
				yield* TestClock.adjust(1);
				expect(
					yield* selfOf(
						tracker.attributeModifyEffect("Worter/Katze.md"),
					),
				).toBe(false);
			}).pipe(Effect.provide(TestClock.layer())),
		);
	});

	it("keeps modify expectations separate from create, rename, and delete attribution", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const tracker = yield* SelfEventTracker.makeEffect();
				yield* tracker.expectModifyEffect("Library/note.md");

				expect(
					yield* selfOf(tracker.attributeEffect("Library/note.md")),
				).toBe(false);
				expect(yield* tracker.getRegisteredFilePathsEffect()).toEqual(
					[],
				);
				// Modify expectations never hold the settle barrier open.
				yield* tracker.waitForAllRegisteredEffect();

				yield* tracker.registerEffect(
					[
						{
							kind: VaultActionKind.UpsertMdFile,
							payload: { splitPath: mdFile("note", ["Library"]) },
						},
					],
					TEST_OPERATION,
				);
				expect(
					yield* selfOf(tracker.attributeEffect("Library/note.md")),
				).toBe(true);
				expect(
					yield* selfOf(
						tracker.attributeModifyEffect("Library/note.md"),
					),
				).toBe(true);
			}),
		);
	});

	it("keeps a begun action's entries open until it finishes, then for one TTL", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const tracker = yield* SelfEventTracker.makeEffect({
					ttlMs: 5000,
				});
				const action: VaultAction = {
					kind: VaultActionKind.RenameMdFile,
					payload: {
						from: mdFile("old", ["Library"]),
						to: mdFile("new", ["Library"]),
					},
				};
				yield* tracker.beginEffect(action, TEST_OPERATION);

				yield* TestClock.adjust(60_000);
				expect(
					yield* selfOf(tracker.attributeEffect("Library/new.md")),
				).toBe(true);

				yield* tracker.finishEffect(action);
				// The matched entry stays matched.
				expect(
					yield* selfOf(tracker.attributeEffect("Library/new.md")),
				).toBe(false);
				yield* TestClock.adjust(4999);
				expect(yield* tracker.getRegisteredFilePathsEffect()).toEqual(
					[],
				);
				expect(
					yield* selfOf(tracker.attributeEffect("Library/old.md")),
				).toBe(true);
			}).pipe(Effect.provide(TestClock.layer())),
		);
	});

	it("expires a finished action's unmatched entries and prefixes one TTL after it finishes", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const tracker = yield* SelfEventTracker.makeEffect({
					ttlMs: 5000,
				});
				const action: VaultAction = {
					kind: VaultActionKind.TrashFolder,
					payload: { splitPath: folder("target", ["Library"]) },
				};
				yield* tracker.beginEffect(action, TEST_OPERATION);
				const waiter = yield* tracker
					.waitForAllRegisteredEffect()
					.pipe(Effect.forkChild);

				yield* TestClock.adjust(60_000);
				expect(
					yield* selfOf(
						tracker.attributeEffect("Library/target/child.md"),
					),
				).toBe(true);

				yield* tracker.finishEffect(action);
				yield* TestClock.adjust(4999);
				expect(
					yield* selfOf(
						tracker.attributeEffect("Library/target/late.md"),
					),
				).toBe(true);

				yield* TestClock.adjust(1);
				yield* Fiber.join(waiter);
				expect(
					yield* selfOf(
						tracker.attributeEffect("Library/target/user.md"),
					),
				).toBe(false);
				expect(
					yield* selfOf(tracker.attributeEffect("Library/target")),
				).toBe(false);
			}).pipe(Effect.provide(TestClock.layer())),
		);
	});
});
