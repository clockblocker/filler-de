import { describe, expect, it } from "bun:test";
import type { LibraryScopedBulkVaultEvent } from "../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types/scoped-event";
import { Scope } from "../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types/scoped-event";
import { materializeScopedBulk } from "../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/materialized-node-events/materialize-scoped-bulk";
import type { MaterializedNodeEvent } from "../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/materialized-node-events/types";
import { MaterializedEventType } from "../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/materialized-node-events/types";
import { TreeNodeType } from "../../../../../../../../src/commanders/librarian-new/library-tree/tree-node/types/atoms";
import { SplitPathType } from "../../../../../../../../src/obsidian-vault-action-manager/types/split-path";
import { VaultEventType } from "../../../../../../../../src/obsidian-vault-action-manager/types/vault-event";

// Helper: create library-scoped split paths
const F = (basename: string, pathParts: string[] = []): { basename: string; pathParts: string[]; type: typeof SplitPathType.Folder } => ({
	basename,
	pathParts,
	type: SplitPathType.Folder,
});

const File = (basename: string, pathParts: string[] = [], extension = "txt"): { basename: string; pathParts: string[]; type: typeof SplitPathType.File; extension: string } => ({
	basename,
	extension,
	pathParts,
	type: SplitPathType.File,
});

const MdFile = (basename: string, pathParts: string[] = []): { basename: string; pathParts: string[]; type: typeof SplitPathType.MdFile; extension: "md" } => ({
	basename,
	extension: "md",
	pathParts,
	type: SplitPathType.MdFile,
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
						event: {
							splitPath: File("note", ["section"]),
							type: VaultEventType.FileCreated,
						},
						scope: Scope.InsideToInside,
					},
				],
				roots: [],
			};

			const result = materializeScopedBulk(bulk);

			expectMultisetEqual(result, [
				{
					kind: MaterializedEventType.Create,
					libraryScopedSplitPath: File("note", ["section"]),
					nodeType: TreeNodeType.File,
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
						event: {
							splitPath: MdFile("note", ["section"]),
							type: VaultEventType.FileCreated,
						},
						scope: Scope.InsideToInside,
					},
				],
				roots: [],
			};

			const result = materializeScopedBulk(bulk);

			expectMultisetEqual(result, [
				{
					kind: MaterializedEventType.Create,
					libraryScopedSplitPath: MdFile("note", ["section"]),
					nodeType: TreeNodeType.Scroll,
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
						event: {
							splitPath: F("folder"),
							type: VaultEventType.FolderCreated,
						},
						scope: Scope.InsideToInside,
					},
					{
						event: {
							splitPath: File("outside"),
							type: VaultEventType.FileCreated,
						},
						scope: Scope.OutsideToOutside,
					},
					{
						event: {
							splitPath: File("boundary"),
							type: VaultEventType.FileCreated,
						},
						scope: Scope.InsideToOutside,
					},
					{
						event: {
							splitPath: File("incoming"),
							type: VaultEventType.FileCreated,
						},
						scope: Scope.OutsideToInside,
					},
				],
				roots: [],
			};

			const result = materializeScopedBulk(bulk);

			expectMultisetEqual(result, [
				{
					kind: MaterializedEventType.Create,
					libraryScopedSplitPath: File("incoming"),
					nodeType: TreeNodeType.File,
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
						event: {
							splitPath: File("file"),
							type: VaultEventType.FileDeleted,
						},
						scope: Scope.InsideToInside,
					},
					{
						event: {
							splitPath: MdFile("scroll"),
							type: VaultEventType.FileDeleted,
						},
						scope: Scope.InsideToInside,
					},
					{
						event: {
							splitPath: F("section"),
							type: VaultEventType.FolderDeleted,
						},
						scope: Scope.InsideToInside,
					},
				],
			};

			const result = materializeScopedBulk(bulk);

			expectMultisetEqual(result, [
				{
					kind: MaterializedEventType.Delete,
					libraryScopedSplitPath: File("file"),
					nodeType: TreeNodeType.File,
				},
				{
					kind: MaterializedEventType.Delete,
					libraryScopedSplitPath: MdFile("scroll"),
					nodeType: TreeNodeType.Scroll,
				},
				{
					kind: MaterializedEventType.Delete,
					libraryScopedSplitPath: F("section"),
					nodeType: TreeNodeType.Section,
				},
			]);
		});

		it("ignores non-InsideToInside scopes", () => {
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
						event: {
							splitPath: File("outside"),
							type: VaultEventType.FileDeleted,
						},
						scope: Scope.OutsideToOutside,
					},
					{
						event: {
							splitPath: File("incoming"),
							type: VaultEventType.FileDeleted,
						},
						scope: Scope.OutsideToInside,
					},
					{
						event: {
							splitPath: File("outgoing"),
							type: VaultEventType.FileDeleted,
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
		it("deletes from InsideToOutside FileRenamed, FolderRenamed, FileDeleted, FolderDeleted", () => {
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
						event: {
							from: File("file"),
							to: File("outside"),
							type: VaultEventType.FileRenamed,
						},
						scope: Scope.InsideToOutside,
					},
					{
						event: {
							from: MdFile("scroll"),
							to: MdFile("outside"),
							type: VaultEventType.FileRenamed,
						},
						scope: Scope.InsideToOutside,
					},
					{
						event: {
							from: F("section"),
							to: F("outside"),
							type: VaultEventType.FolderRenamed,
						},
						scope: Scope.InsideToOutside,
					},
					{
						event: {
							splitPath: File("deleted"),
							type: VaultEventType.FileDeleted,
						},
						scope: Scope.InsideToOutside,
					},
					{
						event: {
							splitPath: F("deleted-section"),
							type: VaultEventType.FolderDeleted,
						},
						scope: Scope.InsideToOutside,
					},
				],
				roots: [],
			};

			const result = materializeScopedBulk(bulk);

			expectMultisetEqual(result, [
				{
					kind: MaterializedEventType.Delete,
					libraryScopedSplitPath: File("file"),
					nodeType: TreeNodeType.File,
				},
				{
					kind: MaterializedEventType.Delete,
					libraryScopedSplitPath: MdFile("scroll"),
					nodeType: TreeNodeType.Scroll,
				},
				{
					kind: MaterializedEventType.Delete,
					libraryScopedSplitPath: F("section"),
					nodeType: TreeNodeType.Section,
				},
				{
					kind: MaterializedEventType.Delete,
					libraryScopedSplitPath: File("deleted"),
					nodeType: TreeNodeType.File,
				},
				{
					kind: MaterializedEventType.Delete,
					libraryScopedSplitPath: F("deleted-section"),
					nodeType: TreeNodeType.Section,
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
						event: {
							splitPath: File("inside"),
							type: VaultEventType.FileDeleted,
						},
						scope: Scope.InsideToInside,
					},
					{
						event: {
							splitPath: File("incoming"),
							type: VaultEventType.FileDeleted,
						},
						scope: Scope.OutsideToInside,
					},
					{
						event: {
							splitPath: File("outside"),
							type: VaultEventType.FileDeleted,
						},
						scope: Scope.OutsideToOutside,
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
						event: {
							from: File("old-file"),
							to: File("new-file"),
							type: VaultEventType.FileRenamed,
						},
						scope: Scope.InsideToInside,
					},
					{
						event: {
							from: MdFile("old-scroll"),
							to: MdFile("new-scroll"),
							type: VaultEventType.FileRenamed,
						},
						scope: Scope.InsideToInside,
					},
					{
						event: {
							from: F("old-section"),
							to: F("new-section"),
							type: VaultEventType.FolderRenamed,
						},
						scope: Scope.InsideToInside,
					},
				],
			};

			const result = materializeScopedBulk(bulk);

			expectMultisetEqual(result, [
				{
					kind: MaterializedEventType.Rename,
					libraryScopedFrom: File("old-file"),
					libraryScopedTo: File("new-file"),
					nodeType: TreeNodeType.File,
				},
				{
					kind: MaterializedEventType.Rename,
					libraryScopedFrom: MdFile("old-scroll"),
					libraryScopedTo: MdFile("new-scroll"),
					nodeType: TreeNodeType.Scroll,
				},
				{
					kind: MaterializedEventType.Rename,
					libraryScopedFrom: F("old-section"),
					libraryScopedTo: F("new-section"),
					nodeType: TreeNodeType.Section,
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
						event: {
							from: File("file"),
							to: MdFile("scroll"),
							type: VaultEventType.FileRenamed,
						},
						scope: Scope.InsideToInside,
					},
					{
						event: {
							from: MdFile("scroll"),
							to: File("file"),
							type: VaultEventType.FileRenamed,
						},
						scope: Scope.InsideToInside,
					},
					{
						event: {
							from: File("old"),
							to: File("new"),
							type: VaultEventType.FileRenamed,
						},
						scope: Scope.OutsideToOutside,
					},
					{
						event: {
							from: File("old"),
							to: File("new"),
							type: VaultEventType.FileRenamed,
						},
						scope: Scope.OutsideToInside,
					},
					{
						event: {
							from: File("old"),
							to: File("new"),
							type: VaultEventType.FileRenamed,
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
						event: {
							splitPath: File("created"),
							type: VaultEventType.FileCreated,
						},
						scope: Scope.InsideToInside,
					},
					{
						event: {
							splitPath: MdFile("incoming"),
							type: VaultEventType.FileCreated,
						},
						scope: Scope.OutsideToInside,
					},
					{
						event: {
							from: File("outgoing"),
							to: File("outside"),
							type: VaultEventType.FileRenamed,
						},
						scope: Scope.InsideToOutside,
					},
				],
				roots: [
					{
						event: {
							splitPath: File("deleted"),
							type: VaultEventType.FileDeleted,
						},
						scope: Scope.InsideToInside,
					},
					{
						event: {
							from: File("old"),
							to: File("new"),
							type: VaultEventType.FileRenamed,
						},
						scope: Scope.InsideToInside,
					},
				],
			};

			const result = materializeScopedBulk(bulk);

			// Counts: 2 Creates, 2 Deletes (1 from root, 1 from event), 1 Rename
			expect(result.length).toBe(5);
			
			const creates = result.filter(e => e.kind === MaterializedEventType.Create);
			const deletes = result.filter(e => e.kind === MaterializedEventType.Delete);
			const renames = result.filter(e => e.kind === MaterializedEventType.Rename);

			expect(creates.length).toBe(2);
			expect(deletes.length).toBe(2);
			expect(renames.length).toBe(1);
		});
	});
});

