/**
 * Tests for VaultAction processing patterns.
 * Captures current behavior of the 9-case action union before Phase 2/3 refactoring.
 *
 * These tests cover:
 * - Path extraction for all action types
 * - Dependency detection patterns
 * - Topological sort behavior
 * - Self-event tracking
 */

import { describe, expect, it } from "bun:test";
import {
	buildDependencyGraph,
	makeGraphKey,
} from "../../../src/managers/obsidian/vault-action-manager/impl/actions-processing/dependency-detector";
import { topologicalSort } from "../../../src/managers/obsidian/vault-action-manager/impl/actions-processing/topological-sort";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionKind,
} from "../../../src/managers/obsidian/vault-action-manager/types/vault-action";

// ─── Test Helpers ───

const folder = (basename: string, pathParts: string[] = []): SplitPathToFolder => ({
	basename,
	kind: "Folder",
	pathParts,
});

const mdFile = (
	basename: string,
	pathParts: string[] = [],
): SplitPathToMdFile => ({
	basename,
	extension: "md",
	kind: "MdFile",
	pathParts,
});

const file = (
	basename: string,
	extension: string,
	pathParts: string[] = [],
): SplitPathToFile => ({
	basename,
	extension,
	kind: "File",
	pathParts,
});

describe("VaultAction Processing", () => {
	describe("Action Kind Coverage", () => {
		/**
		 * Documents all 9 action kinds in the VaultActionKind union.
		 * Tests ensure each kind can be created and has expected properties.
		 */

		it("CreateFolder action", () => {
			const action: VaultAction = {
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("test", ["parent"]) },
			};
			expect(action.kind).toBe("CreateFolder");
			expect(action.payload.splitPath.kind).toBe("Folder");
		});

		it("RenameFolder action", () => {
			const action: VaultAction = {
				kind: VaultActionKind.RenameFolder,
				payload: {
					from: folder("old", ["parent"]),
					to: folder("new", ["parent"]),
				},
			};
			expect(action.kind).toBe("RenameFolder");
		});

		it("TrashFolder action", () => {
			const action: VaultAction = {
				kind: VaultActionKind.TrashFolder,
				payload: { splitPath: folder("test", ["parent"]) },
			};
			expect(action.kind).toBe("TrashFolder");
		});

		it("CreateFile action", () => {
			const action: VaultAction = {
				kind: VaultActionKind.CreateFile,
				payload: {
					splitPath: file("image", "png", ["assets"]),
				},
			};
			expect(action.kind).toBe("CreateFile");
		});

		it("UpsertMdFile action", () => {
			const action: VaultAction = {
				kind: VaultActionKind.UpsertMdFile,
				payload: {
					content: "# Test",
					splitPath: mdFile("note", ["docs"]),
				},
			};
			expect(action.kind).toBe("UpsertMdFile");
		});

		it("RenameMdFile action", () => {
			const action: VaultAction = {
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: mdFile("old", ["docs"]),
					to: mdFile("new", ["docs"]),
				},
			};
			expect(action.kind).toBe("RenameMdFile");
		});

		it("RenameFile action", () => {
			const action: VaultAction = {
				kind: VaultActionKind.RenameFile,
				payload: {
					from: file("old", "png", ["assets"]),
					to: file("new", "png", ["assets"]),
				},
			};
			expect(action.kind).toBe("RenameFile");
		});

		it("TrashFile action", () => {
			const action: VaultAction = {
				kind: VaultActionKind.TrashFile,
				payload: { splitPath: file("image", "png", ["assets"]) },
			};
			expect(action.kind).toBe("TrashFile");
		});

		it("TrashMdFile action", () => {
			const action: VaultAction = {
				kind: VaultActionKind.TrashMdFile,
				payload: { splitPath: mdFile("note", ["docs"]) },
			};
			expect(action.kind).toBe("TrashMdFile");
		});

		it("ProcessMdFile action", () => {
			const action: VaultAction = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("note", ["docs"]),
					transform: (content: string) => content.toUpperCase(),
				},
			};
			expect(action.kind).toBe("ProcessMdFile");
		});
	});

	describe("Dependency Detection", () => {
		function getDependenciesFor(
			action: VaultAction,
			allActions: VaultAction[],
		): VaultAction[] {
			const graph = buildDependencyGraph(allActions);
			const key = makeGraphKey(action);
			const entry = graph.get(key);
			return entry?.dependsOn ?? [];
		}

		it("CreateFolder has no dependencies", () => {
			const action: VaultAction = {
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("test", []) },
			};

			const deps = getDependenciesFor(action, [action]);
			expect(deps).toEqual([]);
		});

		it("CreateFile depends on parent folder creation", () => {
			const createFolder: VaultAction = {
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("parent", []) },
			};
			const createFile: VaultAction = {
				kind: VaultActionKind.CreateFile,
				payload: { splitPath: file("image", "png", ["parent"]) },
			};

			const deps = getDependenciesFor(createFile, [createFolder, createFile]);
			expect(deps).toContain(createFolder);
		});

		it("UpsertMdFile depends on parent folder creation", () => {
			const createFolder: VaultAction = {
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("docs", []) },
			};
			const upsertMd: VaultAction = {
				kind: VaultActionKind.UpsertMdFile,
				payload: {
					content: "# Test",
					splitPath: mdFile("note", ["docs"]),
				},
			};

			const deps = getDependenciesFor(upsertMd, [createFolder, upsertMd]);
			expect(deps).toContain(createFolder);
		});

		it("ProcessMdFile depends on file upsert", () => {
			const upsertMd: VaultAction = {
				kind: VaultActionKind.UpsertMdFile,
				payload: {
					content: "# Test",
					splitPath: mdFile("note", ["docs"]),
				},
			};
			const processMd: VaultAction = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("note", ["docs"]),
					transform: (c) => c,
				},
			};

			const deps = getDependenciesFor(processMd, [upsertMd, processMd]);
			expect(deps).toContain(upsertMd);
		});

		it("RenameFolder has no file dependencies (folder must exist in vault)", () => {
			const renameFolder: VaultAction = {
				kind: VaultActionKind.RenameFolder,
				payload: {
					from: folder("old", []),
					to: folder("new", []),
				},
			};

			const deps = getDependenciesFor(renameFolder, [renameFolder]);
			expect(deps).toEqual([]);
		});

		it("nested folder creation establishes correct dependency chain", () => {
			const createParent: VaultAction = {
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("parent", []) },
			};
			const createChild: VaultAction = {
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("child", ["parent"]) },
			};
			const createGrandchild: VaultAction = {
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("grandchild", ["parent", "child"]) },
			};

			const deps1 = getDependenciesFor(createChild, [
				createParent,
				createChild,
			]);
			expect(deps1).toContain(createParent);

			const deps2 = getDependenciesFor(createGrandchild, [
				createParent,
				createChild,
				createGrandchild,
			]);
			expect(deps2).toContain(createChild);
		});
	});

	describe("Topological Sort", () => {
		it("sorts independent actions by path depth", () => {
			const shallow: VaultAction = {
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("shallow", []) },
			};
			const deep: VaultAction = {
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("deep", ["a", "b", "c"]) },
			};

			const actions = [deep, shallow];
			const graph = buildDependencyGraph(actions);
			const sorted = topologicalSort(actions, graph);

			// Shallow paths should come first (lower depth)
			const shallowIndex = sorted.indexOf(shallow);
			const deepIndex = sorted.indexOf(deep);
			expect(shallowIndex).toBeLessThan(deepIndex);
		});

		it("sorts dependent actions in correct order", () => {
			const createFolder: VaultAction = {
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("docs", []) },
			};
			const createFile: VaultAction = {
				kind: VaultActionKind.UpsertMdFile,
				payload: {
					content: "test",
					splitPath: mdFile("note", ["docs"]),
				},
			};

			const actions = [createFile, createFolder];
			const graph = buildDependencyGraph(actions);
			const sorted = topologicalSort(actions, graph);

			const folderIndex = sorted.indexOf(createFolder);
			const fileIndex = sorted.indexOf(createFile);
			expect(folderIndex).toBeLessThan(fileIndex);
		});

		it("handles complex dependency graph", () => {
			const root: VaultAction = {
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("root", []) },
			};
			const child1: VaultAction = {
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("child1", ["root"]) },
			};
			const child2: VaultAction = {
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("child2", ["root"]) },
			};
			const file1: VaultAction = {
				kind: VaultActionKind.UpsertMdFile,
				payload: {
					content: "1",
					splitPath: mdFile("f1", ["root", "child1"]),
				},
			};
			const file2: VaultAction = {
				kind: VaultActionKind.UpsertMdFile,
				payload: {
					content: "2",
					splitPath: mdFile("f2", ["root", "child2"]),
				},
			};

			const actions = [file2, child2, file1, root, child1];
			const graph = buildDependencyGraph(actions);
			const sorted = topologicalSort(actions, graph);

			// Root must come before children
			expect(sorted.indexOf(root)).toBeLessThan(sorted.indexOf(child1));
			expect(sorted.indexOf(root)).toBeLessThan(sorted.indexOf(child2));

			// Children must come before their files
			expect(sorted.indexOf(child1)).toBeLessThan(sorted.indexOf(file1));
			expect(sorted.indexOf(child2)).toBeLessThan(sorted.indexOf(file2));
		});
	});

	describe("Path Extraction Patterns", () => {
		/**
		 * Tests the pattern used in 6+ places to extract paths from actions.
		 * This documents the behavior that will be consolidated in Phase 2.
		 */

		function getActionPath(action: VaultAction): string[] {
			switch (action.kind) {
				case VaultActionKind.CreateFolder:
				case VaultActionKind.TrashFolder:
					return [
						...action.payload.splitPath.pathParts,
						action.payload.splitPath.basename,
					];

				case VaultActionKind.CreateFile:
				case VaultActionKind.TrashFile:
					return [
						...action.payload.splitPath.pathParts,
						`${action.payload.splitPath.basename}.${action.payload.splitPath.extension}`,
					];

				case VaultActionKind.UpsertMdFile:
				case VaultActionKind.TrashMdFile:
				case VaultActionKind.ProcessMdFile:
					return [
						...action.payload.splitPath.pathParts,
						`${action.payload.splitPath.basename}.md`,
					];

				case VaultActionKind.RenameFolder:
					return [
						...action.payload.from.pathParts,
						action.payload.from.basename,
					];

				case VaultActionKind.RenameMdFile:
					return [
						...action.payload.from.pathParts,
						`${action.payload.from.basename}.md`,
					];

				case VaultActionKind.RenameFile:
					return [
						...action.payload.from.pathParts,
						`${action.payload.from.basename}.${action.payload.from.extension}`,
					];
			}
		}

		it("extracts path from CreateFolder", () => {
			const action: VaultAction = {
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("test", ["parent"]) },
			};
			expect(getActionPath(action)).toEqual(["parent", "test"]);
		});

		it("extracts path from UpsertMdFile", () => {
			const action: VaultAction = {
				kind: VaultActionKind.UpsertMdFile,
				payload: {
					content: "test",
					splitPath: mdFile("note", ["docs"]),
				},
			};
			expect(getActionPath(action)).toEqual(["docs", "note.md"]);
		});

		it("extracts path from RenameMdFile (uses 'from' path)", () => {
			const action: VaultAction = {
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: mdFile("old", ["docs"]),
					to: mdFile("new", ["docs"]),
				},
			};
			expect(getActionPath(action)).toEqual(["docs", "old.md"]);
		});

		it("extracts path from RenameFile (uses 'from' path)", () => {
			const action: VaultAction = {
				kind: VaultActionKind.RenameFile,
				payload: {
					from: file("old", "png", ["assets"]),
					to: file("new", "png", ["assets"]),
				},
			};
			expect(getActionPath(action)).toEqual(["assets", "old.png"]);
		});
	});

	describe("Operation Type Patterns", () => {
		/**
		 * Tests helper patterns for determining operation type.
		 * This documents behavior that will be consolidated in Phase 2.
		 */

		function isCreateAction(action: VaultAction): boolean {
			return (
				action.kind === VaultActionKind.CreateFolder ||
				action.kind === VaultActionKind.CreateFile ||
				action.kind === VaultActionKind.UpsertMdFile
			);
		}

		function isRenameAction(action: VaultAction): boolean {
			return (
				action.kind === VaultActionKind.RenameFolder ||
				action.kind === VaultActionKind.RenameMdFile ||
				action.kind === VaultActionKind.RenameFile
			);
		}

		function isTrashAction(action: VaultAction): boolean {
			return (
				action.kind === VaultActionKind.TrashFolder ||
				action.kind === VaultActionKind.TrashFile ||
				action.kind === VaultActionKind.TrashMdFile
			);
		}

		function isProcessAction(action: VaultAction): boolean {
			return action.kind === VaultActionKind.ProcessMdFile;
		}

		it("correctly identifies create actions", () => {
			expect(
				isCreateAction({
					kind: VaultActionKind.CreateFolder,
					payload: { splitPath: folder("test") },
				}),
			).toBe(true);
			expect(
				isCreateAction({
					kind: VaultActionKind.CreateFile,
					payload: { splitPath: file("img", "png") },
				}),
			).toBe(true);
			expect(
				isCreateAction({
					kind: VaultActionKind.UpsertMdFile,
					payload: { splitPath: mdFile("note"), content: "" },
				}),
			).toBe(true);
		});

		it("correctly identifies rename actions", () => {
			expect(
				isRenameAction({
					kind: VaultActionKind.RenameFolder,
					payload: { from: folder("a"), to: folder("b") },
				}),
			).toBe(true);
			expect(
				isRenameAction({
					kind: VaultActionKind.RenameMdFile,
					payload: { from: mdFile("a"), to: mdFile("b") },
				}),
			).toBe(true);
			expect(
				isRenameAction({
					kind: VaultActionKind.RenameFile,
					payload: { from: file("a", "png"), to: file("b", "png") },
				}),
			).toBe(true);
		});

		it("correctly identifies trash actions", () => {
			expect(
				isTrashAction({
					kind: VaultActionKind.TrashFolder,
					payload: { splitPath: folder("test") },
				}),
			).toBe(true);
			expect(
				isTrashAction({
					kind: VaultActionKind.TrashFile,
					payload: { splitPath: file("img", "png") },
				}),
			).toBe(true);
			expect(
				isTrashAction({
					kind: VaultActionKind.TrashMdFile,
					payload: { splitPath: mdFile("note") },
				}),
			).toBe(true);
		});

		it("correctly identifies process actions", () => {
			expect(
				isProcessAction({
					kind: VaultActionKind.ProcessMdFile,
					payload: { splitPath: mdFile("note"), transform: (c) => c },
				}),
			).toBe(true);
			expect(
				isProcessAction({
					kind: VaultActionKind.UpsertMdFile,
					payload: { splitPath: mdFile("note"), content: "" },
				}),
			).toBe(false);
		});
	});
});
