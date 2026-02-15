import { describe, expect, it } from "bun:test";
import { SelfEventTracker } from "../../../src/managers/obsidian/vault-action-manager/impl/event-processing/self-event-tracker";
import { MD } from "../../../src/managers/obsidian/vault-action-manager/types/literals";
import type {
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type { VaultAction } from "../../../src/managers/obsidian/vault-action-manager/types/vault-action";
import { VaultActionKind } from "../../../src/managers/obsidian/vault-action-manager/types/vault-action";

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

describe("SelfEventTracker", () => {
	it("shouldIgnore pops exact path on first match, returns false on second", () => {
		const tracker = new SelfEventTracker();
		const actions: VaultAction[] = [
			{
				kind: VaultActionKind.UpsertMdFile,
				payload: { splitPath: mdFile("note", ["Library"]) },
			},
		];

		tracker.register(actions);

		// First call: pops and returns true
		expect(tracker.shouldIgnore("Library/note.md")).toBe(true);
		// Second call: already popped, returns false
		expect(tracker.shouldIgnore("Library/note.md")).toBe(false);
	});

	it("rename: both from and to paths are tracked and independently poppable", () => {
		const tracker = new SelfEventTracker();
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
		const tracker = new SelfEventTracker();
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
		const tracker = new SelfEventTracker();
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
		const tracker = new SelfEventTracker();
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
		expect(tracker.shouldIgnore("Library/target/yet-another.md")).toBe(true);
	});

	it("ProcessMdFile paths are NOT registered", () => {
		const tracker = new SelfEventTracker();
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
		const tracker = new SelfEventTracker();
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
});
