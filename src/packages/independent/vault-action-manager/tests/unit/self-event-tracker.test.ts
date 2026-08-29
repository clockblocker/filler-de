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
			Effect.runSync(tracker.registerEffect(actions)),
		shouldIgnore: (path: string) =>
			Effect.runSync(tracker.shouldIgnoreEffect(path)),
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

	it("expires exact entries and releases waiters through TestClock", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const tracker = yield* SelfEventTracker.makeEffect({
					ttlMs: 5000,
				});
				yield* tracker.registerEffect([
					{
						kind: VaultActionKind.UpsertMdFile,
						payload: {
							splitPath: mdFile("note", ["Library"]),
						},
					},
				]);
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
				yield* tracker.registerEffect([
					{
						kind: VaultActionKind.TrashFolder,
						payload: {
							splitPath: folder("target", ["Library"]),
						},
					},
				]);

				yield* TestClock.adjust(4999);
				expect(
					yield* tracker.shouldIgnoreEffect(
						"Library/target/first.md",
					),
				).toBe(true);
				expect(
					yield* tracker.shouldIgnoreEffect(
						"Library/target/second.md",
					),
				).toBe(true);

				yield* TestClock.adjust(1);
				expect(
					yield* tracker.shouldIgnoreEffect(
						"Library/target/expired.md",
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
				yield* tracker.registerEffect([
					{
						kind: VaultActionKind.UpsertMdFile,
						payload: {
							splitPath: mdFile("note", ["Library"]),
						},
					},
				]);
				const waiter = yield* tracker
					.waitForAllRegisteredEffect()
					.pipe(Effect.forkChild);
				yield* Effect.yieldNow;

				expect(
					yield* tracker.shouldIgnoreEffect("Library/note.md"),
				).toBe(true);
				yield* Fiber.join(waiter);
			}),
		);
	});
});
