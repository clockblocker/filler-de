/**
 * Tests for Tree mutation operations.
 * Captures current behavior before Phase 3 split into TreeReader/TreeWriter.
 *
 * These tests cover:
 * - Create, rename, move, delete operations on Tree
 * - Ancestor pruning behavior
 * - findSection navigation
 * - State consistency after mutations
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../src/commanders/librarian/codecs";
import { Tree } from "../../../src/commanders/librarian/healer/library-tree/tree";
import { TreeActionType } from "../../../src/commanders/librarian/healer/library-tree/tree-action/types/tree-action";
import {
	TreeNodeKind,
	TreeNodeStatus,
} from "../../../src/commanders/librarian/healer/library-tree/tree-node/types/atoms";
import type { SectionNode } from "../../../src/commanders/librarian/healer/library-tree/tree-node/types/tree-node";
import type { NodeName } from "../../../src/commanders/librarian/types/schemas/node-name";
import { MD } from "../../../src/managers/obsidian/vault-action-manager/types/literals";
import { SplitPathKind } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { defaultSettingsForUnitTests } from "../../unit/common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../unit/common-utils/setup-spy";
import {
	makeFileLocator,
	makeScrollLocator,
	makeSectionLocator,
} from "../../unit/librarian/library-tree/tree-test-helpers";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

function createTree(libraryRoot: string = "Library"): Tree {
	const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
	const codecs = makeCodecs(rules);
	return new Tree(libraryRoot as NodeName, codecs);
}

describe("Tree Mutations", () => {
	describe("Tree Initialization", () => {
		it("creates empty tree with root node", () => {
			const tree = createTree("Library");
			const root = tree.getRoot();

			expect(root).toBeDefined();
			expect(root.nodeName).toBe("Library");
			expect(root.kind).toBe(TreeNodeKind.Section);
			expect(Object.keys(root.children)).toHaveLength(0);
		});

		it("root node is a SectionNode", () => {
			const tree = createTree("Library");
			const root = tree.getRoot();

			expect(root.kind).toBe(TreeNodeKind.Section);
			expect("children" in root).toBe(true);
		});
	});

	describe("apply Create", () => {
		it("creates leaf node at root level", () => {
			const tree = createTree();
			const locator = makeScrollLocator(
				["Library" as NodeName],
				"Note" as NodeName,
			);

			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library"],
				},
				targetLocator: locator,
			});

			const root = tree.getRoot();
			expect(Object.keys(root.children)).toHaveLength(1);

			const childValues = Object.values(root.children);
			expect(childValues[0].nodeName).toBe("Note");
			expect(childValues[0].kind).toBe(TreeNodeKind.Scroll);
		});

		it("auto-creates parent sections when needed", () => {
			const tree = createTree();
			const locator = makeScrollLocator(
				[
					"Library" as NodeName,
					"recipes" as NodeName,
					"soup" as NodeName,
				],
				"Note" as NodeName,
			);

			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note-soup-recipes",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes", "soup"],
				},
				targetLocator: locator,
			});

			// Verify structure
			const root = tree.getRoot();
			const recipes = Object.values(root.children).find(
				(c) => c.nodeName === "recipes",
			) as SectionNode;
			expect(recipes).toBeDefined();
			expect(recipes.kind).toBe(TreeNodeKind.Section);

			const soup = Object.values(recipes.children).find(
				(c) => c.nodeName === "soup",
			) as SectionNode;
			expect(soup).toBeDefined();
			expect(soup.kind).toBe(TreeNodeKind.Section);

			const note = Object.values(soup.children).find(
				(c) => c.nodeName === "Note",
			);
			expect(note).toBeDefined();
			expect(note?.kind).toBe(TreeNodeKind.Scroll);
		});

		it("creates file node (non-md)", () => {
			const tree = createTree();
			const locator = makeFileLocator(
				["Library" as NodeName, "assets" as NodeName],
				"image" as NodeName,
				"png",
			);

			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "image",
					extension: "png",
					kind: SplitPathKind.File,
					pathParts: ["Library", "assets"],
				},
				targetLocator: locator,
			});

			const root = tree.getRoot();
			const assets = Object.values(root.children).find(
				(c) => c.nodeName === "assets",
			) as SectionNode;
			const image = Object.values(assets.children).find(
				(c) => c.nodeName === "image",
			);

			expect(image).toBeDefined();
			expect(image?.kind).toBe(TreeNodeKind.File);
			if (image?.kind === TreeNodeKind.File) {
				expect(image.extension).toBe("png");
			}
		});
	});

	describe("apply Delete", () => {
		it("deletes leaf node", () => {
			const tree = createTree();

			// First create
			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName],
					"Note" as NodeName,
				),
			});

			// Then delete
			tree.apply({
				actionType: TreeActionType.Delete,
				targetLocator: makeScrollLocator(
					["Library" as NodeName],
					"Note" as NodeName,
				),
			});

			const root = tree.getRoot();
			expect(Object.keys(root.children)).toHaveLength(0);
		});

		it("prunes empty ancestor sections", () => {
			const tree = createTree();

			// Create deep structure
			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note-c-b-a",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "a", "b", "c"],
				},
				targetLocator: makeScrollLocator(
					[
						"Library" as NodeName,
						"a" as NodeName,
						"b" as NodeName,
						"c" as NodeName,
					],
					"Note" as NodeName,
				),
			});

			// Verify structure exists
			let root = tree.getRoot();
			expect(Object.values(root.children).find((c) => c.nodeName === "a")).toBeDefined();

			// Delete the leaf
			tree.apply({
				actionType: TreeActionType.Delete,
				targetLocator: makeScrollLocator(
					[
						"Library" as NodeName,
						"a" as NodeName,
						"b" as NodeName,
						"c" as NodeName,
					],
					"Note" as NodeName,
				),
			});

			// All empty ancestors should be pruned
			root = tree.getRoot();
			expect(Object.keys(root.children)).toHaveLength(0);
		});

		it("preserves siblings when deleting", () => {
			const tree = createTree();

			// Create two siblings
			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note1-recipes",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName, "recipes" as NodeName],
					"Note1" as NodeName,
				),
			});

			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note2-recipes",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName, "recipes" as NodeName],
					"Note2" as NodeName,
				),
			});

			// Delete one
			tree.apply({
				actionType: TreeActionType.Delete,
				targetLocator: makeScrollLocator(
					["Library" as NodeName, "recipes" as NodeName],
					"Note1" as NodeName,
				),
			});

			// Sibling should remain
			const root = tree.getRoot();
			const recipes = Object.values(root.children).find(
				(c) => c.nodeName === "recipes",
			) as SectionNode;
			expect(recipes).toBeDefined();
			expect(Object.keys(recipes.children)).toHaveLength(1);
			expect(
				Object.values(recipes.children).find((c) => c.nodeName === "Note2"),
			).toBeDefined();
		});
	});

	describe("apply Rename", () => {
		it("renames leaf node", () => {
			const tree = createTree();

			// Create
			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Untitled",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName],
					"Untitled" as NodeName,
				),
			});

			// Rename
			tree.apply({
				actionType: TreeActionType.Rename,
				newNodeName: "MyNote" as NodeName,
				targetLocator: makeScrollLocator(
					["Library" as NodeName],
					"Untitled" as NodeName,
				),
			});

			const root = tree.getRoot();
			expect(
				Object.values(root.children).find((c) => c.nodeName === "Untitled"),
			).toBeUndefined();
			expect(
				Object.values(root.children).find((c) => c.nodeName === "MyNote"),
			).toBeDefined();
		});

		it("renames section node", () => {
			const tree = createTree();

			// Create section with child
			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note-recipes",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName, "recipes" as NodeName],
					"Note" as NodeName,
				),
			});

			// Rename section
			tree.apply({
				actionType: TreeActionType.Rename,
				newNodeName: "cooking" as NodeName,
				targetLocator: makeSectionLocator(
					["Library" as NodeName],
					"recipes" as NodeName,
				),
			});

			const root = tree.getRoot();
			expect(
				Object.values(root.children).find((c) => c.nodeName === "recipes"),
			).toBeUndefined();

			const cooking = Object.values(root.children).find(
				(c) => c.nodeName === "cooking",
			) as SectionNode;
			expect(cooking).toBeDefined();

			// Child should still exist under renamed section
			expect(
				Object.values(cooking.children).find((c) => c.nodeName === "Note"),
			).toBeDefined();
		});

		it("preserves node status on rename", () => {
			const tree = createTree();

			// Create with specific status
			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName],
					"Note" as NodeName,
				),
			});

			// Change status
			tree.apply({
				actionType: TreeActionType.ChangeStatus,
				newStatus: TreeNodeStatus.Done,
				targetLocator: makeScrollLocator(
					["Library" as NodeName],
					"Note" as NodeName,
				),
			});

			// Rename
			tree.apply({
				actionType: TreeActionType.Rename,
				newNodeName: "CompletedNote" as NodeName,
				targetLocator: makeScrollLocator(
					["Library" as NodeName],
					"Note" as NodeName,
				),
			});

			const root = tree.getRoot();
			const renamed = Object.values(root.children).find(
				(c) => c.nodeName === "CompletedNote",
			);
			expect(renamed).toBeDefined();
			if (renamed?.kind === TreeNodeKind.Scroll) {
				expect(renamed.status).toBe(TreeNodeStatus.Done);
			}
		});
	});

	describe("apply Move", () => {
		it("moves leaf to new parent", () => {
			const tree = createTree();

			// Create structure: recipes/Note and archive/
			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note-recipes",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName, "recipes" as NodeName],
					"Note" as NodeName,
				),
			});

			// Create archive section
			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "placeholder-archive",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "archive"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName, "archive" as NodeName],
					"placeholder" as NodeName,
				),
			});

			// Move Note from recipes to archive
			tree.apply({
				actionType: TreeActionType.Move,
				newNodeName: "Note" as NodeName,
				newParentLocator: makeSectionLocator(
					["Library" as NodeName],
					"archive" as NodeName,
				),
				targetLocator: makeScrollLocator(
					["Library" as NodeName, "recipes" as NodeName],
					"Note" as NodeName,
				),
			});

			const root = tree.getRoot();

			// Note should not be in recipes
			const recipes = Object.values(root.children).find(
				(c) => c.nodeName === "recipes",
			) as SectionNode | undefined;
			if (recipes) {
				expect(
					Object.values(recipes.children).find((c) => c.nodeName === "Note"),
				).toBeUndefined();
			}

			// Note should be in archive
			const archive = Object.values(root.children).find(
				(c) => c.nodeName === "archive",
			) as SectionNode;
			expect(archive).toBeDefined();
			expect(
				Object.values(archive.children).find((c) => c.nodeName === "Note"),
			).toBeDefined();
		});

		it("moves section with all children", () => {
			const tree = createTree();

			// Create nested structure
			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note-soup-recipes",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes", "soup"],
				},
				targetLocator: makeScrollLocator(
					[
						"Library" as NodeName,
						"recipes" as NodeName,
						"soup" as NodeName,
					],
					"Note" as NodeName,
				),
			});

			// Create archive
			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "x-archive",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "archive"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName, "archive" as NodeName],
					"x" as NodeName,
				),
			});

			// Move soup section to archive
			tree.apply({
				actionType: TreeActionType.Move,
				newNodeName: "soup" as NodeName,
				newParentLocator: makeSectionLocator(
					["Library" as NodeName],
					"archive" as NodeName,
				),
				targetLocator: makeSectionLocator(
					["Library" as NodeName, "recipes" as NodeName],
					"soup" as NodeName,
				),
			});

			const root = tree.getRoot();

			// soup should be under archive now
			const archive = Object.values(root.children).find(
				(c) => c.nodeName === "archive",
			) as SectionNode;
			const soup = Object.values(archive.children).find(
				(c) => c.nodeName === "soup",
			) as SectionNode;
			expect(soup).toBeDefined();

			// Child Note should still exist
			expect(
				Object.values(soup.children).find((c) => c.nodeName === "Note"),
			).toBeDefined();
		});
	});

	describe("apply ChangeStatus", () => {
		it("changes leaf status", () => {
			const tree = createTree();

			// Create
			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName],
					"Note" as NodeName,
				),
			});

			// Verify initial status
			let root = tree.getRoot();
			let note = Object.values(root.children).find(
				(c) => c.nodeName === "Note",
			);
			if (note?.kind === TreeNodeKind.Scroll) {
				expect(note.status).toBe(TreeNodeStatus.NotStarted);
			}

			// Change status
			tree.apply({
				actionType: TreeActionType.ChangeStatus,
				newStatus: TreeNodeStatus.Done,
				targetLocator: makeScrollLocator(
					["Library" as NodeName],
					"Note" as NodeName,
				),
			});

			// Verify changed
			root = tree.getRoot();
			note = Object.values(root.children).find((c) => c.nodeName === "Note");
			if (note?.kind === TreeNodeKind.Scroll) {
				expect(note.status).toBe(TreeNodeStatus.Done);
			}
		});

		it("propagates status change to all descendants", () => {
			const tree = createTree();

			// Create multiple leaves under a section
			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note1-recipes",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName, "recipes" as NodeName],
					"Note1" as NodeName,
				),
			});

			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note2-recipes",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName, "recipes" as NodeName],
					"Note2" as NodeName,
				),
			});

			// Change status on section
			tree.apply({
				actionType: TreeActionType.ChangeStatus,
				newStatus: TreeNodeStatus.Done,
				targetLocator: makeSectionLocator(
					["Library" as NodeName],
					"recipes" as NodeName,
				),
			});

			// Verify all descendants have new status
			const root = tree.getRoot();
			const recipes = Object.values(root.children).find(
				(c) => c.nodeName === "recipes",
			) as SectionNode;

			for (const child of Object.values(recipes.children)) {
				if (child.kind === TreeNodeKind.Scroll) {
					expect(child.status).toBe(TreeNodeStatus.Done);
				}
			}
		});
	});

	describe("findSection Navigation", () => {
		it("finds root section", () => {
			const tree = createTree();
			const root = tree.getRoot();

			// Root is accessible via getRoot()
			expect(root.nodeName).toBe("Library");
		});

		it("finds nested section", () => {
			const tree = createTree();

			// Create nested structure
			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note-c-b-a",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "a", "b", "c"],
				},
				targetLocator: makeScrollLocator(
					[
						"Library" as NodeName,
						"a" as NodeName,
						"b" as NodeName,
						"c" as NodeName,
					],
					"Note" as NodeName,
				),
			});

			// Navigate to find sections
			const root = tree.getRoot();
			const a = Object.values(root.children).find(
				(c) => c.nodeName === "a",
			) as SectionNode;
			expect(a).toBeDefined();

			const b = Object.values(a.children).find(
				(c) => c.nodeName === "b",
			) as SectionNode;
			expect(b).toBeDefined();

			const c = Object.values(b.children).find(
				(c) => c.nodeName === "c",
			) as SectionNode;
			expect(c).toBeDefined();
		});
	});

	describe("Edge Cases", () => {
		it("handles duplicate create gracefully", () => {
			const tree = createTree();
			const locator = makeScrollLocator(
				["Library" as NodeName],
				"Note" as NodeName,
			);
			const action = {
				actionType: TreeActionType.Create as const,
				observedSplitPath: {
					basename: "Note",
					extension: MD,
					kind: SplitPathKind.MdFile as const,
					pathParts: ["Library"],
				},
				targetLocator: locator,
			};

			// Create twice - should not throw
			tree.apply(action);
			tree.apply(action);

			const root = tree.getRoot();
			// Should still have just one node (or replace, depending on impl)
			expect(Object.keys(root.children).length).toBeGreaterThanOrEqual(1);
		});

		it("handles operations on non-existent nodes", () => {
			const tree = createTree();

			// Try to delete non-existent - should not throw
			expect(() => {
				tree.apply({
					actionType: TreeActionType.Delete,
					targetLocator: makeScrollLocator(
						["Library" as NodeName],
						"NonExistent" as NodeName,
					),
				});
			}).not.toThrow();
		});

		it("maintains tree integrity after mixed operations", () => {
			const tree = createTree();

			// Perform various operations
			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "A",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName],
					"A" as NodeName,
				),
			});

			tree.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "B-section",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "section"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName, "section" as NodeName],
					"B" as NodeName,
				),
			});

			tree.apply({
				actionType: TreeActionType.Rename,
				newNodeName: "AA" as NodeName,
				targetLocator: makeScrollLocator(
					["Library" as NodeName],
					"A" as NodeName,
				),
			});

			tree.apply({
				actionType: TreeActionType.Delete,
				targetLocator: makeScrollLocator(
					["Library" as NodeName, "section" as NodeName],
					"B" as NodeName,
				),
			});

			// Tree should be in consistent state
			const root = tree.getRoot();
			expect(
				Object.values(root.children).find((c) => c.nodeName === "AA"),
			).toBeDefined();
			expect(
				Object.values(root.children).find((c) => c.nodeName === "A"),
			).toBeUndefined();
			// Section should be pruned since it's empty
			expect(
				Object.values(root.children).find((c) => c.nodeName === "section"),
			).toBeUndefined();
		});
	});
});
