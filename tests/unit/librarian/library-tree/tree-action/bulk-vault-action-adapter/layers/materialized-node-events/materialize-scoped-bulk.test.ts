import { describe, expect, it } from "bun:test";
import type { LibraryScopedBulkVaultEvent } from "../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types/scoped-event";
import { Scope } from "../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types/scoped-event";
import { materializeScopedBulk } from "../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/materialized-node-events/materialize-scoped-bulk";
import type { MaterializedNodeEvent } from "../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/materialized-node-events/types";
import { MaterializedEventKind } from "../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/materialized-node-events/types";
import { TreeNodeKind } from "../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/atoms";
import { SplitPathKind } from "../../../../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { VaultEventKind } from "../../../../../../../../src/managers/obsidian/vault-action-manager/types/vault-event";

// Helper: create library-scoped split paths
const F = (basename: string, pathParts: string[] = []): { basename: string; pathParts: string[]; kind: typeof SplitPathKind.Folder } => ({
	basename,
	kind: SplitPathKind.Folder,
	pathParts,
});

const File = (basename: string, pathParts: string[] = [], extension = "txt"): { basename: string; pathParts: string[]; kind: typeof SplitPathKind.File; extension: string } => ({
	basename,
	extension,
	kind: SplitPathKind.File,
	pathParts,
});

const MdFile = (basename: string, pathParts: string[] = []): { basename: string; pathParts: string[]; kind: typeof SplitPathKind.MdFile; extension: "md" } => ({
	basename,
	extension: "md",
	kind: SplitPathKind.MdFile,
	pathParts,
});

// Helper: normalize object by sorting keys recursively
function normalizeForComparison(obj: unknown): unknown {
	if (obj === null || typeof obj !== "object") return obj;
	if (Array.isArray(obj)) return obj.map(normalizeForComparison);
	
	const sorted: Record<string, unknown> = {};
	for (const key of Object.keys(obj).sort()) {
		sorted[key] = normalizeForComparison((obj as Record<string, unknown>)[key]);
	}
	return sorted;
}

// Helper: assert multiset equality (order-agnostic)
function expectMultisetEqual(actual: MaterializedNodeEvent[], expected: MaterializedNodeEvent[]) {
	expect(actual.length).toBe(expected.length);
	
	// Count occurrences of each event (by normalized JSON string)
	const actualCounts = new Map<string, number>();
	for (const e of actual) {
		const key = JSON.stringify(normalizeForComparison(e));
		actualCounts.set(key, (actualCounts.get(key) ?? 0) + 1);
	}
	
	const expectedCounts = new Map<string, number>();
	for (const e of expected) {
		const key = JSON.stringify(normalizeForComparison(e));
		expectedCounts.set(key, (expectedCounts.get(key) ?? 0) + 1);
	}
	
	expect(actualCounts.size).toBe(expectedCounts.size);
	for (const [key, count] of expectedCounts) {
		expect(actualCounts.get(key)).toBe(count);
	}
}

describe("materializeScopedBulk", () => {
	describe("Create Events (from bulk.events)", () => {
		it("creates File from InsideToInside FileCreated", () => {
			const bulk: LibraryScopedBulkVaultEvent = {
				debug: {
					collapsedCount: { creates: 0, deletes: 0, renames: 0 },
					endedAt: 0,
					reduced: { rootDeletes: 0, rootRenames: 0 },
					startedAt: 0,
					trueCount: { creates: 0, deletes: 0, renames: 0 },
				},
				events: [
					{
						...{
							kind: VaultEventKind.FileCreated,
							splitPath: File("note", ["section"]),
						},
						scope: Scope.Inside,
					},
				],
				roots: [],
			};

			const result = materializeScopedBulk(bulk);

			expectMultisetEqual(result, [
				{
					kind: MaterializedEventKind.Create,
					nodeKind: TreeNodeKind.File,
					splitPath: File("note", ["section"]),
				},
			]);
		});

		it("creates Scroll from InsideToInside MdFile Created", () => {
			const bulk: LibraryScopedBulkVaultEvent = {
				debug: {
					collapsedCount: { creates: 0, deletes: 0, renames: 0 },
					endedAt: 0,
					reduced: { rootDeletes: 0, rootRenames: 0 },
					startedAt: 0,
					trueCount: { creates: 0, deletes: 0, renames: 0 },
				},
				events: [
					{
						...{
							kind: VaultEventKind.FileCreated,
							splitPath: MdFile("note", ["section"]),
						},
						scope: Scope.Inside,
					},
				],
				roots: [],
			};

			const result = materializeScopedBulk(bulk);

			expectMultisetEqual(result, [
				{
					kind: MaterializedEventKind.Create,
					nodeKind: TreeNodeKind.Scroll,
					splitPath: MdFile("note", ["section"]),
				},
			]);
		});

		it("ignores FolderCreated and other scopes", () => {
			const bulk: LibraryScopedBulkVaultEvent = {
				debug: {
					collapsedCount: { creates: 0, deletes: 0, renames: 0 },
					endedAt: 0,
					reduced: { rootDeletes: 0, rootRenames: 0 },
					startedAt: 0,
					trueCount: { creates: 0, deletes: 0, renames: 0 },
				},
				events: [
					{
						...{
							kind: VaultEventKind.FolderCreated,
							splitPath: F("folder"),
						},
						scope: Scope.Inside,
					},
					{
						...{
							kind: VaultEventKind.FileCreated,
							splitPath: File("outside"),
						},
						scope: Scope.Outside,
					},
					{
						...{
							kind: VaultEventKind.FileCreated,
							splitPath: File("boundary"),
						},
						scope: Scope.Outside,
					},
					{
						...{
							kind: VaultEventKind.FileCreated,
							splitPath: File("incoming"),
						},
						scope: Scope.OutsideToInside,
					},
				],
				roots: [],
			};

			const result = materializeScopedBulk(bulk);

			expectMultisetEqual(result, [
				{
					kind: MaterializedEventKind.Create,
					nodeKind: TreeNodeKind.File,
					splitPath: File("incoming"),
				},
			]);
		});
	});

	describe("Delete Events (from bulk.roots)", () => {
		it("deletes File, Scroll, and Section from InsideToInside", () => {
			const bulk: LibraryScopedBulkVaultEvent = {
				debug: {
					collapsedCount: { creates: 0, deletes: 0, renames: 0 },
					endedAt: 0,
					reduced: { rootDeletes: 0, rootRenames: 0 },
					startedAt: 0,
					trueCount: { creates: 0, deletes: 0, renames: 0 },
				},
				events: [],
				roots: [
					{
						...{
							kind: VaultEventKind.FileDeleted,
							splitPath: File("file"),
						},
						scope: Scope.Inside,
					},
					{
						...{
							kind: VaultEventKind.FileDeleted,
							splitPath: MdFile("scroll"),
						},
						scope: Scope.Inside,
					},
					{
						...{
							kind: VaultEventKind.FolderDeleted,
							splitPath: F("section"),
						},
						scope: Scope.Inside,
					},
				],
			};

			const result = materializeScopedBulk(bulk);

			expectMultisetEqual(result, [
				{
					kind: MaterializedEventKind.Delete,
					nodeKind: TreeNodeKind.File,
					splitPath: File("file"),
				},
				{
					kind: MaterializedEventKind.Delete,
					nodeKind: TreeNodeKind.Scroll,
					splitPath: MdFile("scroll"),
				},
				{
					kind: MaterializedEventKind.Delete,
					nodeKind: TreeNodeKind.Section,
					splitPath: F("section"),
				},
			]);
		});

		it("ignores non-Inside scopes", () => {
			const bulk: LibraryScopedBulkVaultEvent = {
				debug: {
					collapsedCount: { creates: 0, deletes: 0, renames: 0 },
					endedAt: 0,
					reduced: { rootDeletes: 0, rootRenames: 0 },
					startedAt: 0,
					trueCount: { creates: 0, deletes: 0, renames: 0 },
				},
				events: [],
				roots: [
					{
						...{
							kind: VaultEventKind.FileDeleted,
							splitPath: File("outside"),
						},
						scope: Scope.Outside,
					},
					{
						...{
							kind: VaultEventKind.FileDeleted,
							splitPath: File("incoming"),
						},
						scope: Scope.OutsideToInside,
					},
					{
						...{
							kind: VaultEventKind.FileDeleted,
							splitPath: File("outgoing"),
						},
						scope: Scope.InsideToOutside,
					},
				],
			};

			const result = materializeScopedBulk(bulk);

			expectMultisetEqual(result, []);
		});
	});

	describe("Delete Events (from bulk.events - InsideToOutside only)", () => {
		it("deletes from InsideToOutside FileRenamed and FolderRenamed", () => {
			const bulk: LibraryScopedBulkVaultEvent = {
				debug: {
					collapsedCount: { creates: 0, deletes: 0, renames: 0 },
					endedAt: 0,
					reduced: { rootDeletes: 0, rootRenames: 0 },
					startedAt: 0,
					trueCount: { creates: 0, deletes: 0, renames: 0 },
				},
				events: [
					{
						...{
							from: File("file"),
							kind: VaultEventKind.FileRenamed,
							to: File("outside"),
						},
						scope: Scope.InsideToOutside,
					},
					{
						...{
							from: MdFile("scroll"),
							kind: VaultEventKind.FileRenamed,
							to: MdFile("outside"),
						},
						scope: Scope.InsideToOutside,
					},
					{
						...{
							from: F("section"),
							kind: VaultEventKind.FolderRenamed,
							to: F("outside"),
						},
						scope: Scope.InsideToOutside,
					},
				],
				roots: [],
			};

			const result = materializeScopedBulk(bulk);

			expectMultisetEqual(result, [
				{
					kind: MaterializedEventKind.Delete,
					nodeKind: TreeNodeKind.File,
					splitPath: File("file"),
				},
				{
					kind: MaterializedEventKind.Delete,
					nodeKind: TreeNodeKind.Scroll,
					splitPath: MdFile("scroll"),
				},
				{
					kind: MaterializedEventKind.Delete,
					nodeKind: TreeNodeKind.Section,
					splitPath: F("section"),
				},
			]);
		});

		it("ignores other scopes", () => {
			const bulk: LibraryScopedBulkVaultEvent = {
				debug: {
					collapsedCount: { creates: 0, deletes: 0, renames: 0 },
					endedAt: 0,
					reduced: { rootDeletes: 0, rootRenames: 0 },
					startedAt: 0,
					trueCount: { creates: 0, deletes: 0, renames: 0 },
				},
				events: [
					{
						...{
							kind: VaultEventKind.FileDeleted,
							splitPath: File("inside"),
						},
						scope: Scope.Inside,
					},
					{
						...{
							kind: VaultEventKind.FileDeleted,
							splitPath: File("incoming"),
						},
						scope: Scope.Inside,
					},
					{
						...{
							kind: VaultEventKind.FileDeleted,
							splitPath: File("outside"),
						},
						scope: Scope.Inside,
					},
				],
				roots: [],
			};

			const result = materializeScopedBulk(bulk);

			expectMultisetEqual(result, []);
		});
	});

	describe("Rename Events (from bulk.roots)", () => {
		it("renames File→File, MdFile→MdFile, and Folder from InsideToInside", () => {
			const bulk: LibraryScopedBulkVaultEvent = {
				debug: {
					collapsedCount: { creates: 0, deletes: 0, renames: 0 },
					endedAt: 0,
					reduced: { rootDeletes: 0, rootRenames: 0 },
					startedAt: 0,
					trueCount: { creates: 0, deletes: 0, renames: 0 },
				},
				events: [],
				roots: [
					{
						...{
							from: File("old-file"),
							kind: VaultEventKind.FileRenamed,
							to: File("new-file"),
						},
						scope: Scope.Inside,
					},
					{
						...{
							from: MdFile("old-scroll"),
							kind: VaultEventKind.FileRenamed,
							to: MdFile("new-scroll"),
						},
						scope: Scope.Inside,
					},
					{
						...{
							from: F("old-section"),
							kind: VaultEventKind.FolderRenamed,
							to: F("new-section"),
						},
						scope: Scope.Inside,
					},
				],
			};

			const result = materializeScopedBulk(bulk);

			expectMultisetEqual(result, [
				{
					from: File("old-file"),
					kind: MaterializedEventKind.Rename,
					nodeKind: TreeNodeKind.File,
					to: File("new-file"),
				},
				{
					from: MdFile("old-scroll"),
					kind: MaterializedEventKind.Rename,
					nodeKind: TreeNodeKind.Scroll,
					to: MdFile("new-scroll"),
				},
				{
					from: F("old-section"),
					kind: MaterializedEventKind.Rename,
					nodeKind: TreeNodeKind.Section,
					to: F("new-section"),
				},
			]);
		});

		it("ignores type mismatches and non-InsideToInside scopes", () => {
			const bulk: LibraryScopedBulkVaultEvent = {
				debug: {
					collapsedCount: { creates: 0, deletes: 0, renames: 0 },
					endedAt: 0,
					reduced: { rootDeletes: 0, rootRenames: 0 },
					startedAt: 0,
					trueCount: { creates: 0, deletes: 0, renames: 0 },
				},
				events: [],
				roots: [
					{
						...{
							from: File("file"),
							kind: VaultEventKind.FileRenamed,
							to: MdFile("scroll"),
						},
						scope: Scope.Inside,
					},
					{
						...{
							from: MdFile("scroll"),
							kind: VaultEventKind.FileRenamed,
							to: File("file"),
						},
						scope: Scope.Inside,
					},
					{
						...{
							from: File("old"),
							kind: VaultEventKind.FileRenamed,
							to: File("new"),
						},
						scope: Scope.Outside,
					},
					{
						...{
							from: File("old"),
							kind: VaultEventKind.FileRenamed,
							to: File("new"),
						},
						scope: Scope.OutsideToInside,
					},
					{
						...{
							from: File("old"),
							kind: VaultEventKind.FileRenamed,
							to: File("new"),
						},
						scope: Scope.InsideToOutside,
					},
				],
			};

			const result = materializeScopedBulk(bulk);

			expectMultisetEqual(result, []);
		});
	});

	describe("Empty Bulk", () => {
		it("returns empty array", () => {
			const bulk: LibraryScopedBulkVaultEvent = {
				debug: {
					collapsedCount: { creates: 0, deletes: 0, renames: 0 },
					endedAt: 0,
					reduced: { rootDeletes: 0, rootRenames: 0 },
					startedAt: 0,
					trueCount: { creates: 0, deletes: 0, renames: 0 },
				},
				events: [],
				roots: [],
			};

			const result = materializeScopedBulk(bulk);

			expect(result).toEqual([]);
		});
	});

	describe("Mixed Bulk Sanity", () => {
		it("processes multiple event types and asserts counts", () => {
			const bulk: LibraryScopedBulkVaultEvent = {
				debug: {
					collapsedCount: { creates: 0, deletes: 0, renames: 0 },
					endedAt: 0,
					reduced: { rootDeletes: 0, rootRenames: 0 },
					startedAt: 0,
					trueCount: { creates: 0, deletes: 0, renames: 0 },
				},
				events: [
					{
						...{
							kind: VaultEventKind.FileCreated,
							splitPath: File("created"),
						},
						scope: Scope.Inside,
					},
					{
						...{
							kind: VaultEventKind.FileCreated,
							splitPath: MdFile("incoming"),
						},
						scope: Scope.Inside,
					},
					{
						...{
							from: File("outgoing"),
							kind: VaultEventKind.FileRenamed,
							to: File("outside"),
						},
						scope: Scope.InsideToOutside,
					},
				],
				roots: [
					{
						...{
							kind: VaultEventKind.FileDeleted,
							splitPath: File("deleted"),
						},
						scope: Scope.Inside,
					},
					{
						...{
							from: File("old"),
							kind: VaultEventKind.FileRenamed,
							to: File("new"),
						},
						scope: Scope.Inside,
					},
				],
			};

			const result = materializeScopedBulk(bulk);

			// Counts: 2 Creates, 2 Deletes (1 from root, 1 from event), 1 Rename
			expect(result.length).toBe(5);
			
			const creates = result.filter(e => e.kind === MaterializedEventKind.Create);
			const deletes = result.filter(e => e.kind === MaterializedEventKind.Delete);
			const renames = result.filter(e => e.kind === MaterializedEventKind.Rename);

			expect(creates.length).toBe(2);
			expect(deletes.length).toBe(2);
			expect(renames.length).toBe(1);
		});
	});
});

